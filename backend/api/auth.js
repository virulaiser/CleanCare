const connectDB = require('../lib/mongodb');
const Usuario = require('../models/Usuario');
const { generarToken, verificarToken } = require('../lib/auth');
const { obtenerSaldo } = require('./billetera');

module.exports = async (req, res) => {
  try {
    await connectDB();

    const { action } = req.query;

    // GET /api/auth?action=me — estado actual del usuario autenticado
    if (req.method === 'GET' && action === 'me') {
      return verificarToken(req, res, () => me(req, res));
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Método no permitido' });
    }

    if (action === 'registro') {
      return await registro(req, res);
    }
    if (action === 'login') {
      return await login(req, res);
    }

    return res.status(400).json({ ok: false, error: 'Acción no válida. Usar ?action=login, ?action=registro o ?action=me' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};

function resumirUsuario(u) {
  return {
    id: u._id,
    usuario_id: u.usuario_id,
    email: u.email,
    nombre: u.nombre,
    telefono: u.telefono,
    apartamento: u.apartamento,
    rol: u.rol,
    edificio_id: u.edificio_id,
    unidad: u.unidad,
    rol_apto: u.rol_apto,
    estado_aprobacion: u.estado_aprobacion,
  };
}

async function registro(req, res) {
  const { email, password, nombre, rol, edificio_id, unidad, telefono, apartamento } = req.body;

  if (!email || !password || !nombre || !edificio_id || !apartamento) {
    return res.status(400).json({ ok: false, error: 'Faltan campos: email, password, nombre, edificio_id, apartamento' });
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

  // ¿Hay titular aprobado en este apto?
  const titularExistente = await Usuario.findOne({
    edificio_id,
    apartamento,
    rol_apto: 'titular',
    estado_aprobacion: 'aprobado',
    activo: true,
  }).lean();

  const esTitular = !titularExistente;
  const campos = {
    email,
    password,
    nombre,
    telefono,
    apartamento,
    rol: rol || 'residente',
    edificio_id,
    unidad,
    rol_apto: esTitular ? 'titular' : 'miembro',
    estado_aprobacion: esTitular ? 'aprobado' : 'pendiente',
    aprobado_por: esTitular ? null : null,
    aprobado_en: esTitular ? new Date() : null,
  };

  const usuario = await Usuario.create(campos);
  const token = generarToken(usuario);
  const saldo = await obtenerSaldo(usuario.usuario_id);

  res.status(201).json({
    ok: true,
    token,
    saldo,
    usuario: resumirUsuario(usuario),
    requiere_aprobacion: !esTitular,
    titular_nombre: titularExistente?.nombre || null,
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
  const saldo = await obtenerSaldo(usuario.usuario_id);

  res.json({
    ok: true,
    token,
    saldo,
    usuario: resumirUsuario(usuario),
    requiere_aprobacion: usuario.estado_aprobacion === 'pendiente',
  });
}

async function me(req, res) {
  const usuario = await Usuario.findOne({ usuario_id: req.usuario.usuario_id, activo: true }).lean();
  if (!usuario) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
  res.json({
    ok: true,
    usuario: resumirUsuario(usuario),
    requiere_aprobacion: usuario.estado_aprobacion === 'pendiente',
  });
}
