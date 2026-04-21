const connectDB = require('../lib/mongodb');
const Edificio = require('../models/Edificio');
const Unidad = require('../models/Unidad');

const LETRAS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

function generarCodigosUnidades(pisos, aptos_por_piso, nomenclatura) {
  const unidades = [];
  for (let p = 1; p <= pisos; p++) {
    for (let n = 1; n <= aptos_por_piso; n++) {
      let codigo;
      if (nomenclatura === 'letras') {
        if (n > LETRAS.length) throw new Error(`No se puede usar nomenclatura por letras con más de ${LETRAS.length} aptos por piso`);
        codigo = `${p}${LETRAS[n - 1]}`;
      } else {
        // Numerica: piso * 100 + número. Si aptos > 99 no hay ambigüedad garantizada.
        codigo = `${p * 100 + n}`;
      }
      unidades.push({ codigo, piso: p, numero_apto: n, es_extra: false, tipo_extra: null });
    }
  }
  return unidades;
}

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

// GET /api/edificios — público
async function listar(req, res) {
  const edificios = await Edificio.find({ activo: true })
    .select('edificio_id nombre direccion admin_nombre admin_telefono pisos aptos_por_piso nomenclatura extras')
    .sort({ nombre: 1 })
    .lean();
  res.json({ ok: true, edificios });
}

// POST /api/edificios — admin only; genera unidades si se envían pisos/aptos
async function crear(req, res) {
  const { nombre, direccion, admin_nombre, admin_telefono, pisos, aptos_por_piso, nomenclatura, extras } = req.body;

  if (!nombre) {
    return res.status(400).json({ ok: false, error: 'Falta campo: nombre' });
  }

  const nomen = nomenclatura === 'letras' ? 'letras' : 'numerica';
  const p = Number.isInteger(pisos) && pisos > 0 ? pisos : 0;
  const a = Number.isInteger(aptos_por_piso) && aptos_por_piso > 0 ? aptos_por_piso : 0;

  if (nomen === 'letras' && a > LETRAS.length) {
    return res.status(400).json({ ok: false, error: `Nomenclatura por letras no soporta más de ${LETRAS.length} aptos por piso` });
  }

  const edificio = await Edificio.create({
    nombre, direccion, admin_nombre, admin_telefono,
    pisos: p, aptos_por_piso: a, nomenclatura: nomen,
    extras: Array.isArray(extras) ? extras.filter(e => e?.codigo).map(e => ({ codigo: e.codigo, tipo: e.tipo === 'portero' ? 'portero' : 'otro' })) : [],
  });

  // Generar unidades (residenciales + extras)
  const codigos = p && a ? generarCodigosUnidades(p, a, nomen) : [];
  const extraDocs = (edificio.extras || []).map(e => ({
    codigo: e.codigo, piso: null, numero_apto: null, es_extra: true, tipo_extra: e.tipo,
  }));
  const docs = [...codigos, ...extraDocs].map(u => ({ ...u, edificio_id: edificio.edificio_id }));
  if (docs.length > 0) {
    try {
      await Unidad.insertMany(docs, { ordered: false });
    } catch (err) {
      // Duplicados o similar — no abortamos la creación del edificio
      console.warn('Warning al crear unidades:', err.message);
    }
  }

  res.status(201).json({ ok: true, edificio, unidades_creadas: docs.length });
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

module.exports.generarCodigosUnidades = generarCodigosUnidades;
