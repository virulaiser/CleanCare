const connectDB = require('../lib/mongodb');
const Uso = require('../models/Uso');

// POST /api/uso — Registrar un uso de máquina
module.exports = async (req, res) => {
  try {
    await connectDB();

    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Método no permitido' });
    }

    const { maquina_id, edificio_id, duracion_min, residente_id, tipo } = req.body;

    if (!maquina_id || !edificio_id || !duracion_min || !residente_id) {
      return res.status(400).json({ ok: false, error: 'Faltan campos requeridos: maquina_id, edificio_id, duracion_min, residente_id' });
    }

    const uso = await Uso.create({
      maquina_id,
      edificio_id,
      tipo: tipo || 'lavarropas',
      duracion_min,
      residente_id
    });

    res.status(201).json({ ok: true, uso });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};
