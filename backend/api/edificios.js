const connectDB = require('../lib/mongodb');
const Edificio = require('../models/Edificio');

module.exports = async (req, res) => {
  try {
    await connectDB();

    if (req.method === 'GET') return await listar(req, res);
    if (req.method === 'POST') return await crear(req, res);
    if (req.method === 'DELETE') return await eliminar(req, res);

    return res.status(405).json({ ok: false, error: 'Método no permitido' });
  } catch (err) {
    console.error('Error edificios:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
};

// GET /api/edificios — público, para dropdowns de registro
async function listar(req, res) {
  const edificios = await Edificio.find({ activo: true })
    .select('edificio_id nombre direccion admin_nombre admin_telefono')
    .sort({ nombre: 1 })
    .lean();
  res.json({ ok: true, edificios });
}

// POST /api/edificios — admin only
async function crear(req, res) {
  const { nombre, direccion, admin_nombre, admin_telefono } = req.body;

  if (!nombre) {
    return res.status(400).json({ ok: false, error: 'Falta campo: nombre' });
  }

  const edificio = await Edificio.create({ nombre, direccion, admin_nombre, admin_telefono });
  res.status(201).json({ ok: true, edificio });
}

// DELETE /api/edificios?edificioId=X — admin only (soft-delete)
async function eliminar(req, res) {
  const { edificioId } = req.query;
  if (!edificioId) {
    return res.status(400).json({ ok: false, error: 'Falta parámetro: edificioId' });
  }

  const result = await Edificio.findOneAndUpdate(
    { edificio_id: edificioId },
    { activo: false },
    { new: true }
  );

  if (!result) {
    return res.status(404).json({ ok: false, error: 'Edificio no encontrado' });
  }

  res.json({ ok: true, edificio: result });
}
