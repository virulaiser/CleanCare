const connectDB = require('../lib/mongodb');
const Tip = require('../models/Tip');

module.exports = async (req, res) => {
  try {
    await connectDB();

    if (req.method === 'GET') return await listar(req, res);
    if (req.method === 'POST') return await crear(req, res);
    if (req.method === 'DELETE') return await eliminar(req, res);

    return res.status(405).json({ ok: false, error: 'Método no permitido' });
  } catch (err) {
    console.error('Error tips:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
};

// GET /api/tips — público (la app lo necesita)
// ?random=true&tipo=lavarropas → retorna 1 tip random para ese tipo
async function listar(req, res) {
  const { random, tipo } = req.query;

  if (random === 'true') {
    const filter = { activo: true };
    if (tipo && tipo !== 'ambos') {
      filter.$or = [{ tipo }, { tipo: 'ambos' }];
    }
    const count = await Tip.countDocuments(filter);
    if (count === 0) return res.json({ ok: true, tip: null });
    const skip = Math.floor(Math.random() * count);
    const tip = await Tip.findOne(filter).skip(skip).lean();
    return res.json({ ok: true, tip });
  }

  const tips = await Tip.find({ activo: true }).sort({ creado: -1 }).lean();
  res.json({ ok: true, tips });
}

// POST /api/tips — admin only
async function crear(req, res) {
  const { texto, tipo } = req.body;
  if (!texto) return res.status(400).json({ ok: false, error: 'Falta campo: texto' });

  const tip = await Tip.create({ texto, tipo: tipo || 'ambos' });
  res.status(201).json({ ok: true, tip });
}

// DELETE /api/tips?id=X — admin only (hard delete)
async function eliminar(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ ok: false, error: 'Falta parámetro: id' });

  const result = await Tip.findByIdAndDelete(id);
  if (!result) return res.status(404).json({ ok: false, error: 'Tip no encontrado' });

  res.json({ ok: true });
}
