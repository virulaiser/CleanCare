/**
 * Migración one-shot: crea una Ocupación vigente para cada apto que tiene
 * un titular aprobado activo. Idempotente.
 *
 * Uso: node backend/scripts/migrar-ocupaciones.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const connectDB = require('../lib/mongodb');
const Usuario = require('../models/Usuario');
const Ocupacion = require('../models/Ocupacion');

async function migrar() {
  await connectDB();

  const titulares = await Usuario.find({
    rol: 'residente',
    rol_apto: 'titular',
    estado_aprobacion: 'aprobado',
    activo: true,
    apartamento: { $nin: [null, ''] },
    edificio_id: { $nin: [null, ''] },
  }).sort({ creado: 1 }).lean();

  console.log(`Titulares aprobados encontrados: ${titulares.length}`);

  let creadas = 0, existentes = 0;
  for (const t of titulares) {
    const vigente = await Ocupacion.findOne({
      edificio_id: t.edificio_id, apartamento: t.apartamento, hasta: null,
    });
    if (vigente) { existentes++; continue; }

    const miembros = await Usuario.find({
      edificio_id: t.edificio_id, apartamento: t.apartamento,
      activo: true, estado_aprobacion: 'aprobado',
      usuario_id: { $ne: t.usuario_id },
    }, { usuario_id: 1 }).lean();

    await Ocupacion.create({
      edificio_id: t.edificio_id, apartamento: t.apartamento,
      desde: t.aprobado_en || t.creado || new Date(),
      titular_usuario_id: t.usuario_id,
      miembros_usuario_ids: miembros.map(m => m.usuario_id),
    });
    creadas++;
  }

  console.log(`\n=== Reporte ===`);
  console.log(`Ocupaciones creadas:    ${creadas}`);
  console.log(`Ya existían vigentes:   ${existentes}`);
}

migrar()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => mongoose.disconnect());
