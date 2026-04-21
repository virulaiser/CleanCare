const connectDB = require('../lib/mongodb');
const Usuario = require('../models/Usuario');
const Transaccion = require('../models/Transaccion');
const bcrypt = require('bcryptjs');
const { obtenerSaldo } = require('./billetera');

module.exports = async (req, res) => {
  try {
    await connectDB();

    const esSuperAdmin = req.usuario?.rol === 'admin';
    const esAdminEdificio = req.usuario?.rol === 'admin_edificio';

    // GET — listar usuarios
    if (req.method === 'GET') {
      const { edificioId, rol: rolQuery } = req.query;

      const filter = { activo: true };
      // Por default listamos residentes; el super-admin puede pedir otro rol explicitamente
      if (rolQuery && esSuperAdmin) {
        filter.rol = rolQuery;
      } else {
        // admin_edificio NUNCA ve super-admins ni a otros admin_edificio
        filter.rol = 'residente';
      }
      if (edificioId) filter.edificio_id = edificioId;

      const usuarios = await Usuario.find(filter)
        .select('usuario_id nombre email apartamento telefono edificio_id unidad foto creado rol_apto estado_aprobacion aprobado_por aprobado_en')
        .lean();

      // Obtener todas las transacciones de estos usuarios de una vez
      const usuarioIds = usuarios.map(u => u.usuario_id);
      const transacciones = await Transaccion.find({ usuario_id: { $in: usuarioIds } }).lean();

      // Agrupar por usuario
      const txByUser = {};
      transacciones.forEach(tx => {
        if (!txByUser[tx.usuario_id]) txByUser[tx.usuario_id] = [];
        txByUser[tx.usuario_id].push(tx);
      });

      const conDatos = usuarios.map(u => {
        const txs = txByUser[u.usuario_id] || [];
        let saldo = 0, fichas_usadas = 0, fichas_extras = 0;
        txs.forEach(tx => {
          saldo += tx.cantidad;
          if (tx.tipo === 'uso_maquina') fichas_usadas += Math.abs(tx.cantidad);
          if (tx.tipo === 'ajuste_admin') fichas_extras += tx.cantidad;
        });
        return { ...u, saldo, fichas_usadas, fichas_extras };
      });

      return res.json({ ok: true, usuarios: conDatos });
    }

    // POST — crear usuario manualmente (admin)
    if (req.method === 'POST') {
      const { nombre, email, password, telefono, apartamento, edificio_id, unidad, foto, rol: rolBody } = req.body;

      if (!nombre || !email || !password || !edificio_id) {
        return res.status(400).json({ ok: false, error: 'Faltan campos obligatorios (nombre, email, password, edificio_id)' });
      }

      // Solo el super-admin puede crear otros admins (admin o admin_edificio)
      let rolNuevo = 'residente';
      if (rolBody && rolBody !== 'residente') {
        if (!esSuperAdmin) {
          return res.status(403).json({ ok: false, error: 'Solo el super-admin puede crear otros administradores' });
        }
        if (!['admin', 'admin_edificio'].includes(rolBody)) {
          return res.status(400).json({ ok: false, error: 'Rol inválido' });
        }
        rolNuevo = rolBody;
      }

      if (password.length < 6) {
        return res.status(400).json({ ok: false, error: 'La contraseña debe tener al menos 6 caracteres' });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({ ok: false, error: 'Formato de email inválido' });
      }

      const existe = await Usuario.findOne({ email: email.trim().toLowerCase() });
      if (existe) {
        return res.status(409).json({ ok: false, error: 'Ya existe un usuario con ese email' });
      }

      const usuario = new Usuario({
        nombre,
        email: email.trim().toLowerCase(),
        password,
        telefono: telefono || undefined,
        apartamento: apartamento || undefined,
        edificio_id,
        unidad: unidad || undefined,
        foto: foto || undefined,
        rol: rolNuevo,
        // Admins del edificio no tienen flujo titular/miembro; quedan aprobados para que
        // puedan operar endpoints sin gate.
        estado_aprobacion: rolNuevo === 'residente' ? 'aprobado' : 'aprobado',
      });

      await usuario.save();

      return res.status(201).json({
        ok: true,
        usuario: {
          usuario_id: usuario.usuario_id,
          nombre: usuario.nombre,
          email: usuario.email,
          telefono: usuario.telefono,
          apartamento: usuario.apartamento,
          edificio_id: usuario.edificio_id,
          unidad: usuario.unidad,
        }
      });
    }

    // PATCH — editar usuario
    if (req.method === 'PATCH') {
      const { usuarioId } = req.query;
      if (!usuarioId) {
        return res.status(400).json({ ok: false, error: 'Falta usuarioId' });
      }

      const { nombre, email, telefono, apartamento, edificio_id, unidad, password, foto, rol_apto, estado_aprobacion, rol: rolBody } = req.body;
      const usuario = await Usuario.findOne({ usuario_id: usuarioId, activo: true });
      if (!usuario) {
        return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
      }

      // admin_edificio: no puede editar super-admins ni a usuarios de otros edificios
      if (esAdminEdificio) {
        if (usuario.rol === 'admin') {
          return res.status(403).json({ ok: false, error: 'No podés editar super-admins' });
        }
        if (usuario.edificio_id !== req.usuario.edificio_id) {
          return res.status(403).json({ ok: false, error: 'El usuario no pertenece a tu edificio' });
        }
      }

      if (nombre) usuario.nombre = nombre;
      if (telefono !== undefined) usuario.telefono = telefono;
      if (apartamento !== undefined) usuario.apartamento = apartamento;
      if (edificio_id && esSuperAdmin) usuario.edificio_id = edificio_id;
      if (unidad !== undefined) usuario.unidad = unidad;
      if (foto !== undefined) usuario.foto = foto;
      // Cambio de rol solo por super-admin
      if (rolBody && esSuperAdmin && ['admin', 'admin_edificio', 'residente'].includes(rolBody)) {
        usuario.rol = rolBody;
      }

      if (rol_apto && ['titular', 'miembro'].includes(rol_apto)) {
        // Si lo hacen titular, destronamos al titular anterior del mismo apto
        if (rol_apto === 'titular' && usuario.rol_apto !== 'titular' && usuario.apartamento && usuario.edificio_id) {
          await Usuario.updateMany(
            { edificio_id: usuario.edificio_id, apartamento: usuario.apartamento, rol_apto: 'titular', usuario_id: { $ne: usuario.usuario_id } },
            { $set: { rol_apto: 'miembro', aprobado_por: usuario.usuario_id, aprobado_en: new Date() } }
          );
        }
        usuario.rol_apto = rol_apto;
      }
      if (estado_aprobacion && ['pendiente', 'aprobado', 'rechazado'].includes(estado_aprobacion)) {
        usuario.estado_aprobacion = estado_aprobacion;
        if (estado_aprobacion === 'aprobado') {
          usuario.aprobado_por = usuario.aprobado_por || req.usuario.usuario_id;
          usuario.aprobado_en = usuario.aprobado_en || new Date();
        }
        if (estado_aprobacion === 'rechazado') {
          usuario.activo = false;
        }
      }

      if (email && email.trim().toLowerCase() !== usuario.email) {
        const existe = await Usuario.findOne({ email: email.trim().toLowerCase() });
        if (existe) {
          return res.status(409).json({ ok: false, error: 'Ya existe un usuario con ese email' });
        }
        usuario.email = email.trim().toLowerCase();
      }

      if (password && password.length >= 6) {
        usuario.password = password;
      }

      await usuario.save();

      return res.json({
        ok: true,
        usuario: {
          usuario_id: usuario.usuario_id,
          nombre: usuario.nombre,
          email: usuario.email,
          telefono: usuario.telefono,
          apartamento: usuario.apartamento,
          edificio_id: usuario.edificio_id,
          unidad: usuario.unidad,
        }
      });
    }

    // DELETE — soft-delete usuario
    if (req.method === 'DELETE') {
      const { usuarioId } = req.query;
      if (!usuarioId) {
        return res.status(400).json({ ok: false, error: 'Falta usuarioId' });
      }

      const usuario = await Usuario.findOne({ usuario_id: usuarioId });
      if (!usuario) {
        return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
      }

      // admin_edificio: no puede borrar super-admins ni a usuarios de otro edificio
      if (esAdminEdificio) {
        if (usuario.rol === 'admin') {
          return res.status(403).json({ ok: false, error: 'No podés eliminar super-admins' });
        }
        if (usuario.edificio_id !== req.usuario.edificio_id) {
          return res.status(403).json({ ok: false, error: 'El usuario no pertenece a tu edificio' });
        }
      }

      usuario.activo = false;
      await usuario.save();

      return res.json({ ok: true, message: 'Usuario desactivado' });
    }

    return res.status(405).json({ ok: false, error: 'Método no permitido' });
  } catch (err) {
    console.error('Error usuarios:', err);
    return res.status(500).json({ ok: false, error: 'Error interno' });
  }
};
