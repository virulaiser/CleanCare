const connectDB = require('../lib/mongodb');
const Uso = require('../models/Uso');

// GET /api/resumen/:edificioId/:mes/:anio — Resumen mensual para facturación
module.exports = async (req, res) => {
  try {
    await connectDB();

    if (req.method !== 'GET') {
      return res.status(405).json({ ok: false, error: 'Método no permitido' });
    }

    const { edificioId, mes, anio } = req.query;

    if (!edificioId || !mes || !anio) {
      return res.status(400).json({ ok: false, error: 'Faltan parámetros: edificioId, mes, anio' });
    }

    const inicio = new Date(Number(anio), Number(mes) - 1, 1);
    const fin = new Date(Number(anio), Number(mes), 1);

    const resumen = await Uso.aggregate([
      { $match: { edificio_id: edificioId, fecha: { $gte: inicio, $lt: fin } } },
      { $group: {
        _id: '$maquina_id',
        total_usos: { $sum: 1 },
        minutos_totales: { $sum: '$duracion_min' }
      }}
    ]);

    res.json({ ok: true, edificio: edificioId, mes, anio, resumen });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};
