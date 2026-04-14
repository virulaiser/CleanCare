const connectDB = require('../lib/mongodb');
const Dispositivo = require('../models/Dispositivo');

module.exports = async (req, res) => {
  try {
    await connectDB();

    if (req.method === 'GET') return await listar(req, res);
    if (req.method === 'POST') return await crear(req, res);
    if (req.method === 'PATCH') return await actualizar(req, res);
    if (req.method === 'DELETE') return await eliminar(req, res);

    return res.status(405).json({ ok: false, error: 'Método no permitido' });
  } catch (err) {
    console.error('Error dispositivos:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
};

// GET /api/dispositivos
async function listar(req, res) {
  const { edificioId } = req.query;
  const filter = { activo: true };
  if (edificioId) filter.edificio_id = edificioId;
  const dispositivos = await Dispositivo.find(filter).sort({ esp32_id: 1 }).lean();
  res.json({ ok: true, dispositivos });
}

// Genera el próximo esp32_id incremental: "001", "002", ...
async function siguienteEsp32Id() {
  const ultimo = await Dispositivo.findOne().sort({ esp32_id: -1 }).lean();
  const n = ultimo ? parseInt(ultimo.esp32_id, 10) + 1 : 1;
  return String(n).padStart(3, '0');
}

// POST /api/dispositivos — crea con UUIDs autogeneradas
async function crear(req, res) {
  const { tipo_hw, ble_name, ubicacion, maquina_asignada, edificio_id } = req.body;
  const esp32_id = await siguienteEsp32Id();

  // Esquema: cc7a5XXX-bb73-4e02-8f1d-a0b0c0d0e0fY
  const prefix = `cc7a5${esp32_id}`;
  const suffix = 'bb73-4e02-8f1d-a0b0c0d0e0f';

  const dispositivo = await Dispositivo.create({
    esp32_id,
    tipo_hw: tipo_hw || 'esp32',
    ble_name: ble_name || 'CleanCare-ESP32',
    service_uuid: `${prefix}-${suffix}1`,
    control_uuid: `${prefix}-${suffix}2`,
    status_uuid:  `${prefix}-${suffix}3`,
    ubicacion: ubicacion || '',
    maquina_asignada: maquina_asignada || null,
    edificio_id: edificio_id || null,
  });

  res.status(201).json({ ok: true, dispositivo });
}

// PATCH /api/dispositivos?id=X — edita ubicacion / maquina_asignada
async function actualizar(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ ok: false, error: 'Falta id' });

  const campos = ['ubicacion', 'maquina_asignada', 'edificio_id', 'ble_name', 'activo'];
  const update = {};
  for (const k of campos) if (req.body[k] !== undefined) update[k] = req.body[k];

  const dispositivo = await Dispositivo.findByIdAndUpdate(id, update, { new: true });
  if (!dispositivo) return res.status(404).json({ ok: false, error: 'No encontrado' });
  res.json({ ok: true, dispositivo });
}

// DELETE /api/dispositivos?id=X — soft delete
async function eliminar(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ ok: false, error: 'Falta id' });
  const dispositivo = await Dispositivo.findByIdAndUpdate(id, { activo: false });
  if (!dispositivo) return res.status(404).json({ ok: false, error: 'No encontrado' });
  res.json({ ok: true });
}
