const connectDB = require('../lib/mongodb');
const Uso = require('../models/Uso');

// POST /api/uso — Registrar un uso de máquina
module.exports = async (req, res) => {
  try {
    await connectDB();

    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Método no permitido' });
    }

    const { maquina_id, edificio_id, duracion_min, tipo } = req.body;
    const residente_id = req.usuario.unidad || req.usuario.email;

    if (!maquina_id || !edificio_id || !duracion_min) {
      return res.status(400).json({ ok: false, error: 'Faltan campos requeridos: maquina_id, edificio_id, duracion_min' });
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
