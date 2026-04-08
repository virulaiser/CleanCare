const connectDB = require('../lib/mongodb');
const Maquina = require('../models/Maquina');

// GET /api/maquinas/:edificioId — Listar máquinas del edificio
module.exports = async (req, res) => {
  try {
    await connectDB();

    if (req.method !== 'GET') {
      return res.status(405).json({ ok: false, error: 'Método no permitido' });
    }

    const { edificioId } = req.query;

    if (!edificioId) {
      return res.status(400).json({ ok: false, error: 'Falta parámetro: edificioId' });
    }

    const maquinas = await Maquina.find({ edificio_id: edificioId, activa: true }).lean();
    res.json({ ok: true, total: maquinas.length, maquinas });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};
