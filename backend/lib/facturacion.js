const PDFDocument = require('pdfkit');
const { put } = require('@vercel/blob');

const Transaccion = require('../models/Transaccion');
const Usuario = require('../models/Usuario');
const Uso = require('../models/Uso');
const Maquina = require('../models/Maquina');
const ConfigEdificio = require('../models/ConfigEdificio');
const Edificio = require('../models/Edificio');
const Factura = require('../models/Factura');

function rangoMes(mes, anio) {
  const desde = new Date(anio, mes - 1, 1);
  const hasta = new Date(anio, mes, 1);
  return { desde, hasta };
}

function fmtMoney(n) {
  return `$${(Number(n) || 0).toLocaleString('es-UY', { maximumFractionDigits: 2 })}`;
}

async function renderPDF(build) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
  build(doc);
  doc.end();
  return done;
}

function header(doc, titulo, edificio, mes, anio) {
  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  doc.fillColor('#3B82F6').fontSize(22).text('CleanCare', { align: 'left' });
  doc.fillColor('#1E293B').fontSize(10).text('Sistema de lavandería inteligente', { align: 'left' });
  doc.moveDown(0.5);
  doc.fillColor('#0F172A').fontSize(16).text(titulo);
  doc.fillColor('#475569').fontSize(10).text(`${edificio?.nombre || edificio?.edificio_id} · ${meses[mes - 1]} ${anio}`);
  if (edificio?.direccion) doc.text(edificio.direccion);
  doc.moveDown(1);
  doc.strokeColor('#E5E7EB').moveTo(40, doc.y).lineTo(555, doc.y).stroke();
  doc.moveDown(0.5);
}

function kvRow(doc, k, v) {
  const y = doc.y;
  doc.fillColor('#475569').fontSize(11).text(k, 40, y, { width: 300 });
  doc.fillColor('#0F172A').fontSize(11).text(String(v), 340, y, { width: 215, align: 'right' });
  doc.moveDown(0.4);
}

function table(doc, columns, rows) {
  const startX = 40;
  const totalW = 515;
  const colW = columns.map(c => Math.round(totalW * (c.width || 1 / columns.length)));
  let y = doc.y;

  doc.fontSize(10).fillColor('#64748B');
  let x = startX;
  columns.forEach((c, i) => {
    doc.text(c.label, x, y, { width: colW[i], align: c.align || 'left' });
    x += colW[i];
  });
  y += 14;
  doc.strokeColor('#E5E7EB').moveTo(startX, y).lineTo(startX + totalW, y).stroke();
  y += 4;

  doc.fontSize(10).fillColor('#0F172A');
  rows.forEach((row) => {
    x = startX;
    let rowHeight = 0;
    columns.forEach((c, i) => {
      const h = doc.heightOfString(String(row[c.key] ?? '—'), { width: colW[i] });
      rowHeight = Math.max(rowHeight, h);
    });
    if (y + rowHeight > doc.page.height - 60) {
      doc.addPage();
      y = 40;
    }
    columns.forEach((c, i) => {
      doc.text(String(row[c.key] ?? '—'), x, y, { width: colW[i], align: c.align || 'left' });
      x += colW[i];
    });
    y += rowHeight + 6;
    doc.strokeColor('#F1F5F9').moveTo(startX, y - 2).lineTo(startX + totalW, y - 2).stroke();
  });
  doc.y = y + 4;
}

async function pdfIngreso({ edificio, config, mes, anio, totales }) {
  return renderPDF((doc) => {
    header(doc, 'Factura — Comisión CleanCare', edificio, mes, anio);
    doc.moveDown(0.5);
    kvRow(doc, 'Fichas vendidas en el mes', totales.fichas_vendidas);
    kvRow(doc, 'Precio por ficha al residente', fmtMoney(config.precio_ficha_residente));
    kvRow(doc, 'Ingreso total del edificio', fmtMoney(totales.fichas_vendidas * config.precio_ficha_residente));
    doc.moveDown(0.5);
    doc.strokeColor('#E5E7EB').moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.3);
    kvRow(doc, 'Comisión CleanCare por ficha vendida', fmtMoney(config.comision_cleancare));
    doc.moveDown(0.4);
    doc.fontSize(14).fillColor('#1D4ED8').text(
      `Total a abonar a CleanCare: ${fmtMoney(totales.fichas_vendidas * config.comision_cleancare)}`,
      { align: 'right' }
    );
    doc.moveDown(1);
    doc.fillColor('#475569').fontSize(9).text(
      'La diferencia entre el ingreso total y la comisión CleanCare corresponde al admin del edificio.',
      { align: 'left' }
    );
  });
}

async function pdfConsumoResumen({ edificio, config, mes, anio, totales }) {
  return renderPDF((doc) => {
    header(doc, 'Resumen de consumo', edificio, mes, anio);
    doc.moveDown(0.5);
    kvRow(doc, 'Fichas vendidas', totales.fichas_vendidas);
    kvRow(doc, 'Fichas devueltas', totales.fichas_devueltas);
    kvRow(doc, 'Lavados completados', totales.lavados);
    kvRow(doc, 'Secados completados', totales.secados);
    doc.moveDown(0.5);
    doc.fillColor('#0F172A').fontSize(13).text('Consumo estimado');
    doc.moveDown(0.2);
    kvRow(doc, 'Agua total (litros)', Math.round(totales.litros_totales));
    kvRow(doc, 'Electricidad total (kWh)', totales.kwh_totales.toFixed(2));
    doc.moveDown(0.5);
    doc.fillColor('#475569').fontSize(9).text(
      `Los valores de consumo son estimaciones según la configuración del edificio: ${config.litros_por_lavado} l y ${config.kwh_por_lavado} kWh por lavado, ${config.litros_por_secado} l y ${config.kwh_por_secado} kWh por secado.`,
    );
  });
}

async function pdfResumenApto({ edificio, mes, anio, apartamento, movimientos, saldo_final }) {
  return renderPDF((doc) => {
    header(doc, `Resumen apto ${apartamento}`, edificio, mes, anio);
    doc.moveDown(0.3);
    doc.fillColor('#0F172A').fontSize(12).text(`Saldo al cierre: ${saldo_final} fichas`, { align: 'left' });
    doc.moveDown(0.7);
    if (movimientos.length === 0) {
      doc.fillColor('#64748B').fontSize(11).text('Sin movimientos en este período.');
      return;
    }
    table(doc, [
      { key: 'fecha', label: 'Fecha', width: 0.18 },
      { key: 'tipo',  label: 'Tipo',  width: 0.16 },
      { key: 'descripcion', label: 'Descripción', width: 0.40 },
      { key: 'usuario',     label: 'Usuario', width: 0.16 },
      { key: 'cantidad',    label: 'Fichas', width: 0.10, align: 'right' },
    ], movimientos);
  });
}

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
  const tipoLabel = { asignacion_mensual: 'Asignación', ajuste_admin: 'Ajuste', uso_maquina: 'Uso', devolucion: 'Devolución', compra: 'Compra' };
  const movimientos = txs.map(t => ({
    fecha: new Date(t.fecha).toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit' }) + ' ' + new Date(t.fecha).toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' }),
    tipo: tipoLabel[t.tipo] || t.tipo,
    descripcion: t.descripcion || '—',
    usuario: mapa.get(t.usuario_id) || t.usuario_id,
    cantidad: (t.cantidad >= 0 ? '+' : '') + t.cantidad,
  }));
  // saldo final: todas las transacciones del apto <= hasta
  const all = await Transaccion.aggregate([
    { $match: { edificio_id, apartamento, fecha: { $lt: hasta } } },
    { $group: { _id: null, saldo: { $sum: '$cantidad' } } },
  ]);
  const saldo_final = all.length ? all[0].saldo : 0;
  return { movimientos, saldo_final };
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

  // PDF A — ingreso
  const pdfA = await pdfIngreso({ edificio, config, mes, anio, totales });
  const urlA = await uploadPDF(pdfA, `facturas/${edificio_id}/${mesKey}/ingreso.pdf`);
  const facA = await upsertFactura({ edificio_id, mes, anio, tipo: 'ingreso', apartamento: null, pdf_url: urlA, totales });

  // PDF B — consumo resumen
  const pdfB = await pdfConsumoResumen({ edificio, config, mes, anio, totales });
  const urlB = await uploadPDF(pdfB, `facturas/${edificio_id}/${mesKey}/consumo.pdf`);
  const facB = await upsertFactura({ edificio_id, mes, anio, tipo: 'consumo_resumen', apartamento: null, pdf_url: urlB, totales });

  // PDFs C — resumen por apto
  const aptos = [...new Set((await Usuario.find({ edificio_id, activo: true }, { apartamento: 1 }).lean())
    .map(u => u.apartamento).filter(Boolean))];
  const aptoFacs = [];
  for (const apto of aptos) {
    const { movimientos, saldo_final } = await resumenApto(edificio_id, apto, mes, anio);
    const pdfC = await pdfResumenApto({ edificio, mes, anio, apartamento: apto, movimientos, saldo_final });
    const urlC = await uploadPDF(pdfC, `facturas/${edificio_id}/${mesKey}/apto-${apto}.pdf`);
    const fac = await upsertFactura({ edificio_id, mes, anio, tipo: 'resumen_apto', apartamento: apto, pdf_url: urlC, totales: { saldo_final, movimientos: movimientos.length } });
    aptoFacs.push(fac);
  }

  return { ingreso: facA, consumo: facB, aptos: aptoFacs };
}

module.exports = { generarFacturasMes, calcularTotalesEdificio };
