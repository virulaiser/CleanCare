const PDFDocument = require('pdfkit');
const { put } = require('@vercel/blob');

const Transaccion = require('../models/Transaccion');
const Usuario = require('../models/Usuario');
const Uso = require('../models/Uso');
const ConfigEdificio = require('../models/ConfigEdificio');
const Edificio = require('../models/Edificio');
const Factura = require('../models/Factura');

// Paleta consistente con el branding de la app/panel (colors.ts)
const BRAND = {
  primary:    '#3B82F6',
  primaryDk:  '#1D4ED8',
  accent:     '#0EA5E9',
  success:    '#16A34A',
  warning:    '#D97706',
  danger:     '#EF4444',
  text:       '#0F172A',
  textSoft:   '#475569',
  textMuted:  '#94A3B8',
  line:       '#E5E7EB',
  zebra:      '#F8FAFC',
  bgSoft:     '#EFF6FF',
};

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function rangoMes(mes, anio) {
  return { desde: new Date(anio, mes - 1, 1), hasta: new Date(anio, mes, 1) };
}
function fmtMoney(n) {
  const v = Number(n) || 0;
  return `$ ${v.toLocaleString('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
function fmtNum(n, d = 0) {
  return (Number(n) || 0).toLocaleString('es-UY', { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtFecha(d) {
  return new Date(d).toLocaleString('es-UY', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
function fmtFechaCorta(d) {
  return new Date(d).toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit' });
}

// ============================================================
// Primitivas de render
// ============================================================
async function renderPDF(build) {
  const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
  build(doc);
  addPageNumbers(doc);
  doc.end();
  return done;
}

function addPageNumbers(doc) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const total = range.count;
    const pageNum = `Página ${i - range.start + 1} de ${total}`;
    doc.fontSize(8).fillColor(BRAND.textMuted)
       .text(pageNum, 40, doc.page.height - 28, { width: doc.page.width - 80, align: 'right' });
  }
}

function header(doc, opts) {
  const { titulo, subtitulo, nroFactura, periodo, edificio } = opts;

  // Barra superior color marca
  doc.save();
  doc.rect(0, 0, doc.page.width, 6).fill(BRAND.primary);
  doc.restore();

  // Logo textual + nombre
  doc.y = 28;
  doc.fillColor(BRAND.primary).fontSize(24).font('Helvetica-Bold').text('CleanCare', 40, 28);
  doc.fontSize(9).font('Helvetica').fillColor(BRAND.textSoft)
     .text('Sistema digital de lavandería para edificios', 40, 56);

  // Cuadro de la factura (lado derecho)
  const boxX = doc.page.width - 230;
  const boxY = 28;
  doc.save();
  doc.roundedRect(boxX, boxY, 190, 58, 6).fill(BRAND.bgSoft);
  doc.restore();
  doc.fontSize(8).fillColor(BRAND.textMuted).font('Helvetica')
     .text('N° DOCUMENTO', boxX + 12, boxY + 10);
  doc.fontSize(12).fillColor(BRAND.text).font('Helvetica-Bold')
     .text(nroFactura || '—', boxX + 12, boxY + 23);
  doc.fontSize(8).fillColor(BRAND.textMuted).font('Helvetica')
     .text('EMITIDO', boxX + 12, boxY + 40);
  doc.fontSize(9).fillColor(BRAND.text).font('Helvetica-Bold')
     .text(fmtFecha(new Date()), boxX + 60, boxY + 40);

  // Línea separadora
  doc.moveTo(40, 100).lineTo(doc.page.width - 40, 100).strokeColor(BRAND.line).lineWidth(0.5).stroke();

  // Título grande
  doc.y = 115;
  doc.fillColor(BRAND.text).fontSize(18).font('Helvetica-Bold').text(titulo, 40, 115);
  if (subtitulo) {
    doc.fontSize(10).font('Helvetica').fillColor(BRAND.textSoft).text(subtitulo);
  }

  // Data row: periodo + edificio
  doc.moveDown(0.8);
  const rowY = doc.y;
  doc.fontSize(8).fillColor(BRAND.textMuted).font('Helvetica').text('PERÍODO', 40, rowY);
  doc.fontSize(11).fillColor(BRAND.text).font('Helvetica-Bold').text(periodo, 40, rowY + 10);

  doc.fontSize(8).fillColor(BRAND.textMuted).font('Helvetica').text('EDIFICIO', 220, rowY);
  doc.fontSize(11).fillColor(BRAND.text).font('Helvetica-Bold').text(edificio?.nombre || edificio?.edificio_id || '—', 220, rowY + 10);

  doc.fontSize(8).fillColor(BRAND.textMuted).font('Helvetica').text('DIRECCIÓN', 400, rowY);
  doc.fontSize(11).fillColor(BRAND.text).font('Helvetica-Bold').text(edificio?.direccion || '—', 400, rowY + 10, { width: 155 });

  doc.y = rowY + 40;
  doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).strokeColor(BRAND.line).lineWidth(0.5).stroke();
  doc.moveDown(0.6);
}

function partyBlock(doc, titulo, lines) {
  const y0 = doc.y;
  doc.fontSize(8).fillColor(BRAND.textMuted).font('Helvetica').text(titulo.toUpperCase(), 40, y0);
  doc.moveDown(0.3);
  for (const l of lines) {
    if (!l) continue;
    doc.fontSize(10).fillColor(BRAND.text).font('Helvetica').text(l, 40);
  }
}

function twoPartyBlocks(doc, left, right) {
  const y0 = doc.y;
  // Columna izquierda
  doc.fontSize(8).fillColor(BRAND.textMuted).font('Helvetica').text(left.titulo.toUpperCase(), 40, y0);
  let ly = y0 + 12;
  for (const l of left.lines.filter(Boolean)) {
    doc.fontSize(10).fillColor(BRAND.text).font('Helvetica').text(l, 40, ly, { width: 250 });
    ly = doc.y;
  }
  const leftEnd = ly;

  // Columna derecha
  doc.fontSize(8).fillColor(BRAND.textMuted).font('Helvetica').text(right.titulo.toUpperCase(), 310, y0);
  let ry = y0 + 12;
  for (const l of right.lines.filter(Boolean)) {
    doc.fontSize(10).fillColor(BRAND.text).font('Helvetica').text(l, 310, ry, { width: 250 });
    ry = doc.y;
  }
  const rightEnd = ry;

  doc.y = Math.max(leftEnd, rightEnd);
  doc.moveDown(0.8);
}

function sectionTitle(doc, texto) {
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor(BRAND.primary).font('Helvetica-Bold').text(texto);
  doc.moveTo(40, doc.y + 2).lineTo(doc.page.width - 40, doc.y + 2)
     .strokeColor(BRAND.line).lineWidth(0.5).stroke();
  doc.moveDown(0.5);
}

// Tabla con zebra striping y header coloreado.
// columns = [{ key, label, width (fracción 0-1), align? }]
function renderTable(doc, columns, rows, { totalRow } = {}) {
  const startX = 40;
  const totalW = doc.page.width - 80;
  const colW = columns.map(c => Math.round(totalW * c.width));

  // Header
  let y = doc.y;
  doc.save();
  doc.rect(startX, y, totalW, 22).fill(BRAND.primary);
  doc.restore();
  doc.fontSize(9).fillColor('#FFFFFF').font('Helvetica-Bold');
  let x = startX;
  columns.forEach((c, i) => {
    doc.text(c.label, x + 8, y + 7, { width: colW[i] - 16, align: c.align || 'left' });
    x += colW[i];
  });
  y += 22;
  doc.y = y;

  // Rows
  doc.font('Helvetica').fontSize(9.5).fillColor(BRAND.text);
  let zebra = false;
  for (const row of rows) {
    // Calcular alto
    let rowHeight = 16;
    columns.forEach((c, i) => {
      const h = doc.heightOfString(String(row[c.key] ?? '—'), { width: colW[i] - 16 }) + 8;
      if (h > rowHeight) rowHeight = h;
    });

    // Salto de página si no cabe
    if (y + rowHeight > doc.page.height - 80) {
      doc.addPage();
      y = 40;
      // Re-render header en la nueva página
      doc.save();
      doc.rect(startX, y, totalW, 22).fill(BRAND.primary);
      doc.restore();
      doc.fontSize(9).fillColor('#FFFFFF').font('Helvetica-Bold');
      x = startX;
      columns.forEach((c, i) => {
        doc.text(c.label, x + 8, y + 7, { width: colW[i] - 16, align: c.align || 'left' });
        x += colW[i];
      });
      y += 22;
      zebra = false;
    }

    // Fondo zebra
    if (zebra) {
      doc.save();
      doc.rect(startX, y, totalW, rowHeight).fill(BRAND.zebra);
      doc.restore();
    }
    zebra = !zebra;

    // Celdas
    doc.font('Helvetica').fontSize(9.5).fillColor(BRAND.text);
    x = startX;
    columns.forEach((c, i) => {
      const val = String(row[c.key] ?? '—');
      doc.text(val, x + 8, y + 5, { width: colW[i] - 16, align: c.align || 'left' });
      x += colW[i];
    });
    y += rowHeight;
  }

  // Row total (opcional)
  if (totalRow) {
    doc.save();
    doc.rect(startX, y, totalW, 24).fill(BRAND.bgSoft);
    doc.restore();
    doc.fontSize(10).fillColor(BRAND.primaryDk).font('Helvetica-Bold');
    let tx = startX;
    columns.forEach((c, i) => {
      const val = String(totalRow[c.key] ?? '');
      doc.text(val, tx + 8, y + 7, { width: colW[i] - 16, align: c.align || 'left' });
      tx += colW[i];
    });
    y += 24;
  }

  doc.y = y + 6;
}

// Cajita destacada para un total (ej: "Total a abonar")
function totalBox(doc, label, value, color = BRAND.primaryDk) {
  const x = 40;
  const width = doc.page.width - 80;
  const y = doc.y;
  doc.save();
  doc.roundedRect(x, y, width, 54, 8).fill(BRAND.bgSoft);
  doc.restore();
  doc.fontSize(10).fillColor(BRAND.textSoft).font('Helvetica').text(label, x + 16, y + 12);
  doc.fontSize(20).fillColor(color).font('Helvetica-Bold')
     .text(value, x + 16, y + 26, { width: width - 32, align: 'right' });
  doc.y = y + 60;
}

function footer(doc, edificio) {
  const y = doc.page.height - 70;
  doc.moveTo(40, y).lineTo(doc.page.width - 40, y).strokeColor(BRAND.line).lineWidth(0.5).stroke();
  doc.fontSize(8).fillColor(BRAND.textMuted).font('Helvetica');
  doc.text('CleanCare · Sistema digital de lavandería', 40, y + 8);
  doc.text(`Documento generado automáticamente · ${fmtFecha(new Date())}`, 40, y + 20);
  if (edificio?.admin_nombre) {
    doc.text(`Administrador: ${edificio.admin_nombre}${edificio.admin_telefono ? ' · ' + edificio.admin_telefono : ''}`, 40, y + 32);
  }
}

// ============================================================
// PDFs específicos
// ============================================================
async function pdfIngreso({ edificio, config, mes, anio, totales, facturaId }) {
  return renderPDF((doc) => {
    header(doc, {
      titulo: 'Factura de comisión CleanCare',
      subtitulo: 'Monto a abonar al sistema por las fichas vendidas',
      nroFactura: facturaId || '—',
      periodo: `${MESES[mes - 1]} ${anio}`,
      edificio,
    });

    twoPartyBlocks(doc,
      { titulo: 'Emitido a', lines: [
        `Admin: ${edificio.admin_nombre || '—'}`,
        edificio.admin_telefono || '',
        edificio.direccion || '',
        `Edificio ${edificio.edificio_id}`,
      ]},
      { titulo: 'Emisor', lines: [
        'CleanCare',
        'contacto@cleancare.uy',
        'cleancare.uy',
      ]},
    );

    sectionTitle(doc, 'Detalle del período');
    const totalIngreso = totales.fichas_vendidas * config.precio_ficha_residente;
    const totalComision = totales.fichas_vendidas * config.comision_cleancare;
    renderTable(doc,
      [
        { key: 'concepto', label: 'Concepto',          width: 0.50 },
        { key: 'cantidad', label: 'Cantidad',          width: 0.14, align: 'right' },
        { key: 'unit',     label: 'Precio unitario',   width: 0.18, align: 'right' },
        { key: 'subtotal', label: 'Subtotal',          width: 0.18, align: 'right' },
      ],
      [
        {
          concepto: 'Fichas vendidas a residentes',
          cantidad: fmtNum(totales.fichas_vendidas),
          unit:     fmtMoney(config.precio_ficha_residente),
          subtotal: fmtMoney(totalIngreso),
        },
        {
          concepto: 'Comisión CleanCare por ficha vendida',
          cantidad: fmtNum(totales.fichas_vendidas),
          unit:     fmtMoney(config.comision_cleancare),
          subtotal: fmtMoney(totalComision),
        },
      ],
      {
        totalRow: {
          concepto: 'Total a abonar a CleanCare',
          cantidad: '',
          unit: '',
          subtotal: fmtMoney(totalComision),
        },
      }
    );

    totalBox(doc, 'Total a abonar a CleanCare', fmtMoney(totalComision));

    doc.fontSize(9).fillColor(BRAND.textSoft).font('Helvetica')
       .text(
         `La diferencia entre el ingreso total (${fmtMoney(totalIngreso)}) y la comisión CleanCare (${fmtMoney(totalComision)}) corresponde al margen del administrador del edificio: ${fmtMoney(totalIngreso - totalComision)}.`,
         { width: doc.page.width - 80 }
       );

    footer(doc, edificio);
  });
}

async function pdfConsumoResumen({ edificio, config, mes, anio, totales, facturaId }) {
  return renderPDF((doc) => {
    header(doc, {
      titulo: 'Resumen mensual de consumo',
      subtitulo: 'Uso agregado de máquinas y consumo estimado del edificio',
      nroFactura: facturaId || '—',
      periodo: `${MESES[mes - 1]} ${anio}`,
      edificio,
    });

    sectionTitle(doc, 'Movimientos de fichas');
    renderTable(doc,
      [
        { key: 'k', label: 'Concepto', width: 0.70 },
        { key: 'v', label: 'Cantidad', width: 0.30, align: 'right' },
      ],
      [
        { k: 'Fichas vendidas',       v: fmtNum(totales.fichas_vendidas) },
        { k: 'Fichas devueltas',      v: fmtNum(totales.fichas_devueltas) },
        { k: 'Lavados completados',   v: fmtNum(totales.lavados) },
        { k: 'Secados completados',   v: fmtNum(totales.secados) },
      ]
    );

    sectionTitle(doc, 'Consumo estimado');
    renderTable(doc,
      [
        { key: 'k', label: 'Servicio', width: 0.50 },
        { key: 'unit', label: 'Por ciclo', width: 0.25, align: 'right' },
        { key: 'v', label: 'Total del mes', width: 0.25, align: 'right' },
      ],
      [
        { k: 'Agua — lavarropas',  unit: `${fmtNum(config.litros_por_lavado)} l`,  v: `${fmtNum(totales.lavados * config.litros_por_lavado)} l` },
        { k: 'Agua — secadora',    unit: `${fmtNum(config.litros_por_secado)} l`,  v: `${fmtNum(totales.secados * config.litros_por_secado)} l` },
        { k: 'Electricidad — lav.', unit: `${fmtNum(config.kwh_por_lavado, 2)} kWh`, v: `${fmtNum(totales.lavados * config.kwh_por_lavado, 2)} kWh` },
        { k: 'Electricidad — sec.', unit: `${fmtNum(config.kwh_por_secado, 2)} kWh`, v: `${fmtNum(totales.secados * config.kwh_por_secado, 2)} kWh` },
      ],
      {
        totalRow: {
          k: 'Totales',
          unit: '',
          v: `${fmtNum(totales.litros_totales)} l · ${fmtNum(totales.kwh_totales, 2)} kWh`,
        },
      }
    );

    doc.moveDown(0.3);
    doc.fontSize(8).fillColor(BRAND.textMuted).font('Helvetica-Oblique')
       .text(
         'Los valores de consumo son estimaciones basadas en los parámetros configurados por el administrador del edificio (litros y kWh por ciclo).',
         { width: doc.page.width - 80 }
       );

    footer(doc, edificio);
  });
}

async function pdfResumenApto({ edificio, mes, anio, apartamento, movimientos, saldo_final, facturaId, titular_nombre }) {
  return renderPDF((doc) => {
    header(doc, {
      titulo: `Resumen del apartamento ${apartamento}`,
      subtitulo: titular_nombre ? `Titular: ${titular_nombre}` : 'Actividad del apartamento',
      nroFactura: facturaId || '—',
      periodo: `${MESES[mes - 1]} ${anio}`,
      edificio,
    });

    // KPI grandes en una fila
    const kpiY = doc.y;
    const totalKpi = 3;
    const boxW = (doc.page.width - 80 - (totalKpi - 1) * 10) / totalKpi;
    const kpis = [
      { label: 'Movimientos', value: String(movimientos.length) },
      { label: 'Saldo al cierre', value: `${saldo_final} fichas`, color: saldo_final <= 0 ? BRAND.danger : BRAND.success },
      { label: 'Apartamento', value: apartamento },
    ];
    kpis.forEach((k, i) => {
      const x = 40 + i * (boxW + 10);
      doc.save();
      doc.roundedRect(x, kpiY, boxW, 60, 8).fill(BRAND.bgSoft);
      doc.restore();
      doc.fontSize(9).fillColor(BRAND.textSoft).font('Helvetica').text(k.label, x + 12, kpiY + 12);
      doc.fontSize(18).fillColor(k.color || BRAND.primary).font('Helvetica-Bold')
         .text(k.value, x + 12, kpiY + 28, { width: boxW - 24 });
    });
    doc.y = kpiY + 70;

    sectionTitle(doc, 'Movimientos del período');
    if (movimientos.length === 0) {
      doc.fontSize(11).fillColor(BRAND.textMuted).font('Helvetica-Oblique')
         .text('Sin movimientos registrados en este período.');
    } else {
      renderTable(doc,
        [
          { key: 'fecha',       label: 'Fecha',       width: 0.14 },
          { key: 'tipo',        label: 'Tipo',        width: 0.14 },
          { key: 'descripcion', label: 'Descripción', width: 0.38 },
          { key: 'usuario',     label: 'Usuario',     width: 0.20 },
          { key: 'cantidad',    label: 'Fichas',      width: 0.14, align: 'right' },
        ],
        movimientos
      );
    }

    footer(doc, edificio);
  });
}

// ============================================================
// Infra
// ============================================================
async function uploadPDF(pdfBuffer, remoteName) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN no configurado');
  const { url } = await put(remoteName, pdfBuffer, {
    access: 'public',
    token,
    contentType: 'application/pdf',
    addRandomSuffix: true,
  });
  return url;
}

function tiposDesdeTransacciones(txs) {
  let fichas_vendidas = 0, fichas_devueltas = 0;
  for (const tx of txs) {
    if (tx.tipo === 'compra') fichas_vendidas += tx.cantidad;
    if (tx.tipo === 'devolucion') fichas_devueltas += tx.cantidad;
  }
  return { fichas_vendidas, fichas_devueltas };
}

async function calcularTotalesEdificio(edificio_id, mes, anio, config) {
  const { desde, hasta } = rangoMes(mes, anio);
  const [txs, usos] = await Promise.all([
    Transaccion.find({ edificio_id, fecha: { $gte: desde, $lt: hasta } }).lean(),
    Uso.find({ edificio_id, estado: 'completado', fecha_inicio: { $gte: desde, $lt: hasta } }).lean(),
  ]);
  const { fichas_vendidas, fichas_devueltas } = tiposDesdeTransacciones(txs);
  let lavados = 0, secados = 0;
  for (const u of usos) {
    if (u.tipo === 'secadora') secados++;
    else lavados++;
  }
  const litros_totales = lavados * (config.litros_por_lavado || 0) + secados * (config.litros_por_secado || 0);
  const kwh_totales = lavados * (config.kwh_por_lavado || 0) + secados * (config.kwh_por_secado || 0);
  return { fichas_vendidas, fichas_devueltas, lavados, secados, litros_totales, kwh_totales };
}

async function resumenApto(edificio_id, apartamento, mes, anio) {
  const { desde, hasta } = rangoMes(mes, anio);
  const txs = await Transaccion.find({ edificio_id, apartamento, fecha: { $gte: desde, $lt: hasta } }).sort({ fecha: 1 }).lean();
  const userIds = [...new Set(txs.map(t => t.usuario_id))];
  const usuarios = await Usuario.find({ usuario_id: { $in: userIds } }, { usuario_id: 1, nombre: 1 }).lean();
  const mapa = new Map(usuarios.map(u => [u.usuario_id, u.nombre]));
  const tipoLabel = {
    asignacion_mensual: 'Asignación',
    ajuste_admin: 'Ajuste',
    uso_maquina: 'Uso',
    devolucion: 'Devolución',
    compra: 'Compra',
  };
  const movimientos = txs.map(t => ({
    fecha: fmtFechaCorta(t.fecha) + ' ' + new Date(t.fecha).toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' }),
    tipo: tipoLabel[t.tipo] || t.tipo,
    descripcion: t.descripcion || '—',
    usuario: mapa.get(t.usuario_id) || t.usuario_id,
    cantidad: (t.cantidad >= 0 ? '+' : '') + t.cantidad,
  }));
  const all = await Transaccion.aggregate([
    { $match: { edificio_id, apartamento, fecha: { $lt: hasta } } },
    { $group: { _id: null, saldo: { $sum: '$cantidad' } } },
  ]);
  const saldo_final = all.length ? all[0].saldo : 0;

  // Titular del apto (para header del PDF)
  const titular = await Usuario.findOne({ edificio_id, apartamento, rol_apto: 'titular', activo: true }, { nombre: 1 }).lean();
  return { movimientos, saldo_final, titular_nombre: titular?.nombre || null };
}

async function upsertFactura({ edificio_id, mes, anio, tipo, apartamento, pdf_url, totales }) {
  return Factura.findOneAndUpdate(
    { edificio_id, mes, anio, tipo, apartamento: apartamento ?? null },
    { pdf_url, totales: totales || {}, generada: new Date() },
    { upsert: true, new: true }
  );
}

async function generarFacturasMes(edificio_id, mes, anio) {
  const config = await ConfigEdificio.findOne({ edificio_id }).lean();
  if (!config) throw new Error(`Config no encontrada para ${edificio_id}`);
  const edificio = await Edificio.findOne({ edificio_id }).lean() || { edificio_id, nombre: edificio_id };

  const totales = await calcularTotalesEdificio(edificio_id, mes, anio, config);
  const mesKey = `${anio}-${String(mes).padStart(2, '0')}`;
  const facturaBase = `${edificio_id}-${mesKey}`;

  // Upsert primero para tener el factura_id estable en el PDF
  const preA = await Factura.findOneAndUpdate(
    { edificio_id, mes, anio, tipo: 'ingreso', apartamento: null },
    { $setOnInsert: { pdf_url: '', totales: {} } }, { upsert: true, new: true }
  );
  const preB = await Factura.findOneAndUpdate(
    { edificio_id, mes, anio, tipo: 'consumo_resumen', apartamento: null },
    { $setOnInsert: { pdf_url: '', totales: {} } }, { upsert: true, new: true }
  );

  const pdfA = await pdfIngreso({ edificio, config, mes, anio, totales, facturaId: preA.factura_id });
  const urlA = await uploadPDF(pdfA, `facturas/${facturaBase}-ingreso.pdf`);
  const facA = await upsertFactura({ edificio_id, mes, anio, tipo: 'ingreso', apartamento: null, pdf_url: urlA, totales });

  const pdfB = await pdfConsumoResumen({ edificio, config, mes, anio, totales, facturaId: preB.factura_id });
  const urlB = await uploadPDF(pdfB, `facturas/${facturaBase}-consumo.pdf`);
  const facB = await upsertFactura({ edificio_id, mes, anio, tipo: 'consumo_resumen', apartamento: null, pdf_url: urlB, totales });

  // PDFs por apartamento
  const aptos = [...new Set((await Usuario.find({ edificio_id, activo: true }, { apartamento: 1 }).lean())
    .map(u => u.apartamento).filter(Boolean))];
  const aptoFacs = [];
  for (const apto of aptos) {
    const { movimientos, saldo_final, titular_nombre } = await resumenApto(edificio_id, apto, mes, anio);
    const preC = await Factura.findOneAndUpdate(
      { edificio_id, mes, anio, tipo: 'resumen_apto', apartamento: apto },
      { $setOnInsert: { pdf_url: '', totales: {} } }, { upsert: true, new: true }
    );
    const pdfC = await pdfResumenApto({ edificio, mes, anio, apartamento: apto, movimientos, saldo_final, facturaId: preC.factura_id, titular_nombre });
    const urlC = await uploadPDF(pdfC, `facturas/${facturaBase}-apto-${apto}.pdf`);
    const fac = await upsertFactura({
      edificio_id, mes, anio, tipo: 'resumen_apto', apartamento: apto, pdf_url: urlC,
      totales: { saldo_final, movimientos: movimientos.length },
    });
    aptoFacs.push(fac);
  }

  return { ingreso: facA, consumo: facB, aptos: aptoFacs };
}

module.exports = { generarFacturasMes, calcularTotalesEdificio };
