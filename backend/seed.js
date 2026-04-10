/**
 * Seed script — limpia la BD y crea datos de ejemplo.
 * Uso: node backend/seed.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const connectDB = require('./lib/mongodb');
const Edificio = require('./models/Edificio');
const Maquina = require('./models/Maquina');
const Usuario = require('./models/Usuario');
const Uso = require('./models/Uso');
const Transaccion = require('./models/Transaccion');
const ConfigEdificio = require('./models/ConfigEdificio');

async function seed() {
  await connectDB();
  console.log('Conectado a MongoDB');

  // 1. Limpiar todas las colecciones
  console.log('Limpiando colecciones...');
  await Promise.all([
    Edificio.deleteMany({}),
    Maquina.deleteMany({}),
    Usuario.deleteMany({}),
    Uso.deleteMany({}),
    Transaccion.deleteMany({}),
    ConfigEdificio.deleteMany({}),
  ]);
  console.log('  OK — todas las colecciones vacías');

  // 2. Crear edificios
  console.log('Creando edificios...');
  const edNorte = await Edificio.create({
    edificio_id: 'EDI-NORTE',
    nombre: 'Torre Norte',
    direccion: 'Av. Rivera 1234',
  });
  const edSur = await Edificio.create({
    edificio_id: 'EDI-SUR',
    nombre: 'Torre Sur',
    direccion: 'Av. Italia 5678',
  });
  console.log(`  OK — ${edNorte.edificio_id}: ${edNorte.nombre}`);
  console.log(`  OK — ${edSur.edificio_id}: ${edSur.nombre}`);

  // 3. Crear máquinas (1 lavadora + 1 secadora por edificio)
  console.log('Creando máquinas...');
  const maquinas = await Maquina.insertMany([
    { maquina_id: 'LAV-000001', edificio_id: 'EDI-NORTE', tipo: 'lavarropas', nombre: 'Lavarropas Piso 1', activa: true },
    { maquina_id: 'SEC-000001', edificio_id: 'EDI-NORTE', tipo: 'secadora', nombre: 'Secadora Piso 1', activa: true },
    { maquina_id: 'LAV-000002', edificio_id: 'EDI-SUR', tipo: 'lavarropas', nombre: 'Lavarropas Piso 2', activa: true },
    { maquina_id: 'SEC-000002', edificio_id: 'EDI-SUR', tipo: 'secadora', nombre: 'Secadora Piso 2', activa: true },
  ]);
  maquinas.forEach(m => console.log(`  OK — ${m.maquina_id}: ${m.nombre} (${m.edificio_id})`));

  // 4. Crear admin
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
  console.log(`  OK — ${admin.usuario_id}: ${admin.email} (${admin.rol})`);

  // 5. Crear 10 residentes (5 por edificio)
  console.log('Creando 10 residentes...');
  const residentes = [
    { nombre: 'Martín González', email: 'martin@email.com', apartamento: '1A', edificio_id: 'EDI-NORTE' },
    { nombre: 'Lucía Rodríguez', email: 'lucia@email.com', apartamento: '2A', edificio_id: 'EDI-NORTE' },
    { nombre: 'Santiago Pérez', email: 'santiago@email.com', apartamento: '3A', edificio_id: 'EDI-NORTE' },
    { nombre: 'Valentina López', email: 'valentina@email.com', apartamento: '4A', edificio_id: 'EDI-NORTE' },
    { nombre: 'Mateo Fernández', email: 'mateo@email.com', apartamento: '5A', edificio_id: 'EDI-NORTE' },
    { nombre: 'Camila Silva', email: 'camila@email.com', apartamento: '1B', edificio_id: 'EDI-SUR' },
    { nombre: 'Nicolás Martínez', email: 'nicolas@email.com', apartamento: '2B', edificio_id: 'EDI-SUR' },
    { nombre: 'Florencia García', email: 'florencia@email.com', apartamento: '3B', edificio_id: 'EDI-SUR' },
    { nombre: 'Joaquín Díaz', email: 'joaquin@email.com', apartamento: '4B', edificio_id: 'EDI-SUR' },
    { nombre: 'Agustina Suárez', email: 'agustina@email.com', apartamento: '5B', edificio_id: 'EDI-SUR' },
  ];

  for (const r of residentes) {
    const usuario = await Usuario.create({
      email: r.email,
      password: '123456',
      nombre: r.nombre,
      apartamento: r.apartamento,
      rol: 'residente',
      edificio_id: r.edificio_id,
    });
    // Asignar 10 créditos iniciales
    await Transaccion.create({
      usuario_id: usuario.usuario_id,
      edificio_id: r.edificio_id,
      tipo: 'ajuste_admin',
      cantidad: 10,
      descripcion: 'Créditos iniciales',
      creado_por: 'sistema',
    });
    console.log(`  OK — ${usuario.usuario_id}: ${r.nombre} (${r.apartamento}, ${r.edificio_id}) +10 créditos`);
  }

  // 6. Crear config de créditos para cada edificio
  console.log('Creando configuración de créditos...');
  await ConfigEdificio.insertMany([
    { edificio_id: 'EDI-NORTE', creditos_mensuales: 10, costo_lavado: 1, costo_secado: 1, duracion_lavado: 45, duracion_secado: 30, activo: true },
    { edificio_id: 'EDI-SUR', creditos_mensuales: 10, costo_lavado: 1, costo_secado: 1, duracion_lavado: 45, duracion_secado: 30, activo: true },
  ]);
  console.log('  OK — configs para EDI-NORTE y EDI-SUR');

  // 7. Crear 20 usos random
  console.log('Creando 20 usos random...');
  const allUsers = await Usuario.find({ rol: 'residente' }).lean();
  const allMachines = await Maquina.find({ activa: true }).lean();
  const estados = ['completado', 'completado', 'completado', 'completado', 'cancelado', 'averia'];
  const usosData = [];

  for (let i = 0; i < 20; i++) {
    const user = allUsers[Math.floor(Math.random() * allUsers.length)];
    // Pick a machine from the user's building
    const buildingMachines = allMachines.filter(m => m.edificio_id === user.edificio_id);
    const machine = buildingMachines[Math.floor(Math.random() * buildingMachines.length)];
    const duracion = machine.tipo === 'secadora' ? 30 : 45;
    const estado = estados[Math.floor(Math.random() * estados.length)];
    const daysAgo = Math.floor(Math.random() * 30);
    const fecha_inicio = new Date(Date.now() - daysAgo * 86400000 - Math.floor(Math.random() * 43200000));
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
      fecha_fin: estado !== 'activo' ? fecha_fin : undefined,
      fecha: fecha_inicio,
    });

    // Deduct credit for the use
    await Transaccion.create({
      usuario_id: user.usuario_id,
      edificio_id: user.edificio_id,
      tipo: 'uso_maquina',
      cantidad: -1,
      descripcion: `Uso ${machine.maquina_id} (${machine.tipo})`,
      creado_por: 'sistema',
      fecha: fecha_inicio,
    });

    // Refund if cancelled or averia
    if (estado === 'cancelado' || estado === 'averia') {
      await Transaccion.create({
        usuario_id: user.usuario_id,
        edificio_id: user.edificio_id,
        tipo: 'devolucion',
        cantidad: 1,
        descripcion: `Devolución por ${estado}: ${machine.maquina_id}`,
        creado_por: 'sistema',
        fecha: fecha_fin,
      });
    }
  }

  await Uso.insertMany(usosData);
  console.log(`  OK — 20 usos creados`);

  console.log('\n=== Seed completado ===');
  console.log('  2 edificios: Torre Norte, Torre Sur');
  console.log('  4 máquinas: LAV-000001, SEC-000001, LAV-000002, SEC-000002');
  console.log('  1 admin: admin@cleancare.uy / admin123');
  console.log('  10 residentes: 123456 (5 por edificio, 10 créditos c/u)');
  console.log('  2 configs de créditos (10/mes, costo 1, lavado 45min, secado 30min)');

  process.exit(0);
}

seed().catch((err) => {
  console.error('Error en seed:', err);
  process.exit(1);
});
