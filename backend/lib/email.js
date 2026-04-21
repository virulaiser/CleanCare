// Wrapper del proveedor de email. Hoy: Resend. Mañana: cambiar un solo archivo.
// Si no hay RESEND_API_KEY, queda en modo no-op (loguea y retorna error suave).
let resendClient = null;
try {
  const { Resend } = require('resend');
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) resendClient = new Resend(apiKey);
} catch (err) {
  console.warn('[email] Resend no instalado o falló la carga:', err.message);
}

const FROM = process.env.EMAIL_FROM || 'CleanCare <onboarding@resend.dev>';

async function sendEmail({ to, subject, html, attachments }) {
  if (!to) return { ok: false, reason: 'SIN_DESTINATARIO' };
  if (!resendClient) {
    console.warn(`[email] no-op (sin RESEND_API_KEY). Hubiera enviado: ${subject} → ${to}`);
    return { ok: false, reason: 'SIN_PROVEEDOR' };
  }
  try {
    const payload = { from: FROM, to, subject, html };
    if (attachments && attachments.length > 0) {
      payload.attachments = attachments.map((a) => ({ filename: a.filename, path: a.url }));
    }
    const res = await resendClient.emails.send(payload);
    if (res.error) {
      return { ok: false, error: res.error.message || String(res.error) };
    }
    return { ok: true, id: res.data?.id, proveedor: 'resend' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = { sendEmail, FROM_DEFAULT: FROM };
