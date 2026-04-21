/**
 * Fixea EDI-NORTE:
 *  - costo_lavado y costo_secado → 1 ficha
 *  - compensa con +9 fichas el uso_maquina -10 más reciente (deja efecto -1)
 */
const path = require('path');
require(path.resolve(__dirname, '../backend/node_modules/dotenv')).config({
  path: path.resolve(__dirname, '../.env'),
});
const mongoose = require(path.resolve(__dirname, '../backend/node_modules/mongoose'));

const EDI = 'EDI-NORTE';

async function main() {
  const dry = process.argv.includes('--dry');
  await mongoose.connect(process.env.MONGODB_URI);

  const ConfigEdificio = require('../backend/models/ConfigEdificio');
  const Transaccion = require('../backend/models/Transaccion');

  // 1) Config
  const cfgBefore = await ConfigEdificio.findOne({ edificio_id: EDI }).lean();
  console.log(`Config ANTES: costo_lavado=${cfgBefore?.costo_lavado}, costo_secado=${cfgBefore?.costo_secado}`);
  if (!dry) {
    await ConfigEdificio.updateOne(
      { edificio_id: EDI },
      { $set: { costo_lavado: 1, costo_secado: 1, actualizado: new Date() } }
    );
    const cfgAfter = await ConfigEdificio.findOne({ edificio_id: EDI }).lean();
    console.log(`Config DESPUÉS: costo_lavado=${cfgAfter.costo_lavado}, costo_secado=${cfgAfter.costo_secado}`);
  }

  // 2) Compensación de las tx uso_maquina con |cantidad| > 1
  //    (dejan efecto neto -1 ficha por ciclo)
  const malas = await Transaccion.find({
    edificio_id: EDI,
    tipo: 'uso_maquina',
    cantidad: { $lt: -1 },
  }).lean();

  console.log(`\nTx uso_maquina con |cantidad| > 1: ${malas.length}`);
  for (const tx of malas) {
    const ajuste = -1 - Number(tx.cantidad); // tx=-10 → ajuste = -1 - (-10) = +9
    const referencia = `${tx._id.toString()}_fix_v2`;
    const existe = await Transaccion.findOne({ referencia_id: referencia });
    if (existe) {
      console.log(`  ${tx._id} | cantidad=${tx.cantidad} | YA corregida`);
      continue;
    }
    console.log(`  ${tx._id} | apto=${tx.apartamento} | cantidad=${tx.cantidad} | ajuste=+${ajuste}`);
    if (!dry) {
      await Transaccion.create({
        usuario_id: tx.usuario_id,
        edificio_id: tx.edificio_id,
        apartamento: tx.apartamento,
        tipo: 'ajuste_admin',
        cantidad: ajuste,
        descripcion: `Corrección costo_lavado erróneo (era ${Math.abs(tx.cantidad)}, debía ser 1)`,
        referencia_id: referencia,
        creado_por: 'sistema',
      });
    }
  }

  // 3) Reporte saldos
  const aptos = await Transaccion.aggregate([
    { $match: { edificio_id: EDI } },
    { $group: { _id: '$apartamento', saldo: { $sum: '$cantidad' } } },
    { $sort: { _id: 1 } },
  ]);
  console.log(`\nSaldos por apto en ${EDI}:`);
  for (const a of aptos) console.log(`  ${a._id}: ${a.saldo}`);

  await mongoose.disconnect();
  console.log(dry ? '\n[DRY RUN]' : '\n[APLICADO]');
}

main().catch((e) => { console.error(e); process.exit(1); });
