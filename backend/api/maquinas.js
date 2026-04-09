const crypto = require('crypto');
const connectDB = require('../lib/mongodb');
const Maquina = require('../models/Maquina');

module.exports = async (req, res) => {
  try {
    await connectDB();

    if (req.method === 'GET') {
      return await listar(req, res);
    }
    if (req.method === 'POST') {
      return await crear(req, res);
    }
    if (req.method === 'DELETE') {
      return await eliminar(req, res);
    }

    return res.status(405).json({ ok: false, error: 'Método no permitido' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};

async function listar(req, res) {
  const { edificioId } = req.query;

  if (!edificioId) {
    return res.status(400).json({ ok: false, error: 'Falta parámetro: edificioId' });
  }

  const maquinas = await Maquina.find({ edificio_id: edificioId, activa: true }).lean();
  res.json({ ok: true, total: maquinas.length, maquinas });
}

async function crear(req, res) {
  const { nombre, tipo, ip_local, edificio_id } = req.body;

  if (!nombre || !tipo || !ip_local || !edificio_id) {
    return res.status(400).json({ ok: false, error: 'Faltan campos: nombre, tipo, ip_local, edificio_id' });
  }

  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipRegex.test(ip_local)) {
    return res.status(400).json({ ok: false, error: 'Formato de IP inválido (ej: 192.168.1.45)' });
  }

  if (!['lavarropas', 'secadora'].includes(tipo)) {
    return res.status(400).json({ ok: false, error: 'Tipo debe ser "lavarropas" o "secadora"' });
  }

  // Generar código alfanumérico: prefijo por tipo + 6 chars random
  const prefijo = tipo === 'secadora' ? 'SEC' : 'LAV';
  const sufijo = crypto.randomBytes(3).toString('hex').toUpperCase();
  const maquina_id = `${prefijo}-${sufijo}`;

  const maquina = await Maquina.create({
    maquina_id,
    edificio_id,
    tipo,
    ip_local,
    nombre,
    activa: true,
  });

  res.status(201).json({ ok: true, maquina });
}

async function eliminar(req, res) {
  const { maquinaId } = req.query;

  if (!maquinaId) {
    return res.status(400).json({ ok: false, error: 'Falta parámetro: maquinaId' });
  }

  const result = await Maquina.findOneAndUpdate(
    { maquina_id: maquinaId },
    { activa: false },
    { new: true }
  );

  if (!result) {
    return res.status(404).json({ ok: false, error: 'Máquina no encontrada' });
  }

  res.json({ ok: true, maquina: result });
}
