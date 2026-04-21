/**
 * Migración one-shot: designar titular por apartamento + backfill de `apartamento`
 * en transacciones.
 *
 * Política:
 *  - Por cada (edificio_id, apartamento): el usuario ACTIVO más antiguo pasa a
 *    `rol_apto='titular'` + `estado_aprobacion='aprobado'`.
 *  - El resto queda como `rol_apto='miembro'` + `estado_aprobacion='aprobado'`
 *    (pre-aprobados, ya existían antes del feature).
 *  - Usuarios sin `apartamento` no se tocan (p.ej. el admin global).
 *  - Transacciones: se backfillea `apartamento` desde el usuario_id (si existe).
 *
 * Es idempotente: correrlo varias veces no genera cambios incorrectos.
 *
 * Uso:  node backend/scripts/migrar-titulares.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const connectDB = require('../lib/mongodb');
const Usuario = require('../models/Usuario');
const Transaccion = require('../models/Transaccion');

async function migrarTitulares() {
  await connectDB();

  const usuarios = await Usuario.find({
    activo: true,
    apartamento: { $nin: [null, ''] },
    edificio_id: { $nin: [null, ''] },
  }).sort({ creado: 1 }).lean();

  console.log(`Encontrados ${usuarios.length} usuarios activos con apto.`);

  const grupos = new Map(); // clave `edificio_id::apartamento` → [usuarios]
  for (const u of usuarios) {
    const k = `${u.edificio_id}::${u.apartamento}`;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(u);
  }

  let aptosProcesados = 0;
  let titularesAsignados = 0;
  let miembrosAprobados = 0;
  let sinCambio = 0;

  for (const [clave, grupo] of grupos) {
    aptosProcesados++;
    const [titular, ...miembros] = grupo; // ordenado por `creado` asc

    // Titular
    const cambiosTitular = {};
    if (titular.rol_apto !== 'titular') cambiosTitular.rol_apto = 'titular';
    if (titular.estado_aprobacion !== 'aprobado') cambiosTitular.estado_aprobacion = 'aprobado';
    if (titular.aprobado_por !== null) cambiosTitular.aprobado_por = null;
    if (Object.keys(cambiosTitular).length > 0) {
      await Usuario.updateOne({ _id: titular._id }, { $set: cambiosTitular });
      titularesAsignados++;
    } else {
      sinCambio++;
    }

    // Miembros existentes → pre-aprobados por el titular
    for (const m of miembros) {
      const cambios = {};
      if (m.rol_apto !== 'miembro') cambios.rol_apto = 'miembro';
      if (m.estado_aprobacion !== 'aprobado') cambios.estado_aprobacion = 'aprobado';
      if (!m.aprobado_por) cambios.aprobado_por = titular.usuario_id;
      if (!m.aprobado_en) cambios.aprobado_en = new Date();
      if (Object.keys(cambios).length > 0) {
        await Usuario.updateOne({ _id: m._id }, { $set: cambios });
        miembrosAprobados++;
      } else {
        sinCambio++;
      }
    }
  }

  // Backfill apartamento en transacciones
  const txSinApto = await Transaccion.find({ apartamento: { $in: [null, ''] } }).lean();
  console.log(`Transacciones sin apartamento: ${txSinApto.length}`);
  let txBackfilled = 0;
  // Mapa usuario_id → apartamento para evitar hitear la DB 1 vez por tx
  const mapaUsuarioApto = new Map();
  const usuariosAll = await Usuario.find({}, { usuario_id: 1, apartamento: 1 }).lean();
  for (const u of usuariosAll) mapaUsuarioApto.set(u.usuario_id, u.apartamento);

  for (const tx of txSinApto) {
    const apto = mapaUsuarioApto.get(tx.usuario_id);
    if (!apto) continue;
    await Transaccion.updateOne({ _id: tx._id }, { $set: { apartamento: apto } });
    txBackfilled++;
  }

  console.log('\n=== Reporte ===');
  console.log(`Aptos procesados:      ${aptosProcesados}`);
  console.log(`Titulares asignados:   ${titularesAsignados}`);
  console.log(`Miembros pre-aprobados:${miembrosAprobados}`);
  console.log(`Sin cambios (ya OK):   ${sinCambio}`);
  console.log(`Tx backfilled:         ${txBackfilled}`);
  console.log(`Tx ya con apartamento: ${(await Transaccion.countDocuments({ apartamento: { $nin: [null, ''] } }))}`);
}

migrarTitulares()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => mongoose.disconnect());
