const connectDB = require('../lib/mongodb');
const Usuario = require('../models/Usuario');
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
        .select('usuario_id nombre email apartamento telefono edificio_id unidad creado')
        .lean();

      const conSaldo = await Promise.all(
        usuarios.map(async (u) => ({
          ...u,
          saldo: await obtenerSaldo(u.usuario_id)
        }))
      );

      return res.json({ ok: true, usuarios: conSaldo });
    }

    // POST — crear usuario manualmente (admin)
    if (req.method === 'POST') {
      const { nombre, email, password, telefono, apartamento, edificio_id, unidad } = req.body;

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

      const { nombre, email, telefono, apartamento, edificio_id, unidad, password } = req.body;
      const usuario = await Usuario.findOne({ usuario_id: usuarioId, activo: true });
      if (!usuario) {
        return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
      }

      if (nombre) usuario.nombre = nombre;
      if (telefono !== undefined) usuario.telefono = telefono;
      if (apartamento !== undefined) usuario.apartamento = apartamento;
      if (edificio_id) usuario.edificio_id = edificio_id;
      if (unidad !== undefined) usuario.unidad = unidad;

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
