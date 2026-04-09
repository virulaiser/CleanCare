const connectDB = require('../lib/mongodb');
const Usuario = require('../models/Usuario');
const { generarToken } = require('../lib/auth');

module.exports = async (req, res) => {
  try {
    await connectDB();

    // POST /api/auth?action=login
    // POST /api/auth?action=registro
    const { action } = req.query;

    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Método no permitido' });
    }

    if (action === 'registro') {
      return await registro(req, res);
    }
    if (action === 'login') {
      return await login(req, res);
    }

    return res.status(400).json({ ok: false, error: 'Acción no válida. Usar ?action=login o ?action=registro' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};

async function registro(req, res) {
  const { email, password, nombre, rol, edificio_id, unidad, telefono, apartamento } = req.body;

  if (!email || !password || !nombre || !edificio_id) {
    return res.status(400).json({ ok: false, error: 'Faltan campos: email, password, nombre, edificio_id' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ ok: false, error: 'Formato de email inválido' });
  }

  if (password.length < 6) {
    return res.status(400).json({ ok: false, error: 'La contraseña debe tener al menos 6 caracteres' });
  }

  const existe = await Usuario.findOne({ email });
  if (existe) {
    return res.status(409).json({ ok: false, error: 'Ya existe un usuario con ese email' });
  }

  const usuario = await Usuario.create({
    email,
    password,
    nombre,
    telefono,
    apartamento,
    rol: rol || 'residente',
    edificio_id,
    unidad,
  });

  const token = generarToken(usuario);

  res.status(201).json({
    ok: true,
    token,
    usuario: {
      id: usuario._id,
      usuario_id: usuario.usuario_id,
      email: usuario.email,
      nombre: usuario.nombre,
      telefono: usuario.telefono,
      apartamento: usuario.apartamento,
      rol: usuario.rol,
      edificio_id: usuario.edificio_id,
      unidad: usuario.unidad,
    },
  });
}

async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ ok: false, error: 'Faltan campos: email, password' });
  }

  const usuario = await Usuario.findOne({ email, activo: true });
  if (!usuario) {
    return res.status(401).json({ ok: false, error: 'Credenciales incorrectas' });
  }

  const match = await usuario.compararPassword(password);
  if (!match) {
    return res.status(401).json({ ok: false, error: 'Credenciales incorrectas' });
  }

  const token = generarToken(usuario);

  res.json({
    ok: true,
    token,
    usuario: {
      id: usuario._id,
      usuario_id: usuario.usuario_id,
      email: usuario.email,
      nombre: usuario.nombre,
      telefono: usuario.telefono,
      apartamento: usuario.apartamento,
      rol: usuario.rol,
      edificio_id: usuario.edificio_id,
      unidad: usuario.unidad,
    },
  });
}
