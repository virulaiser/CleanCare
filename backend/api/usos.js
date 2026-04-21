const connectDB = require('../lib/mongodb');
const Uso = require('../models/Uso');

// GET /api/usos — Listar usos (filtrado por residente si ?mis=true)
module.exports = async (req, res) => {
  try {
    await connectDB();

    if (req.method !== 'GET') {
      return res.status(405).json({ ok: false, error: 'Método no permitido' });
    }

    const filter = {};

    // Si se pide "mis usos", filtrar por residente_id del token
    if (req.query.mis === 'true' && req.usuario) {
      const residente_id = req.usuario.apartamento || req.usuario.unidad || req.usuario.email;
      filter.residente_id = residente_id;
    }

    // Filtro admin: por edificio y/o rango de fechas
    if (req.query.edificioId) filter.edificio_id = req.query.edificioId;
    if (req.query.mes && req.query.anio) {
      const m = parseInt(req.query.mes, 10);
      const y = parseInt(req.query.anio, 10);
      if (m >= 1 && m <= 12 && y > 2000) {
        filter.fecha_inicio = { $gte: new Date(y, m - 1, 1), $lt: new Date(y, m, 1) };
      }
    }

    // Seguridad: admin_edificio solo puede ver los suyos
    if (req.usuario?.rol === 'admin_edificio') {
      filter.edificio_id = req.usuario.edificio_id;
    }

    const limite = parseInt(req.query.limite, 10) || 500;
    const usos = await Uso.find(filter).sort({ fecha: -1 }).limit(limite).lean();
    res.json({ ok: true, total: usos.length, usos });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};
