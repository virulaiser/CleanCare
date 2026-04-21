/**
 * One-shot: elimina la(s) transaccion(es) tipo 'uso_maquina' con cantidad
 * decimal (p.ej. -9.56) del apto 404 de EDI-NORTE, y recalcula el saldo.
 *
 * Uso:
 *   node scripts/fix-tx-404.js [--dry]
 */
const path = require('path');
require(path.resolve(__dirname, '../backend/node_modules/dotenv')).config({
  path: path.resolve(__dirname, '../.env'),
});
const mongoose = require(path.resolve(__dirname, '../backend/node_modules/mongoose'));

const EDIFICIO = 'EDI-NORTE';
const APTO = '404';

async function main() {
  const dry = process.argv.includes('--dry');
  if (!process.env.MONGODB_URI) throw new Error('Falta MONGODB_URI');
  await mongoose.connect(process.env.MONGODB_URI);
  const Transaccion = require('../backend/models/Transaccion');

  const candidatas = await Transaccion.find({
    edificio_id: EDIFICIO,
    apartamento: APTO,
    tipo: 'uso_maquina',
  }).lean();

  const malas = candidatas.filter((t) => {
    const n = Number(t.cantidad);
    return Number.isFinite(n) && n !== Math.trunc(n);
  });

  console.log(`Candidatas uso_maquina en ${EDIFICIO}/${APTO}: ${candidatas.length}`);
  console.log(`Con cantidad decimal: ${malas.length}`);
  for (const t of malas) {
    console.log(` - ${t.transaccion_id} | cantidad=${t.cantidad} | fecha=${t.fecha?.toISOString()} | desc=${t.descripcion}`);
  }

  if (dry) {
    console.log('\n[DRY RUN] — no se elimina nada.');
  } else if (malas.length > 0) {
    const ids = malas.map((t) => t._id);
    const r = await Transaccion.deleteMany({ _id: { $in: ids } });
    console.log(`\nEliminadas: ${r.deletedCount}`);
  }

  // Saldo final
  const agg = await Transaccion.aggregate([
    { $match: { edificio_id: EDIFICIO, apartamento: APTO } },
    { $group: { _id: null, saldo: { $sum: '$cantidad' } } },
  ]);
  console.log(`Saldo actual de ${EDIFICIO}/${APTO}: ${agg[0]?.saldo ?? 0}`);

  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
