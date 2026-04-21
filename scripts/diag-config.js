const path = require('path');
require(path.resolve(__dirname, '../backend/node_modules/dotenv')).config({
  path: path.resolve(__dirname, '../.env'),
});
const mongoose = require(path.resolve(__dirname, '../backend/node_modules/mongoose'));

async function main() {
  const EDI = process.argv[2] || 'EDI-NORTE';
  await mongoose.connect(process.env.MONGODB_URI);
  const ConfigEdificio = require('../backend/models/ConfigEdificio');
  const cfg = await ConfigEdificio.findOne({ edificio_id: EDI }).lean();
  if (!cfg) { console.log(`Sin config para ${EDI}`); return mongoose.disconnect(); }
  console.log(`\n${EDI}:`);
  console.log(`  costo_lavado: ${cfg.costo_lavado}`);
  console.log(`  costo_secado: ${cfg.costo_secado}`);
  console.log(`  creditos_mensuales: ${cfg.creditos_mensuales}`);
  console.log(`  duracion_lavado: ${cfg.duracion_lavado} min`);
  console.log(`  precio_ficha_residente: ${cfg.precio_ficha_residente}`);
  await mongoose.disconnect();
}
main().catch(console.error);
