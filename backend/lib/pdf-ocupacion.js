const PDFDocument = require('pdfkit');
const { put } = require('@vercel/blob');
const Usuario = require('../models/Usuario');
const Transaccion = require('../models/Transaccion');

const BRAND = {
  primary:    '#3B82F6',
  primaryDk:  '#1D4ED8',
  success:    '#16A34A',
  danger:     '#EF4444',
  text:       '#0F172A',
  textSoft:   '#475569',
  textMuted:  '#94A3B8',
  line:       '#E5E7EB',
  zebra:      '#F8FAFC',
  bgSoft:     '#EFF6FF',
};

function fmtFecha(d) {
  return new Date(d).toLocaleString('es-UY', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
function fmtFechaCorta(d) {
  return new Date(d).toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

async function renderPDF(build) {
  const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
  build(doc);
  doc.end();
  return done;
}

function header(doc, { titulo, subtitulo, nroFactura, edificio, apartamento }) {
  doc.save();
  doc.rect(0, 0, doc.page.width, 6).fill(BRAND.primary);
  doc.restore();

  doc.fillColor(BRAND.primary).fontSize(24).font('Helvetica-Bold').text('CleanCare', 40, 28);
  doc.fontSize(9).font('Helvetica').fillColor(BRAND.textSoft)
     .text('Sistema digital de lavandería', 40, 56);

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

  doc.moveTo(40, 100).lineTo(doc.page.width - 40, 100).strokeColor(BRAND.line).lineWidth(0.5).stroke();

  doc.fillColor(BRAND.text).fontSize(18).font('Helvetica-Bold').text(titulo, 40, 115);
  if (subtitulo) {
    doc.fontSize(10).font('Helvetica').fillColor(BRAND.textSoft).text(subtitulo);
  }

  doc.moveDown(0.8);
  const rowY = doc.y;
  doc.fontSize(8).fillColor(BRAND.textMuted).font('Helvetica').text('EDIFICIO', 40, rowY);
  doc.fontSize(11).fillColor(BRAND.text).font('Helvetica-Bold').text(edificio?.nombre || edificio?.edificio_id || '—', 40, rowY + 10);

  doc.fontSize(8).fillColor(BRAND.textMuted).font('Helvetica').text('APARTAMENTO', 220, rowY);
  doc.fontSize(11).fillColor(BRAND.text).font('Helvetica-Bold').text(apartamento || '—', 220, rowY + 10);

  doc.fontSize(8).fillColor(BRAND.textMuted).font('Helvetica').text('DIRECCIÓN', 400, rowY);
  doc.fontSize(10).fillColor(BRAND.text).font('Helvetica').text(edificio?.direccion || '—', 400, rowY + 10, { width: 155 });

  doc.y = rowY + 40;
  doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).strokeColor(BRAND.line).lineWidth(0.5).stroke();
  doc.moveDown(0.8);
}

function sectionTitle(doc, texto) {
  doc.moveDown(0.3);
  doc.fontSize(11).fillColor(BRAND.primary).font('Helvetica-Bold').text(texto);
  doc.moveTo(40, doc.y + 2).lineTo(doc.page.width - 40, doc.y + 2)
     .strokeColor(BRAND.line).lineWidth(0.5).stroke();
  doc.moveDown(0.5);
}

function renderTable(doc, columns, rows, { totalRow } = {}) {
  const startX = 40;
  const totalW = doc.page.width - 80;
  const colW = columns.map(c => Math.round(totalW * c.width));

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

  doc.font('Helvetica').fontSize(9.5).fillColor(BRAND.text);
  let zebra = false;
  for (const row of rows) {
    let rowHeight = 16;
    columns.forEach((c, i) => {
      const h = doc.heightOfString(String(row[c.key] ?? '—'), { width: colW[i] - 16 }) + 8;
      if (h > rowHeight) rowHeight = h;
    });

    if (y + rowHeight > doc.page.height - 80) {
      doc.addPage();
      y = 40;
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

    if (zebra) {
      doc.save();
      doc.rect(startX, y, totalW, rowHeight).fill(BRAND.zebra);
      doc.restore();
    }
    zebra = !zebra;

    doc.font('Helvetica').fontSize(9.5).fillColor(BRAND.text);
    x = startX;
    columns.forEach((c, i) => {
      const val = String(row[c.key] ?? '—');
      doc.text(val, x + 8, y + 5, { width: colW[i] - 16, align: c.align || 'left' });
      x += colW[i];
    });
    y += rowHeight;
  }

  if (totalRow) {
    doc.save();
    doc.rect(startX, y, totalW, 24).fill(BRAND.bgSoft);
    doc.restore();
    doc.fontSize(10).fillColor(BRAND.primaryDk).font('Helvetica-Bold');
    let tx = startX;
    columns.forEach((c, i) => {
      doc.text(String(totalRow[c.key] ?? ''), tx + 8, y + 7, { width: colW[i] - 16, align: c.align || 'left' });
      tx += colW[i];
    });
    y += 24;
  }

  doc.y = y + 6;
}

function footer(doc) {
  const y = doc.page.height - 70;
  doc.moveTo(40, y).lineTo(doc.page.width - 40, y).strokeColor(BRAND.line).lineWidth(0.5).stroke();
  doc.fontSize(8).fillColor(BRAND.textMuted).font('Helvetica');
  doc.text('CleanCare · Sistema digital de lavandería', 40, y + 8);
  doc.text(`Documento generado automáticamente · ${fmtFecha(new Date())}`, 40, y + 20);
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

// ============================================================
// PDF de cierre de inquilino
// ============================================================
async function pdfCierreInquilino({ edificio, apartamento, ocupacion, titular, miembros, movimientos, saldoFinal, ocupacionId }) {
  return renderPDF((doc) => {
    const desde = fmtFechaCorta(ocupacion.desde);
    const hasta = fmtFechaCorta(ocupacion.hasta || new Date());

    header(doc, {
      titulo: 'Cierre de ocupación del apartamento',
      subtitulo: `Período de ocupación: ${desde} → ${hasta}`,
      nroFactura: ocupacionId,
      edificio, apartamento,
    });

    // Personas de la ocupación
    sectionTitle(doc, 'Inquilino saliente');
    doc.fontSize(11).fillColor(BRAND.text).font('Helvetica-Bold')
       .text(`Titular: ${titular?.nombre || '—'}`, { continued: false });
    if (titular?.email)    doc.font('Helvetica').fontSize(9.5).fillColor(BRAND.textSoft).text(`Email: ${titular.email}`);
    if (titular?.telefono) doc.font('Helvetica').fontSize(9.5).fillColor(BRAND.textSoft).text(`Teléfono: ${titular.telefono}`);
    if (miembros?.length) {
      doc.moveDown(0.3);
      doc.fontSize(10).fillColor(BRAND.textSoft).font('Helvetica-Bold').text(`Convivientes (${miembros.length}):`);
      miembros.forEach((m) => {
        doc.fontSize(9.5).fillColor(BRAND.text).font('Helvetica').text(`• ${m.nombre}${m.email ? ' — ' + m.email : ''}`);
      });
    }
    doc.moveDown(0.5);

    // Saldo destacado
    const y0 = doc.y;
    doc.save();
    doc.roundedRect(40, y0, doc.page.width - 80, 64, 8).fill(BRAND.bgSoft);
    doc.restore();
    doc.fontSize(10).fillColor(BRAND.textSoft).font('Helvetica')
       .text('Saldo al momento del cierre', 52, y0 + 12);
    doc.fontSize(22).fillColor(saldoFinal > 0 ? BRAND.success : BRAND.textSoft).font('Helvetica-Bold')
       .text(`${saldoFinal} ficha${saldoFinal === 1 ? '' : 's'}`, 52, y0 + 28);
    doc.fontSize(9).fillColor(BRAND.textMuted).font('Helvetica-Oblique')
       .text('Al cierre, el saldo del apartamento se reinicia a 0 para el siguiente inquilino.', 52, y0 + 52, { width: doc.page.width - 120 });
    doc.y = y0 + 74;

    // Tabla de movimientos
    sectionTitle(doc, 'Movimientos durante la ocupación');
    if (!movimientos || movimientos.length === 0) {
      doc.fontSize(11).fillColor(BRAND.textMuted).font('Helvetica-Oblique')
         .text('Sin movimientos registrados en este período.');
    } else {
      renderTable(doc,
        [
          { key: 'fecha',       label: 'Fecha',       width: 0.16 },
          { key: 'tipo',        label: 'Tipo',        width: 0.14 },
          { key: 'descripcion', label: 'Descripción', width: 0.42 },
          { key: 'usuario',     label: 'Usuario',     width: 0.18 },
          { key: 'cantidad',    label: 'Fichas',      width: 0.10, align: 'right' },
        ],
        movimientos
      );
    }

    footer(doc);
  });
}

// ============================================================
// PDF de apertura (bienvenida al nuevo inquilino)
// ============================================================
async function pdfApertura({ edificio, apartamento, titular, ocupacionId }) {
  return renderPDF((doc) => {
    header(doc, {
      titulo: 'Bienvenida al sistema CleanCare',
      subtitulo: 'Comienzo de tu ocupación',
      nroFactura: ocupacionId,
      edificio, apartamento,
    });

    sectionTitle(doc, 'Tus datos');
    doc.fontSize(11).fillColor(BRAND.text).font('Helvetica-Bold').text(`Titular: ${titular?.nombre || '—'}`);
    if (titular?.email)    doc.font('Helvetica').fontSize(9.5).fillColor(BRAND.textSoft).text(`Email: ${titular.email}`);
    if (titular?.telefono) doc.font('Helvetica').fontSize(9.5).fillColor(BRAND.textSoft).text(`Teléfono: ${titular.telefono}`);
    doc.moveDown(0.6);

    // Saldo inicial
    const y0 = doc.y;
    doc.save();
    doc.roundedRect(40, y0, doc.page.width - 80, 62, 8).fill(BRAND.bgSoft);
    doc.restore();
    doc.fontSize(10).fillColor(BRAND.textSoft).font('Helvetica').text('Saldo inicial del apartamento', 52, y0 + 12);
    doc.fontSize(22).fillColor(BRAND.primary).font('Helvetica-Bold').text('0 fichas', 52, y0 + 28);
    doc.fontSize(9).fillColor(BRAND.textMuted).font('Helvetica-Oblique')
       .text('Vas a recibir la asignación mensual del edificio. También podés comprar fichas desde la app o el panel.', 52, y0 + 50, { width: doc.page.width - 120 });
    doc.y = y0 + 72;

    sectionTitle(doc, 'Primeros pasos');
    const pasos = [
      '1. Descargá la app CleanCare desde panel-three-blush.vercel.app',
      '2. Iniciá sesión con tu email y la contraseña que recibiste',
      '3. Tu PIN de compra por defecto es 1111 — cambialo en la billetera',
      '4. Los miembros de tu apto deben registrarse y esperar tu aprobación',
      '5. Para lavar, acercate a la máquina y usá el botón Bluetooth',
    ];
    pasos.forEach((p) => {
      doc.fontSize(10).fillColor(BRAND.text).font('Helvetica').text(p);
      doc.moveDown(0.1);
    });
    doc.moveDown(0.5);

    sectionTitle(doc, 'Contacto del edificio');
    doc.fontSize(10).fillColor(BRAND.text).font('Helvetica').text(`Administrador: ${edificio?.admin_nombre || '—'}`);
    if (edificio?.admin_telefono) doc.text(`Teléfono: ${edificio.admin_telefono}`);

    footer(doc);
  });
}

module.exports = { pdfCierreInquilino, pdfApertura, uploadPDF };
