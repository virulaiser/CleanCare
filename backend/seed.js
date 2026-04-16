/**
 * Seed script — limpia la BD y crea datos de ejemplo.
 * Uso: node backend/seed.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const connectDB = require('./lib/mongodb');
const Edificio = require('./models/Edificio');
const Maquina = require('./models/Maquina');
const Usuario = require('./models/Usuario');
const Uso = require('./models/Uso');
const Transaccion = require('./models/Transaccion');
const ConfigEdificio = require('./models/ConfigEdificio');
const Tip = require('./models/Tip');
const Dispositivo = require('./models/Dispositivo');

function genMaquinaId(tipo) {
  const prefix = tipo === 'secadora' ? 'SEC' : 'LAV';
  const rand = Math.random().toString(16).slice(2, 8).toUpperCase();
  return `${prefix}-${rand}`;
}

const SUFFIX = 'bb73-4e02-8f1d-a0b0c0d0e0f';

async function seed() {
  await connectDB();
  console.log('Conectado a MongoDB');

  // 1. Limpiar
  console.log('Limpiando colecciones...');
  await Promise.all([
    Edificio.deleteMany({}),
    Maquina.deleteMany({}),
    Usuario.deleteMany({}),
    Uso.deleteMany({}),
    Transaccion.deleteMany({}),
    ConfigEdificio.deleteMany({}),
    Tip.deleteMany({}),
    Dispositivo.deleteMany({}),
  ]);
  console.log('  OK');

  // 2. Edificios (3)
  console.log('Creando 3 edificios...');
  const edificiosData = [
    { edificio_id: 'EDI-NORTE',  nombre: 'Torre Norte',  direccion: 'Av. Rivera 1234',   admin_nombre: 'Carlos Gómez',      admin_telefono: '099111222' },
    { edificio_id: 'EDI-SUR',    nombre: 'Torre Sur',    direccion: 'Av. Italia 5678',   admin_nombre: 'María Rodríguez',   admin_telefono: '099333444' },
    { edificio_id: 'EDI-CENTRO', nombre: 'Torre Centro', direccion: '18 de Julio 910',   admin_nombre: 'Diego Pereira',     admin_telefono: '099555666' },
  ];
  for (const ed of edificiosData) {
    await Edificio.create(ed);
    console.log(`  OK — ${ed.edificio_id}: ${ed.nombre}`);
  }

  // 3. Dispositivos + máquinas — 1 ESP32 por edificio con 2 máquinas (lav + sec)
  console.log('Creando 3 dispositivos ESP32 + 6 máquinas...');
  let espCounter = 1;
  const todasMaquinas = [];

  for (const ed of edificiosData) {
    const esp32_id = String(espCounter++).padStart(3, '0');
    const prefix = `cc7a5${esp32_id}`;

    const maquinasEdi = [
      { tipo: 'lavarropas', nombre: `Lavarropas — ${ed.nombre}`, relay_pin: 0 },
      { tipo: 'secadora',   nombre: `Secadora — ${ed.nombre}`,   relay_pin: 1 },
    ];
    const maquinasCreadas = [];
    for (const m of maquinasEdi) {
      const doc = await Maquina.create({
        maquina_id: genMaquinaId(m.tipo),
        edificio_id: ed.edificio_id,
        tipo: m.tipo,
        nombre: m.nombre,
        activa: true,
        dispositivo_id: esp32_id,
        relay_pin: m.relay_pin,
      });
      maquinasCreadas.push(doc);
      todasMaquinas.push(doc);
      console.log(`  OK — ${doc.maquina_id}: ${doc.nombre}`);
    }

    await Dispositivo.create({
      esp32_id,
      tipo_hw: 'esp32',
      ble_name: 'CleanCare-ESP32',
      service_uuid: `${prefix}-${SUFFIX}1`,
      control_uuid: `${prefix}-${SUFFIX}2`,
      status_uuid:  `${prefix}-${SUFFIX}3`,
      ubicacion: ed.nombre,
      maquinas: maquinasCreadas.map((m) => m.maquina_id),
      maquina_asignada: maquinasCreadas[0].maquina_id,  // legacy
      edificio_id: ed.edificio_id,
      activo: true,
    });
    console.log(`  OK — Dispositivo #${esp32_id} (${ed.nombre}) con ${maquinasCreadas.length} máquinas`);
  }

  // 4. Admin
  console.log('Creando usuario admin...');
  const admin = await Usuario.create({
    usuario_id: 'USR-ADMIN1',
    email: 'admin@cleancare.uy',
    password: 'admin123',
    nombre: 'Admin CleanCare',
    rol: 'admin',
    edificio_id: 'EDI-NORTE',
    apartamento: 'Admin',
  });
  console.log(`  OK — ${admin.email} / admin123 (${admin.rol})`);

  // 5. Residentes random (2 por edificio)
  console.log('Creando 6 residentes...');
  const residentes = [
    { nombre: 'Martín González',    email: 'martin@email.com',    apartamento: '1A', edificio_id: 'EDI-NORTE' },
    { nombre: 'Lucía Rodríguez',    email: 'lucia@email.com',     apartamento: '2A', edificio_id: 'EDI-NORTE' },
    { nombre: 'Camila Silva',       email: 'camila@email.com',    apartamento: '1B', edificio_id: 'EDI-SUR' },
    { nombre: 'Nicolás Martínez',   email: 'nicolas@email.com',   apartamento: '2B', edificio_id: 'EDI-SUR' },
    { nombre: 'Valentina López',    email: 'valentina@email.com', apartamento: '1C', edificio_id: 'EDI-CENTRO' },
    { nombre: 'Mateo Fernández',    email: 'mateo@email.com',     apartamento: '2C', edificio_id: 'EDI-CENTRO' },
  ];

  for (const r of residentes) {
    const u = await Usuario.create({
      email: r.email,
      password: '123456',
      nombre: r.nombre,
      apartamento: r.apartamento,
      rol: 'residente',
      edificio_id: r.edificio_id,
    });
    await Transaccion.create({
      usuario_id: u.usuario_id,
      edificio_id: r.edificio_id,
      tipo: 'ajuste_admin',
      cantidad: 10,
      descripcion: 'Créditos iniciales',
      creado_por: 'sistema',
    });
    console.log(`  OK — ${u.usuario_id}: ${r.nombre} (${r.apartamento}, ${r.edificio_id}) +10 créditos`);
  }

  // 6. Config de créditos por edificio
  console.log('Creando configs de créditos...');
  await ConfigEdificio.insertMany(
    edificiosData.map((ed) => ({
      edificio_id: ed.edificio_id,
      creditos_mensuales: 10,
      costo_lavado: 1,
      costo_secado: 1,
      duracion_lavado: 45,
      duracion_secado: 30,
      activo: true,
    }))
  );
  console.log(`  OK — ${edificiosData.length} configs`);

  // 7. Usos random distribuidos en los últimos 90 días
  const TOTAL_USOS = 45;
  const DIAS_RANGO = 90;
  console.log(`Creando ${TOTAL_USOS} usos random (últimos ${DIAS_RANGO} días)...`);
  const allUsers = await Usuario.find({ rol: 'residente' }).lean();
  const estados = ['completado', 'completado', 'completado', 'completado', 'cancelado', 'averia'];
  const usosData = [];

  for (let i = 0; i < TOTAL_USOS; i++) {
    const user = allUsers[Math.floor(Math.random() * allUsers.length)];
    const maqsEdi = todasMaquinas.filter((m) => m.edificio_id === user.edificio_id);
    const machine = maqsEdi[Math.floor(Math.random() * maqsEdi.length)];
    const duracion = machine.tipo === 'secadora' ? 30 : 45;
    const estado = estados[Math.floor(Math.random() * estados.length)];
    const daysAgo = Math.floor(Math.random() * DIAS_RANGO);
    const hoursOffset = Math.floor(Math.random() * 14) + 7;
    const fecha_inicio = new Date(Date.now() - daysAgo * 86400000);
    fecha_inicio.setHours(hoursOffset, Math.floor(Math.random() * 60), 0, 0);
    const fecha_fin = new Date(fecha_inicio.getTime() + duracion * 60000);

    usosData.push({
      maquina_id: machine.maquina_id,
      edificio_id: user.edificio_id,
      tipo: machine.tipo,
      duracion_min: duracion,
      residente_id: user.apartamento,
      estado,
      completado: estado === 'completado',
      fecha_inicio,
      fecha_fin,
      fecha: fecha_inicio,
    });

    await Transaccion.create({
      usuario_id: user.usuario_id,
      edificio_id: user.edificio_id,
      tipo: 'uso_maquina',
      cantidad: -1,
      descripcion: `Uso ${machine.nombre} (${machine.tipo})`,
      creado_por: 'sistema',
      fecha: fecha_inicio,
    });

    if (estado === 'cancelado' || estado === 'averia') {
      await Transaccion.create({
        usuario_id: user.usuario_id,
        edificio_id: user.edificio_id,
        tipo: 'devolucion',
        cantidad: 1,
        descripcion: `Devolución por ${estado}: ${machine.nombre}`,
        creado_por: 'sistema',
        fecha: fecha_fin,
      });
    }
  }

  await Uso.insertMany(usosData);
  console.log(`  OK — ${TOTAL_USOS} usos creados`);

  // 8. Tips
  console.log('Creando tips...');
  await Tip.insertMany([
    { texto: 'No colocar championes ni calzado en la máquina', tipo: 'lavarropas' },
    { texto: 'No lavar prendas con plumas (camperas de pluma, almohadas)', tipo: 'lavarropas' },
    { texto: 'No mezclar ropa de mascotas con ropa personal', tipo: 'ambos' },
    { texto: 'Vaciá los bolsillos antes de poner la ropa', tipo: 'lavarropas' },
    { texto: 'No sobrecargues la máquina, dejá espacio para que la ropa se mueva', tipo: 'ambos' },
    { texto: 'Separá la ropa blanca de la de color', tipo: 'lavarropas' },
    { texto: 'No secar prendas delicadas ni de lycra', tipo: 'secadora' },
    { texto: 'Limpiá el filtro de pelusas antes de usar la secadora', tipo: 'secadora' },
    { texto: 'Cerrá los cierres y abrochá los botones antes de lavar', tipo: 'lavarropas' },
    { texto: 'No dejes la ropa húmeda en la máquina por mucho tiempo', tipo: 'ambos' },
  ]);
  console.log('  OK — 10 tips');

  console.log('\n=== Seed completado ===');
  console.log('  3 edificios: Torre Norte, Torre Sur, Torre Centro');
  console.log('  3 dispositivos ESP32 (#001, #002, #003) — uno por edificio');
  console.log('  6 máquinas (2 por edificio: 1 lavarropas + 1 secadora)');
  console.log('  1 admin: admin@cleancare.uy / admin123');
  console.log('  6 residentes: 123456 (2 por edificio, 10 créditos c/u)');
  console.log(`  ${TOTAL_USOS} usos random (últimos 90 días)`);
  console.log('  3 configs de créditos (10/mes, costo 1, lavado 45min, secado 30min)');
  console.log('  10 tips');

  process.exit(0);
}

seed().catch((err) => {
  console.error('Error en seed:', err);
  process.exit(1);
});
