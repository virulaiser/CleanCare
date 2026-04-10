const mongoose = require('mongoose');
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
  const { nombre, tipo, edificio_id } = req.body;

  if (!nombre || !tipo || !edificio_id) {
    return res.status(400).json({ ok: false, error: 'Faltan campos: nombre, tipo, edificio_id' });
  }

  if (!['lavarropas', 'secadora'].includes(tipo)) {
    return res.status(400).json({ ok: false, error: 'Tipo debe ser "lavarropas" o "secadora"' });
  }

  // Generar código único usando ObjectId (24 hex chars)
  const maquina_id = new mongoose.Types.ObjectId().toHexString();

  const maquina = await Maquina.create({
    maquina_id,
    edificio_id,
    tipo,
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
