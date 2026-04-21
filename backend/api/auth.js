const crypto = require('crypto');
const connectDB = require('../lib/mongodb');
const Usuario = require('../models/Usuario');
const Unidad = require('../models/Unidad');
const Ocupacion = require('../models/Ocupacion');
const PasswordReset = require('../models/PasswordReset');
const { generarToken, verificarToken } = require('../lib/auth');
const { obtenerSaldo } = require('./billetera');
const { notificar } = require('../lib/notificar');
const { nuevoMiembroPendiente, passwordReset: tplPasswordReset } = require('../lib/email-templates');

const RESET_TTL_MIN = 30;
const RESET_RATE_LIMIT = 3;        // máx solicitudes por hora y email
const PANEL_URL = process.env.PANEL_URL || 'https://panel-three-blush.vercel.app';

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
    if (action === 'reset-solicitar') {
      return await resetSolicitar(req, res);
    }
    if (action === 'reset-confirmar') {
      return await resetConfirmar(req, res);
    }

    return res.status(400).json({ ok: false, error: 'Acción no válida' });
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

  // Si el edificio tiene unidades generadas, el apartamento debe matchear una activa.
  // Si no hay unidades (edificio legacy), se acepta el apartamento libre.
  const unidadesDelEdificio = await Unidad.countDocuments({ edificio_id });
  if (unidadesDelEdificio > 0) {
    const unidadMatch = await Unidad.findOne({ edificio_id, codigo: apartamento, activa: true }).lean();
    if (!unidadMatch) {
      return res.status(400).json({ ok: false, error: 'El apartamento no existe en este edificio. Elegí uno de la lista.' });
    }
  }

  // ¿Hay titular aprobado y ocupación vigente en este apto?
  const titularExistente = await Usuario.findOne({
    edificio_id,
    apartamento,
    rol_apto: 'titular',
    estado_aprobacion: 'aprobado',
    activo: true,
  }).lean();

  // Todo nuevo registro queda pendiente; el admin debe aprobar.
  // - Si hay titular: el nuevo se marca miembro + pendiente (espera aprobación del titular o admin).
  // - Si NO hay titular (apto vacío o tras cambio de inquilino): queda pendiente sin titularidad;
  //   el admin lo confirma titular desde el panel (evita que un randomer se registre y tome el apto).
  const campos = {
    email,
    password,
    nombre,
    telefono,
    apartamento,
    rol: rol || 'residente',
    edificio_id,
    unidad,
    rol_apto: 'miembro',
    estado_aprobacion: 'pendiente',
    aprobado_por: null,
    aprobado_en: null,
  };

  const usuario = await Usuario.create(campos);
  const token = generarToken(usuario);
  const saldo = await obtenerSaldo(usuario.usuario_id);

  // Notificar al titular (si existe) que hay un nuevo pendiente
  if (titularExistente?.email) {
    const { subject, html } = nuevoMiembroPendiente({
      apartamento, nuevoNombre: nombre, nuevoEmail: email,
    });
    notificar({
      tipo: 'nuevo_miembro_pendiente',
      destinatario_usuario_id: titularExistente.usuario_id,
      destinatario_email: titularExistente.email,
      canal: 'email',
      subject, html,
      relacionado: { tipo: 'usuario', ref_id: usuario.usuario_id },
    }).catch((e) => console.warn('No se pudo notificar titular:', e.message));
  }

  res.status(201).json({
    ok: true,
    token,
    saldo,
    usuario: resumirUsuario(usuario),
    requiere_aprobacion: true,
    titular_nombre: titularExistente?.nombre || null,
    apto_sin_titular: !titularExistente, // para que la app muestre el mensaje correcto
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

async function resetSolicitar(req, res) {
  const { email } = req.body || {};
  const emailNorm = String(email || '').trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const respuestaGenerica = () => res.json({
    ok: true,
    message: 'Si el email está registrado, vas a recibir un correo con las instrucciones.',
  });
  if (!emailNorm || !emailRegex.test(emailNorm)) return respuestaGenerica();

  const usuario = await Usuario.findOne({ email: emailNorm, activo: true });
  if (!usuario) return respuestaGenerica();

  const haceUnaHora = new Date(Date.now() - 60 * 60 * 1000);
  const recientes = await PasswordReset.countDocuments({ usuario_id: usuario.usuario_id, creado: { $gte: haceUnaHora } });
  if (recientes >= RESET_RATE_LIMIT) return respuestaGenerica();

  await PasswordReset.updateMany(
    { usuario_id: usuario.usuario_id, usado: false },
    { $set: { usado: true, usado_en: new Date() } }
  );

  const token = crypto.randomBytes(32).toString('hex');
  const expira_en = new Date(Date.now() + RESET_TTL_MIN * 60 * 1000);
  await PasswordReset.create({
    token, usuario_id: usuario.usuario_id, email: emailNorm,
    expira_en, ip_origen: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null,
  });

  const link = `${PANEL_URL}/reset/${token}`;
  const { subject, html } = tplPasswordReset({ nombre: usuario.nombre, link });
  notificar({
    tipo: 'password_reset',
    destinatario_usuario_id: usuario.usuario_id,
    destinatario_email: usuario.email,
    canal: 'email',
    subject, html,
    relacionado: { tipo: 'usuario', ref_id: usuario.usuario_id },
  }).catch((e) => console.warn('No se pudo enviar mail de reset:', e.message));

  return respuestaGenerica();
}

async function resetConfirmar(req, res) {
  const { token, password_nueva } = req.body || {};
  if (!token || !password_nueva) {
    return res.status(400).json({ ok: false, error: 'token y password_nueva son requeridos' });
  }
  if (String(password_nueva).length < 6) {
    return res.status(400).json({ ok: false, error: 'La contraseña debe tener al menos 6 caracteres' });
  }

  const reset = await PasswordReset.findOne({ token });
  if (!reset) return res.status(400).json({ ok: false, error: 'Link inválido o ya utilizado' });
  if (reset.usado) return res.status(400).json({ ok: false, error: 'Este link ya fue utilizado' });
  if (reset.expira_en < new Date()) return res.status(400).json({ ok: false, error: 'El link expiró. Solicitá uno nuevo.' });

  const usuario = await Usuario.findOne({ usuario_id: reset.usuario_id, activo: true });
  if (!usuario) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });

  usuario.password = String(password_nueva);
  await usuario.save();

  reset.usado = true;
  reset.usado_en = new Date();
  await reset.save();

  await PasswordReset.updateMany(
    { usuario_id: usuario.usuario_id, usado: false, _id: { $ne: reset._id } },
    { $set: { usado: true, usado_en: new Date() } }
  );

  return res.json({ ok: true, message: 'Contraseña actualizada. Ya podés iniciar sesión.' });
}
