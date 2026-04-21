const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'cleancare-dev-secret';
const JWT_EXPIRES = '7d';

function generarToken(usuario) {
  return jwt.sign(
    {
      id: usuario._id,
      usuario_id: usuario.usuario_id,
      email: usuario.email,
      rol: usuario.rol,
      edificio_id: usuario.edificio_id,
      unidad: usuario.unidad,
      apartamento: usuario.apartamento,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

function verificarToken(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, error: 'Token no proporcionado' });
  }

  try {
    const token = header.split(' ')[1];
    req.usuario = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ ok: false, error: 'Token inválido o expirado' });
  }
}

function soloAdmin(req, res, next) {
  if (req.usuario.rol !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Acceso solo para administradores' });
  }
  next();
}

// Permite admin global O admin_edificio. Para admin_edificio, pisa cualquier
// edificioId del query con el propio para garantizar que solo ve su edificio.
function soloAdminOEdificio(req, res, next) {
  if (req.usuario.rol === 'admin') return next();
  if (req.usuario.rol === 'admin_edificio') {
    if (!req.usuario.edificio_id) {
      return res.status(403).json({ ok: false, error: 'admin_edificio sin edificio asignado' });
    }
    // Fuerza el filtro a su edificio
    if (req.query) req.query.edificioId = req.usuario.edificio_id;
    if (req.body && typeof req.body === 'object' && req.body.edificio_id) {
      // No puede pisar otro edificio
      if (req.body.edificio_id !== req.usuario.edificio_id) {
        return res.status(403).json({ ok: false, error: 'No podés operar sobre otro edificio' });
      }
    }
    return next();
  }
  return res.status(403).json({ ok: false, error: 'Acceso solo para administradores' });
}

function esAdmin(usuario) { return usuario?.rol === 'admin'; }
function esAdminEdificio(usuario) { return usuario?.rol === 'admin_edificio'; }

module.exports = { generarToken, verificarToken, soloAdmin, soloAdminOEdificio, esAdmin, esAdminEdificio };
