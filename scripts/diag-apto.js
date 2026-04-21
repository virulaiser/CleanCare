/**
 * Diagnóstico rápido: estado de usos activos + saldo por apto.
 *   node scripts/diag-apto.js <edificio_id> <apartamento>
 * Ej: node scripts/diag-apto.js EDI-NORTE 404
 */
const path = require('path');
require(path.resolve(__dirname, '../backend/node_modules/dotenv')).config({
  path: path.resolve(__dirname, '../.env'),
});
const mongoose = require(path.resolve(__dirname, '../backend/node_modules/mongoose'));

async function main() {
  const [, , EDI, APTO] = process.argv;
  if (!EDI || !APTO) { console.error('Uso: node scripts/diag-apto.js <edificio_id> <apto>'); process.exit(1); }
  if (!process.env.MONGODB_URI) throw new Error('Falta MONGODB_URI');
  await mongoose.connect(process.env.MONGODB_URI);

  const Uso = require('../backend/models/Uso');
  const Transaccion = require('../backend/models/Transaccion');
  const Usuario = require('../backend/models/Usuario');

  console.log(`\n=== ${EDI} / Apto ${APTO} ===\n`);

  // Usuarios del apto
  const users = await Usuario.find({ edificio_id: EDI, apartamento: APTO, activo: true }).lean();
  console.log(`Usuarios activos: ${users.length}`);
  for (const u of users) {
    console.log(`  ${u.usuario_id} | ${u.nombre} | rol_apto=${u.rol_apto} | estado=${u.estado_aprobacion}`);
  }

  // Saldo del apto
  const agg = await Transaccion.aggregate([
    { $match: { edificio_id: EDI, apartamento: APTO } },
    { $group: { _id: null, saldo: { $sum: '$cantidad' } } },
  ]);
  console.log(`\nSaldo: ${agg[0]?.saldo ?? 0} fichas`);

  // Usos activos del edificio (por si bloquea maquinas)
  const activos = await Uso.find({ edificio_id: EDI, estado: 'activo' }).lean();
  console.log(`\nUsos con estado='activo' en ${EDI}: ${activos.length}`);
  for (const u of activos) {
    const ageMin = Math.floor((Date.now() - new Date(u.fecha_inicio).getTime()) / 60000);
    console.log(`  _id=${u._id} | maq=${u.maquina_id} | tipo=${u.tipo} | residente=${u.residente_id} | edad=${ageMin}min | dur=${u.duracion_min}min`);
  }

  // Últimas 5 transacciones del apto
  const txs = await Transaccion.find({ edificio_id: EDI, apartamento: APTO }).sort({ fecha: -1 }).limit(5).lean();
  console.log(`\nÚltimas 5 transacciones del apto:`);
  for (const t of txs) {
    console.log(`  ${t.fecha?.toISOString()} | ${t.tipo} | cantidad=${t.cantidad} | ${t.descripcion}`);
  }

  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
