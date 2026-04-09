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

module.exports = { generarToken, verificarToken, soloAdmin };
