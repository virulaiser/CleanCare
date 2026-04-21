// Templates HTML para emails. Todos con la misma base (branding CleanCare).
// Inline styles porque clientes de email (Gmail, Outlook) ignoran <style>.

const C = {
  primary: '#3B82F6', primaryDk: '#1D4ED8', bgSoft: '#EFF6FF',
  text: '#0F172A', textSoft: '#475569', textMuted: '#94A3B8',
  success: '#16A34A', border: '#E5E7EB', white: '#FFFFFF',
};

function layout(titulo, body) {
  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>${titulo}</title></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:32px 12px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:${C.white};border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <tr><td style="background:${C.primary};padding:24px 32px;">
          <div style="font-size:22px;font-weight:700;color:${C.white};letter-spacing:0.5px;">CleanCare</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.85);margin-top:2px;">Sistema digital de lavandería</div>
        </td></tr>
        <tr><td style="padding:32px;color:${C.text};font-size:15px;line-height:1.55;">
          ${body}
        </td></tr>
        <tr><td style="padding:20px 32px;background:#F8FAFC;border-top:1px solid ${C.border};font-size:11px;color:${C.textMuted};">
          Este mensaje fue generado automáticamente por CleanCare.<br/>
          Si no esperabas este correo, podés ignorarlo.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function btn(href, label) {
  return `<a href="${href}" style="display:inline-block;background:${C.primary};color:${C.white};padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;font-size:14px;">${label}</a>`;
}

function kv(k, v) {
  return `<tr><td style="padding:6px 0;color:${C.textSoft};font-size:13px;">${k}</td><td style="padding:6px 0;color:${C.text};font-size:13px;font-weight:600;text-align:right;">${v}</td></tr>`;
}

// =========================================================================
// Plantillas concretas
// =========================================================================

function facturaMensual({ edificio, mes, anio, totales, precio_ficha, comision, urls }) {
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const periodo = `${meses[mes - 1]} ${anio}`;
  const totalComision = totales.fichas_vendidas * comision;
  const body = `
    <h2 style="margin:0 0 12px;font-size:22px;color:${C.text};">Tu facturación mensual</h2>
    <p style="margin:0 0 20px;color:${C.textSoft};">Ya están listos los documentos de <strong>${edificio.nombre}</strong> — ${periodo}.</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:${C.bgSoft};padding:20px;border-radius:10px;margin-bottom:20px;">
      ${kv('Fichas vendidas', totales.fichas_vendidas)}
      ${kv('Lavados', totales.lavados)}
      ${kv('Secados', totales.secados)}
      ${kv('Comisión CleanCare por ficha', `$ ${comision}`)}
      <tr><td colspan="2" style="padding:12px 0 0;border-top:1px solid ${C.border};"></td></tr>
      <tr><td style="padding:10px 0;color:${C.text};font-size:15px;font-weight:700;">Total a abonar</td>
          <td style="padding:10px 0;color:${C.primaryDk};font-size:20px;font-weight:800;text-align:right;">$ ${totalComision.toLocaleString('es-UY')}</td></tr>
    </table>

    <p style="margin:0 0 16px;color:${C.textSoft};">Documentos adjuntos: factura de comisión + resumen de consumo del edificio.</p>
    ${urls?.ingreso ? btn(urls.ingreso, 'Abrir factura') : ''} &nbsp;
    ${urls?.consumo ? btn(urls.consumo, 'Ver resumen de consumo') : ''}
  `;
  return { subject: `Facturación ${periodo} — ${edificio.nombre}`, html: layout('Facturación mensual', body) };
}

function cierreInquilino({ edificio, apartamento, titular, saldoFinal, pdfUrl }) {
  const body = `
    <h2 style="margin:0 0 12px;font-size:22px;color:${C.text};">Cierre de tu ocupación</h2>
    <p style="margin:0 0 16px;color:${C.textSoft};">Hola ${titular?.nombre || ''},</p>
    <p style="margin:0 0 16px;color:${C.textSoft};">
      Se cerró tu ocupación del apartamento <strong>${apartamento}</strong> del edificio <strong>${edificio.nombre}</strong>.
      Te enviamos el resumen con todos los movimientos del período.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:${C.bgSoft};padding:20px;border-radius:10px;margin-bottom:20px;">
      ${kv('Apartamento', apartamento)}
      ${kv('Saldo al cierre', `${saldoFinal} ficha${saldoFinal === 1 ? '' : 's'}`)}
    </table>
    ${pdfUrl ? btn(pdfUrl, 'Descargar resumen en PDF') : ''}
  `;
  return { subject: `Cierre de ocupación — Apto ${apartamento}`, html: layout('Cierre de ocupación', body) };
}

function aperturaInquilino({ edificio, apartamento, titular, pdfUrl }) {
  const body = `
    <h2 style="margin:0 0 12px;font-size:22px;color:${C.text};">¡Bienvenido a CleanCare!</h2>
    <p style="margin:0 0 16px;color:${C.textSoft};">Hola ${titular?.nombre || ''},</p>
    <p style="margin:0 0 16px;color:${C.textSoft};">
      Ya sos el titular del apartamento <strong>${apartamento}</strong> de <strong>${edificio.nombre}</strong>.
      Descargate la app y empezá a usar las máquinas.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:${C.bgSoft};padding:20px;border-radius:10px;margin-bottom:20px;">
      ${kv('Apartamento', apartamento)}
      ${kv('Saldo inicial', '0 fichas')}
      ${kv('PIN de compra por defecto', '1111')}
    </table>
    <p style="margin:0 0 16px;color:${C.textSoft};">
      Los miembros de tu apto que se registren quedan pendientes hasta que vos los aprobés desde la app.
    </p>
    ${pdfUrl ? btn(pdfUrl, 'Descargar bienvenida en PDF') : ''}
  `;
  return { subject: `Bienvenido a CleanCare — Apto ${apartamento}`, html: layout('Bienvenida', body) };
}

function nuevoMiembroPendiente({ apartamento, nuevoNombre, nuevoEmail }) {
  const body = `
    <h2 style="margin:0 0 12px;font-size:22px;color:${C.text};">Nueva solicitud de miembro</h2>
    <p style="margin:0 0 16px;color:${C.textSoft};">
      <strong>${nuevoNombre}</strong> (${nuevoEmail}) se registró y quiere unirse a tu apartamento <strong>${apartamento}</strong>.
    </p>
    <p style="margin:0 0 16px;color:${C.textSoft};">
      Ingresá a la app y aprobalo desde <em>Perfil → Miembros del apto</em> si lo conocés y vive con vos.
      Recordá que las fichas del apto se comparten entre todos los miembros aprobados.
    </p>
  `;
  return { subject: `Nueva solicitud en tu apartamento ${apartamento}`, html: layout('Nuevo miembro pendiente', body) };
}

function miembroAprobado({ apartamento, titularNombre }) {
  const body = `
    <h2 style="margin:0 0 12px;font-size:22px;color:${C.text};">Tu solicitud fue aprobada</h2>
    <p style="margin:0 0 16px;color:${C.textSoft};">
      ${titularNombre ? `${titularNombre} te aprobó como miembro` : 'Fuiste aprobado'} del apartamento <strong>${apartamento}</strong>.
    </p>
    <p style="margin:0 0 16px;color:${C.textSoft};">
      Ya podés lavar y secar en las máquinas del edificio. Las fichas se descuentan del saldo compartido del apto.
    </p>
  `;
  return { subject: `Fuiste aprobado en el apto ${apartamento}`, html: layout('Solicitud aprobada', body) };
}

module.exports = { facturaMensual, cierreInquilino, aperturaInquilino, nuevoMiembroPendiente, miembroAprobado };
