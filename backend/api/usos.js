const connectDB = require('../lib/mongodb');
const Uso = require('../models/Uso');

// GET /api/usos — Listar todos los usos
module.exports = async (req, res) => {
  try {
    await connectDB();

    if (req.method !== 'GET') {
      return res.status(405).json({ ok: false, error: 'Método no permitido' });
    }

    const usos = await Uso.find().sort({ fecha: -1 }).lean();
    res.json({ ok: true, total: usos.length, usos });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};
