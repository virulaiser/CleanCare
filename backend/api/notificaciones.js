const connectDB = require('../lib/mongodb');
const Notificacion = require('../models/Notificacion');

module.exports = async (req, res) => {
  try {
    await connectDB();

    // GET /api/notificaciones — admin o admin_edificio ven historial
    if (req.method === 'GET') {
      if (!['admin', 'admin_edificio'].includes(req.usuario.rol)) {
        return res.status(403).json({ ok: false, error: 'Solo admin' });
      }
      const filter = {};
      if (req.query.tipo) filter.tipo = req.query.tipo;
      if (req.query.email) filter.destinatario_email = req.query.email;
      if (req.query.estado) filter.estado = req.query.estado;
      const limit = parseInt(req.query.limite, 10) || 100;
      const notificaciones = await Notificacion.find(filter)
        .sort({ creada: -1 }).limit(limit)
        .select('-body_html').lean();
      return res.json({ ok: true, notificaciones });
    }

    return res.status(405).json({ ok: false, error: 'Método no permitido' });
  } catch (err) {
    console.error('Error notificaciones:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
};
