const connectDB = require('../lib/mongodb');
const Dispositivo = require('../models/Dispositivo');
const Maquina = require('../models/Maquina');

function generarMaquinaId(tipo) {
  const prefix = tipo === 'secadora' ? 'SEC' : 'LAV';
  const rand = Math.random().toString(16).slice(2, 8).toUpperCase();
  return `${prefix}-${rand}`;
}

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

// POST /api/dispositivos — crea con UUIDs autogeneradas + N máquinas (opcional)
// body: { tipo_hw, ble_name, ubicacion, edificio_id, maquinas: [{tipo: 'lavarropas'|'secadora'}] }
async function crear(req, res) {
  const { tipo_hw, ble_name, ubicacion, edificio_id, maquinas = [] } = req.body;
  const suffix = 'bb73-4e02-8f1d-a0b0c0d0e0f';

  // Reintenta ante colisión de esp32_id (unique index en el modelo gatilla E11000)
  for (let intento = 0; intento < 5; intento++) {
    const ultimo = await Dispositivo.findOne().sort({ esp32_id: -1 }).lean();
    const n = (ultimo ? parseInt(ultimo.esp32_id, 10) + 1 : 1) + intento;
    const esp32_id = String(n).padStart(3, '0');
    const prefix = `cc7a5${esp32_id}`;

    try {
      // Crear N máquinas enlazadas si viene el array
      const maquinasCreadas = [];
      if (Array.isArray(maquinas) && maquinas.length > 0 && edificio_id) {
        let lavCount = 0, secCount = 0;
        for (let i = 0; i < maquinas.length; i++) {
          const tipo = maquinas[i].tipo === 'secadora' ? 'secadora' : 'lavarropas';
          const idx = tipo === 'secadora' ? ++secCount : ++lavCount;
          const maquina_id = generarMaquinaId(tipo);
          const nombre = `${tipo === 'secadora' ? 'Secadora' : 'Lavarropas'} ${idx} — ${ubicacion || esp32_id}`;
          const m = await Maquina.create({
            maquina_id, edificio_id, tipo, nombre,
            dispositivo_id: esp32_id, relay_pin: i,
          });
          maquinasCreadas.push(m.toObject());
        }
      }

      const dispositivo = await Dispositivo.create({
        esp32_id,
        tipo_hw: tipo_hw || 'esp32',
        ble_name: ble_name || 'CleanCare-ESP32',
        service_uuid: `${prefix}-${suffix}1`,
        control_uuid: `${prefix}-${suffix}2`,
        status_uuid:  `${prefix}-${suffix}3`,
        ubicacion: ubicacion || '',
        maquinas: maquinasCreadas.map((m) => m.maquina_id),
        maquina_asignada: maquinasCreadas[0]?.maquina_id || null,  // legacy
        edificio_id: edificio_id || null,
      });

      return res.status(201).json({ ok: true, dispositivo, maquinas: maquinasCreadas });
    } catch (err) {
      if (err.code !== 11000) throw err;
    }
  }
  res.status(500).json({ ok: false, error: 'No se pudo generar esp32_id único' });
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
