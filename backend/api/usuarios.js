const connectDB = require('../lib/mongodb');
const Usuario = require('../models/Usuario');
const Transaccion = require('../models/Transaccion');
const bcrypt = require('bcryptjs');
const { obtenerSaldo } = require('./billetera');

module.exports = async (req, res) => {
  try {
    await connectDB();

    // GET — listar usuarios
    if (req.method === 'GET') {
      const { edificioId } = req.query;

      const filter = { activo: true, rol: 'residente' };
      if (edificioId) filter.edificio_id = edificioId;

      const usuarios = await Usuario.find(filter)
        .select('usuario_id nombre email apartamento telefono edificio_id unidad foto creado')
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
      const { nombre, email, password, telefono, apartamento, edificio_id, unidad, foto } = req.body;

      if (!nombre || !email || !password || !edificio_id) {
        return res.status(400).json({ ok: false, error: 'Faltan campos obligatorios (nombre, email, password, edificio_id)' });
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
        rol: 'residente',
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

      const { nombre, email, telefono, apartamento, edificio_id, unidad, password, foto } = req.body;
      const usuario = await Usuario.findOne({ usuario_id: usuarioId, activo: true });
      if (!usuario) {
        return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
      }

      if (nombre) usuario.nombre = nombre;
      if (telefono !== undefined) usuario.telefono = telefono;
      if (apartamento !== undefined) usuario.apartamento = apartamento;
      if (edificio_id) usuario.edificio_id = edificio_id;
      if (unidad !== undefined) usuario.unidad = unidad;
      if (foto !== undefined) usuario.foto = foto;

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
