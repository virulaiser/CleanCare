const connectDB = require('../lib/mongodb');
const Uso = require('../models/Uso');

module.exports = async (req, res) => {
  try {
    await connectDB();

    if (req.method === 'POST') return await crear(req, res);
    if (req.method === 'PATCH') return await actualizar(req, res);

    return res.status(405).json({ ok: false, error: 'Método no permitido' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};

// POST /api/uso — Registrar inicio de un ciclo
async function crear(req, res) {
  const { maquina_id, edificio_id, duracion_min, tipo } = req.body;
  const residente_id = req.usuario.apartamento || req.usuario.unidad || req.usuario.email;

  if (!maquina_id || !edificio_id || !duracion_min) {
    return res.status(400).json({ ok: false, error: 'Faltan campos requeridos: maquina_id, edificio_id, duracion_min' });
  }

  const uso = await Uso.create({
    maquina_id,
    edificio_id,
    tipo: tipo || 'lavarropas',
    duracion_min,
    residente_id,
    estado: 'activo',
    fecha_inicio: new Date(),
    completado: false,
  });

  res.status(201).json({ ok: true, uso });
}

// PATCH /api/uso?id=X — Actualizar estado de un ciclo (completado, cancelado, averia)
async function actualizar(req, res) {
  const { id } = req.query;
  const { estado } = req.body;

  if (!id) {
    return res.status(400).json({ ok: false, error: 'Falta parámetro: id' });
  }

  if (!estado || !['completado', 'cancelado', 'averia'].includes(estado)) {
    return res.status(400).json({ ok: false, error: 'Estado debe ser: completado, cancelado o averia' });
  }

  const update = {
    estado,
    fecha_fin: new Date(),
    completado: estado === 'completado',
  };

  const uso = await Uso.findByIdAndUpdate(id, update, { new: true });

  if (!uso) {
    return res.status(404).json({ ok: false, error: 'Uso no encontrado' });
  }

  res.json({ ok: true, uso });
}
