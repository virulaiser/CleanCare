const Notificacion = require('../models/Notificacion');
const { sendEmail } = require('./email');

/**
 * Crea una Notificación en BD y opcionalmente la despacha por email.
 * Si no hay proveedor de email configurado, queda como 'pendiente'/'descartada'
 * pero el registro en BD siempre existe — sirve como historial.
 */
async function notificar({
  tipo,
  destinatario_usuario_id = null,
  destinatario_email = null,
  destinatario_whatsapp = null,
  canal = 'email',
  subject = '',
  html = '',
  attachments = [],
  relacionado = null,
}) {
  const doc = await Notificacion.create({
    tipo,
    destinatario_usuario_id,
    destinatario_email,
    destinatario_whatsapp,
    canal,
    subject,
    body_html: html,
    attachments: attachments.map((a) => ({ filename: a.filename, url: a.url || a.path })),
    estado: 'pendiente',
    relacionado,
  });

  if (canal === 'email' && destinatario_email) {
    const r = await sendEmail({ to: destinatario_email, subject, html, attachments });
    if (r.ok) {
      doc.estado = 'enviada';
      doc.enviada_en = new Date();
      doc.proveedor = r.proveedor || 'resend';
      doc.proveedor_id = r.id || null;
    } else {
      doc.estado = r.reason === 'SIN_PROVEEDOR' ? 'pendiente' : 'error';
      doc.error = r.reason || r.error || 'unknown';
    }
    await doc.save();
  } else if (canal === 'whatsapp') {
    doc.estado = 'pendiente';
    doc.error = 'canal_whatsapp_no_implementado';
    await doc.save();
  } else if (canal === 'in_app') {
    // Solo queda en BD para mostrar en la app/panel
    doc.estado = 'enviada';
    doc.enviada_en = new Date();
    await doc.save();
  }

  return doc;
}

module.exports = { notificar };
