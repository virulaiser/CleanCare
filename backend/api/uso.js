const connectDB = require('../lib/mongodb');
const Uso = require('../models/Uso');
const Transaccion = require('../models/Transaccion');
const ConfigEdificio = require('../models/ConfigEdificio');
const { obtenerSaldo } = require('./billetera');

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

// Obtener costo de uso según tipo y edificio
async function obtenerCosto(edificio_id, tipo) {
  const config = await ConfigEdificio.findOne({ edificio_id }).lean();
  if (!config) return 1; // default
  return tipo === 'secadora' ? (config.costo_secado || 1) : (config.costo_lavado || 1);
}

// POST /api/uso — Registrar inicio de un ciclo
async function crear(req, res) {
  const { maquina_id, edificio_id, duracion_min, tipo } = req.body;
  const residente_id = req.usuario.apartamento || req.usuario.unidad || req.usuario.email;
  const usuario_id = req.usuario.usuario_id;
  const tipoMaquina = tipo || 'lavarropas';

  if (!maquina_id || !edificio_id || !duracion_min) {
    return res.status(400).json({ ok: false, error: 'Faltan campos requeridos: maquina_id, edificio_id, duracion_min' });
  }

  // Verificar saldo
  const costo = await obtenerCosto(edificio_id, tipoMaquina);
  const saldo = await obtenerSaldo(usuario_id);

  if (saldo < costo) {
    return res.status(400).json({ ok: false, error: 'Saldo insuficiente', saldo, costo });
  }

  const uso = await Uso.create({
    maquina_id,
    edificio_id,
    tipo: tipoMaquina,
    duracion_min,
    residente_id,
    estado: 'activo',
    fecha_inicio: new Date(),
    completado: false,
  });

  // Descontar crédito
  await Transaccion.create({
    usuario_id,
    edificio_id,
    tipo: 'uso_maquina',
    cantidad: -costo,
    descripcion: `Uso ${maquina_id} (${tipoMaquina})`,
    referencia_id: uso._id.toString(),
    creado_por: 'sistema'
  });

  const nuevo_saldo = saldo - costo;
  res.status(201).json({ ok: true, uso, saldo: nuevo_saldo });
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

  // Devolver crédito en cancelación o avería
  if (estado === 'cancelado' || estado === 'averia') {
    const costo = await obtenerCosto(uso.edificio_id, uso.tipo);
    const usuario_id = req.usuario.usuario_id;

    await Transaccion.create({
      usuario_id,
      edificio_id: uso.edificio_id,
      tipo: 'devolucion',
      cantidad: costo,
      descripcion: `Devolución por ${estado}: ${uso.maquina_id}`,
      referencia_id: uso._id.toString(),
      creado_por: 'sistema'
    });
  }

  res.json({ ok: true, uso });
}
