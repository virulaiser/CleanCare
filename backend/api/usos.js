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

    const usos = await Uso.find(filter).sort({ fecha: -1 }).lean();
    res.json({ ok: true, total: usos.length, usos });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};
