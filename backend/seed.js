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
const Unidad = require('./models/Unidad');
const Factura = require('./models/Factura');

const LETRAS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
const SUFFIX = 'bb73-4e02-8f1d-a0b0c0d0e0f';

function genMaquinaId() {
  return new mongoose.Types.ObjectId().toHexString();
}

function codigoUnidad(piso, n, nomenclatura) {
  return nomenclatura === 'letras' ? `${piso}${LETRAS[n - 1]}` : `${piso * 100 + n}`;
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

async function seed() {
  await connectDB();
  console.log('Conectado a MongoDB\n');

  // ============================================================
  // 1. Limpiar
  // ============================================================
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
    Unidad.deleteMany({}),
    Factura.deleteMany({}),
  ]);
  console.log('  OK\n');

  // ============================================================
  // 2. Edificios — 3 con nomenclaturas distintas
  // ============================================================
  const edificiosData = [
    {
      edificio_id: 'EDI-NORTE', nombre: 'Torre Norte', direccion: 'Av. Rivera 1234',
      admin_nombre: 'Carlos Gómez', admin_telefono: '099111222',
      pisos: 5, aptos_por_piso: 4, nomenclatura: 'numerica',
      extras: [{ codigo: 'portero', tipo: 'portero' }, { codigo: 'salon', tipo: 'otro' }],
    },
    {
      edificio_id: 'EDI-CENTRO', nombre: 'Parque Central', direccion: '18 de Julio 910',
      admin_nombre: 'Diego Pereira', admin_telefono: '099555666',
      pisos: 3, aptos_por_piso: 3, nomenclatura: 'numerica',
      extras: [{ codigo: 'portero', tipo: 'portero' }],
    },
    {
      edificio_id: 'EDI-ALEGRIA', nombre: 'Alegría Residencial', direccion: 'Av. Italia 5678',
      admin_nombre: 'María Rodríguez', admin_telefono: '099333444',
      pisos: 4, aptos_por_piso: 3, nomenclatura: 'letras',
      extras: [],
    },
  ];
  console.log('Creando 3 edificios...');
  for (const ed of edificiosData) {
    await Edificio.create(ed);
    console.log(`  OK — ${ed.edificio_id}: ${ed.nombre} (${ed.pisos}×${ed.aptos_por_piso} ${ed.nomenclatura})`);
  }

  // ============================================================
  // 3. Unidades — generar automáticamente por edificio
  // ============================================================
  console.log('\nGenerando unidades...');
  let totalUnidades = 0;
  for (const ed of edificiosData) {
    const docs = [];
    for (let p = 1; p <= ed.pisos; p++) {
      for (let n = 1; n <= ed.aptos_por_piso; n++) {
        docs.push({
          edificio_id: ed.edificio_id,
          codigo: codigoUnidad(p, n, ed.nomenclatura),
          piso: p, numero_apto: n, es_extra: false, tipo_extra: null,
        });
      }
    }
    for (const e of ed.extras) {
      docs.push({
        edificio_id: ed.edificio_id,
        codigo: e.codigo, piso: null, numero_apto: null,
        es_extra: true, tipo_extra: e.tipo,
      });
    }
    await Unidad.insertMany(docs);
    totalUnidades += docs.length;
    console.log(`  OK — ${ed.edificio_id}: ${docs.length} unidades`);
  }
  console.log(`  Total: ${totalUnidades} unidades\n`);

  // ============================================================
  // 4. Config por edificio
  // ============================================================
  console.log('Creando ConfigEdificio...');
  const configs = [
    {
      edificio_id: 'EDI-NORTE',
      creditos_mensuales: 10, costo_lavado: 1, costo_secado: 1,
      duracion_lavado: 45, duracion_secado: 30, max_compra_fichas: 10,
      precio_ficha_residente: 120, comision_cleancare: 33,
      litros_por_lavado: 60, litros_por_secado: 0, kwh_por_lavado: 1.2, kwh_por_secado: 2.5,
      facturacion_dia: 31, facturacion_hora: '23:59',
      email_admin_edificio: 'admin.norte@cleancare.com', whatsapp_admin_edificio: '+598 99 111 222',
      canal_preferido: 'email',
    },
    {
      edificio_id: 'EDI-CENTRO',
      creditos_mensuales: 8, costo_lavado: 1, costo_secado: 1,
      duracion_lavado: 45, duracion_secado: 30, max_compra_fichas: 10,
      precio_ficha_residente: 100, comision_cleancare: 25,
      litros_por_lavado: 55, litros_por_secado: 0, kwh_por_lavado: 1.1, kwh_por_secado: 2.3,
      facturacion_dia: 28, facturacion_hora: '23:59',
      email_admin_edificio: 'admin.centro@cleancare.com', whatsapp_admin_edificio: '',
      canal_preferido: 'ninguno',
    },
    {
      edificio_id: 'EDI-ALEGRIA',
      creditos_mensuales: 12, costo_lavado: 1, costo_secado: 1,
      duracion_lavado: 40, duracion_secado: 35, max_compra_fichas: 15,
      precio_ficha_residente: 150, comision_cleancare: 40,
      litros_por_lavado: 70, litros_por_secado: 0, kwh_por_lavado: 1.4, kwh_por_secado: 2.8,
      facturacion_dia: 31, facturacion_hora: '23:59',
      email_admin_edificio: 'admin.alegria@cleancare.com', whatsapp_admin_edificio: '+598 99 333 444',
      canal_preferido: 'whatsapp',
    },
  ];
  await ConfigEdificio.insertMany(configs);
  console.log(`  OK — ${configs.length} configs\n`);

  // ============================================================
  // 5. Dispositivos + Máquinas — 1 ESP32 por edificio (1 lav + 1 sec)
  // ============================================================
  console.log('Creando dispositivos + máquinas...');
  const todasMaquinas = [];
  let espCounter = 1;
  for (const ed of edificiosData) {
    const esp32_id = String(espCounter++).padStart(3, '0');
    const prefix = `cc7a5${esp32_id}`;
    const lavId = genMaquinaId();
    const secId = genMaquinaId();
    const lav = await Maquina.create({
      maquina_id: lavId, edificio_id: ed.edificio_id, tipo: 'lavarropas',
      nombre: `Lavarropas — ${ed.nombre}`, activa: true, dispositivo_id: esp32_id, relay_pin: 0,
    });
    const sec = await Maquina.create({
      maquina_id: secId, edificio_id: ed.edificio_id, tipo: 'secadora',
      nombre: `Secadora — ${ed.nombre}`, activa: true, dispositivo_id: esp32_id, relay_pin: 1,
    });
    todasMaquinas.push(lav, sec);
    await Dispositivo.create({
      esp32_id, tipo_hw: 'esp32', ble_name: 'CleanCare-ESP32',
      service_uuid: `${prefix}-${SUFFIX}1`, control_uuid: `${prefix}-${SUFFIX}2`, status_uuid: `${prefix}-${SUFFIX}3`,
      ubicacion: ed.nombre, maquinas: [lavId, secId], maquina_asignada: lavId,
      edificio_id: ed.edificio_id, activo: true,
    });
    console.log(`  OK — ${ed.edificio_id}: Dispositivo #${esp32_id} + 2 máquinas`);
  }
  console.log();

  // ============================================================
  // 6. Usuarios — admins + residentes con titular+miembros
  // ============================================================
  console.log('Creando usuarios...');

  // Super admin CleanCare
  const superAdmin = await Usuario.create({
    email: 'admin@cleancare.com', password: 'admin123', nombre: 'Admin CleanCare',
    rol: 'admin', edificio_id: 'EDI-NORTE', apartamento: 'Admin',
  });
  console.log(`  SUPER — ${superAdmin.email} / admin123`);

  // Admin de cada edificio
  const adminsEdi = [
    { edificio_id: 'EDI-NORTE',   email: 'admin.norte@cleancare.com',   nombre: 'Carlos Gómez' },
    { edificio_id: 'EDI-CENTRO',  email: 'admin.centro@cleancare.com',  nombre: 'Diego Pereira' },
    { edificio_id: 'EDI-ALEGRIA', email: 'admin.alegria@cleancare.com', nombre: 'María Rodríguez' },
  ];
  for (const a of adminsEdi) {
    const u = await Usuario.create({
      email: a.email, password: 'admin123', nombre: a.nombre,
      rol: 'admin_edificio', edificio_id: a.edificio_id, apartamento: 'Admin',
      estado_aprobacion: 'aprobado',
    });
    console.log(`  ADMIN — ${u.email} / admin123 (${a.edificio_id})`);
  }

  // Residentes: titulares y miembros (hijos, convivientes)
  // Estructura: [edificio_id, apto, [{ nombre, email, es_titular, estado? }]]
  const familias = [
    // EDI-NORTE — numerica
    ['EDI-NORTE', '101', [
      { nombre: 'Martín González', email: 'martin@mail.com', es_titular: true },
      { nombre: 'Sofía González',  email: 'sofia@mail.com',  es_titular: false },
    ]],
    ['EDI-NORTE', '102', [
      { nombre: 'Camila Silva',  email: 'camila@mail.com',  es_titular: true },
      { nombre: 'Mateo Silva',   email: 'mateo@mail.com',   es_titular: false },
      { nombre: 'Ana Silva',     email: 'ana@mail.com',     es_titular: false },
    ]],
    ['EDI-NORTE', '201', [
      { nombre: 'Lucía Rodríguez', email: 'lucia@mail.com', es_titular: true },
    ]],
    ['EDI-NORTE', '302', [
      { nombre: 'Pedro Díaz', email: 'pedro@mail.com', es_titular: true },
      { nombre: 'Laura Díaz', email: 'laura@mail.com', es_titular: false },
    ]],
    ['EDI-NORTE', '403', [
      { nombre: 'Juan Pérez',    email: 'juan@mail.com',    es_titular: true },
      { nombre: 'Nueva Miembro', email: 'pendiente1@mail.com', es_titular: false, estado: 'pendiente' },
    ]],

    // EDI-CENTRO — numerica
    ['EDI-CENTRO', '101', [
      { nombre: 'Valentina López', email: 'valentina@mail.com', es_titular: true },
      { nombre: 'Rafael López',    email: 'rafael@mail.com',    es_titular: false },
    ]],
    ['EDI-CENTRO', '202', [
      { nombre: 'Nicolás Martínez', email: 'nicolas@mail.com', es_titular: true },
    ]],
    ['EDI-CENTRO', '303', [
      { nombre: 'Julieta Benítez',  email: 'julieta@mail.com', es_titular: true },
      { nombre: 'Pablo Benítez',    email: 'pablo@mail.com',   es_titular: false },
      { nombre: 'Visitante Nuevo',  email: 'pendiente2@mail.com', es_titular: false, estado: 'pendiente' },
    ]],

    // EDI-ALEGRIA — letras
    ['EDI-ALEGRIA', '1A', [
      { nombre: 'Andrés Vega', email: 'andres@mail.com', es_titular: true },
      { nombre: 'Paula Vega',  email: 'paula@mail.com',  es_titular: false },
    ]],
    ['EDI-ALEGRIA', '2B', [
      { nombre: 'Emilia Castro', email: 'emilia@mail.com', es_titular: true },
    ]],
    ['EDI-ALEGRIA', '3C', [
      { nombre: 'Franco Núñez',    email: 'franco@mail.com',    es_titular: true },
      { nombre: 'Hija Nueva',      email: 'pendiente3@mail.com', es_titular: false, estado: 'pendiente' },
    ]],
  ];

  const residentesCreados = [];
  for (const [edificio_id, apto, gente] of familias) {
    let titularId = null;
    for (const p of gente) {
      const rol_apto = p.es_titular ? 'titular' : 'miembro';
      const estado = p.estado || 'aprobado';
      const u = await Usuario.create({
        email: p.email, password: '123456', nombre: p.nombre,
        rol: 'residente', edificio_id, apartamento: apto,
        rol_apto, estado_aprobacion: estado,
        aprobado_por: (rol_apto === 'miembro' && estado === 'aprobado') ? titularId : null,
        aprobado_en: estado === 'aprobado' ? new Date() : null,
      });
      if (p.es_titular) titularId = u.usuario_id;
      residentesCreados.push({ ...u.toObject(), apartamento: apto, edificio_id });
    }
  }
  console.log(`  RESID — ${residentesCreados.length} residentes en ${familias.length} aptos\n`);

  // ============================================================
  // 7. Transacciones — asignaciones mensuales, compras, usos, devoluciones
  // ============================================================
  console.log('Creando transacciones + usos...');

  // Un apto = su titular + sus miembros. Agrupamos para emitir txs al pozo del apto.
  const porApto = new Map();
  for (const r of residentesCreados) {
    const k = `${r.edificio_id}::${r.apartamento}`;
    if (!porApto.has(k)) porApto.set(k, { edificio_id: r.edificio_id, apartamento: r.apartamento, miembros: [] });
    porApto.get(k).miembros.push(r);
  }

  // 7a. Asignaciones mensuales (últimos 4 meses) — acreditadas al titular
  const hoy = new Date();
  const asignaciones = [];
  for (let mesAtras = 3; mesAtras >= 0; mesAtras--) {
    const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - mesAtras, 1, 3, 0, 0);
    for (const { edificio_id, apartamento, miembros } of porApto.values()) {
      const titular = miembros.find(m => m.rol_apto === 'titular');
      if (!titular) continue;
      const cfg = configs.find(c => c.edificio_id === edificio_id);
      asignaciones.push({
        usuario_id: titular.usuario_id, edificio_id, apartamento,
        tipo: 'asignacion_mensual', cantidad: cfg.creditos_mensuales,
        descripcion: `Asignación mensual ${fecha.toLocaleString('es', { month: 'long', year: 'numeric' })}`,
        creado_por: 'sistema', fecha,
      });
    }
  }
  await Transaccion.insertMany(asignaciones);
  console.log(`  TXs — ${asignaciones.length} asignaciones mensuales`);

  // 7b. Compras random (titulares comprando fichas extra)
  const compras = [];
  for (const { edificio_id, apartamento, miembros } of porApto.values()) {
    const titular = miembros.find(m => m.rol_apto === 'titular');
    if (!titular) continue;
    const n = randInt(0, 2); // 0-2 compras por apto
    for (let i = 0; i < n; i++) {
      const cantidad = pick([2, 3, 5]);
      const diasAtras = randInt(3, 80);
      const fecha = new Date(hoy.getTime() - diasAtras * 86400000);
      compras.push({
        usuario_id: titular.usuario_id, edificio_id, apartamento,
        tipo: 'compra', cantidad,
        descripcion: `Compra de ${cantidad} fichas`,
        creado_por: titular.usuario_id, fecha,
      });
    }
  }
  await Transaccion.insertMany(compras);
  console.log(`  TXs — ${compras.length} compras`);

  // 7c. Usos random distribuidos en los últimos 60 días
  const usosData = [];
  const usoTxs = [];
  const devolucionTxs = [];
  // Estado pesado a completado (la mayoría termina bien)
  const estadoSorteo = ['completado', 'completado', 'completado', 'completado', 'completado', 'cancelado', 'averia'];

  // Cantidad de usos por apto: 3 a 10
  for (const { edificio_id, apartamento, miembros } of porApto.values()) {
    const aprobados = miembros.filter(m => m.estado_aprobacion === 'aprobado');
    if (aprobados.length === 0) continue;
    const usosEnApto = randInt(3, 10);
    const maqsEdi = todasMaquinas.filter(m => m.edificio_id === edificio_id);
    for (let i = 0; i < usosEnApto; i++) {
      const quien = pick(aprobados);
      const maq = pick(maqsEdi);
      const duracion = maq.tipo === 'secadora' ? 30 : 45;
      const estado = pick(estadoSorteo);
      const diasAtras = randInt(1, 60);
      const fecha_inicio = new Date(hoy.getTime() - diasAtras * 86400000);
      fecha_inicio.setHours(7 + Math.floor(Math.random() * 14), randInt(0, 59), 0, 0);
      const fecha_fin = new Date(fecha_inicio.getTime() + duracion * 60000);
      usosData.push({
        maquina_id: maq.maquina_id, edificio_id, tipo: maq.tipo, duracion_min: duracion,
        residente_id: apartamento, estado, completado: estado === 'completado',
        fecha_inicio, fecha_fin, fecha: fecha_inicio,
      });
      usoTxs.push({
        usuario_id: quien.usuario_id, edificio_id, apartamento,
        tipo: 'uso_maquina', cantidad: -1,
        descripcion: `Uso ${maq.nombre} (${maq.tipo})`,
        creado_por: 'sistema', fecha: fecha_inicio,
      });
      if (estado === 'cancelado' || estado === 'averia') {
        devolucionTxs.push({
          usuario_id: quien.usuario_id, edificio_id, apartamento,
          tipo: 'devolucion', cantidad: 1,
          descripcion: `Devolución por ${estado}: ${maq.nombre}`,
          creado_por: 'sistema', fecha: fecha_fin,
        });
      }
    }
  }
  await Uso.insertMany(usosData);
  await Transaccion.insertMany(usoTxs);
  if (devolucionTxs.length > 0) await Transaccion.insertMany(devolucionTxs);
  console.log(`  USOs — ${usosData.length} ciclos (${usoTxs.length} tx consumo + ${devolucionTxs.length} devoluciones)\n`);

  // ============================================================
  // 8. Tips
  // ============================================================
  console.log('Creando tips...');
  await Tip.insertMany([
    { texto: 'No colocar championes ni calzado en la máquina', tipo: 'lavarropas' },
    { texto: 'No lavar prendas con plumas (camperas, almohadas)', tipo: 'lavarropas' },
    { texto: 'No mezclar ropa de mascotas con ropa personal', tipo: 'ambos' },
    { texto: 'Vaciá los bolsillos antes de poner la ropa', tipo: 'lavarropas' },
    { texto: 'No sobrecargues la máquina, dejá espacio para que la ropa se mueva', tipo: 'ambos' },
    { texto: 'Separá la ropa blanca de la de color', tipo: 'lavarropas' },
    { texto: 'No secar prendas delicadas ni de lycra', tipo: 'secadora' },
    { texto: 'Limpiá el filtro de pelusas antes de usar la secadora', tipo: 'secadora' },
    { texto: 'Cerrá cierres y abrochá botones antes de lavar', tipo: 'lavarropas' },
    { texto: 'No dejes la ropa húmeda en la máquina por mucho tiempo', tipo: 'ambos' },
  ]);
  console.log('  OK — 10 tips\n');

  // ============================================================
  // Resumen
  // ============================================================
  console.log('=== Seed completado ===');
  console.log('\nCredenciales:');
  console.log('  SUPER-ADMIN:  admin@cleancare.com / admin123 (ve todo)');
  console.log('  ADMIN NORTE:  admin.norte@cleancare.com / admin123');
  console.log('  ADMIN CENTRO: admin.centro@cleancare.com / admin123');
  console.log('  ADMIN ALEGRIA: admin.alegria@cleancare.com / admin123');
  console.log('  RESIDENTES:   password 123456');
  console.log('\nTitulares residenciales (pueden comprar fichas, PIN default 1111):');
  for (const [ed, apto, gente] of familias) {
    const t = gente.find(p => p.es_titular);
    const miembros = gente.filter(p => !p.es_titular).length;
    console.log(`  ${ed} ${apto}: ${t.email} + ${miembros} miembro(s)`);
  }
  console.log('\nSolicitudes pendientes de aprobación (loguear como titular para aprobar):');
  console.log('  pendiente1@mail.com (EDI-NORTE 403) — aprobado por juan@mail.com');
  console.log('  pendiente2@mail.com (EDI-CENTRO 303) — aprobado por julieta@mail.com');
  console.log('  pendiente3@mail.com (EDI-ALEGRIA 3C) — aprobado por franco@mail.com');
  console.log('\nPara testear facturación:');
  console.log('  - Loguear como super-admin o admin de edificio');
  console.log('  - Ir a /facturacion → Generar ahora (cualquier mes con actividad)');

  process.exit(0);
}

seed().catch((err) => {
  console.error('Error en seed:', err);
  process.exit(1);
});
