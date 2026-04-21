const ConfigEdificio = require('../models/ConfigEdificio');
const Factura = require('../models/Factura');
const Edificio = require('../models/Edificio');
const { generarFacturasMes } = require('../lib/facturacion');
const { notificar } = require('../lib/notificar');
const { facturaMensual } = require('../lib/email-templates');

function ultimoDiaDelMes(anio, mes) {
  return new Date(anio, mes, 0).getDate(); // mes 1-12
}

async function handler(req, res) {
  try {
    if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Método no permitido' });

    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && (!authHeader || authHeader !== `Bearer ${cronSecret}`)) {
      return res.status(401).json({ ok: false, error: 'No autorizado' });
    }

    const ahora = new Date();
    const anio = ahora.getFullYear();
    const mes = ahora.getMonth() + 1;
    const hoy = ahora.getDate();
    const last = ultimoDiaDelMes(anio, mes);

    const configs = await ConfigEdificio.find({ activo: true }).lean();
    const resultados = [];

    for (const cfg of configs) {
      const diaCfg = cfg.facturacion_dia || 31;
      const diaDisparo = Math.min(diaCfg, last); // si pide 31 en febrero, corre el 28/29
      if (hoy !== diaDisparo) { resultados.push({ edificio: cfg.edificio_id, skip: 'dia-no-coincide', diaCfg, hoy }); continue; }

      // Idempotencia: si ya hay una factura 'ingreso' del mes, saltar
      const ya = await Factura.findOne({ edificio_id: cfg.edificio_id, anio, mes, tipo: 'ingreso' }).lean();
      if (ya) { resultados.push({ edificio: cfg.edificio_id, skip: 'ya-generada' }); continue; }

      try {
        const r = await generarFacturasMes(cfg.edificio_id, mes, anio);

        // Notificación por email al admin del edificio (si está configurado)
        if (cfg.canal_preferido === 'email' && cfg.email_admin_edificio) {
          const edificio = await Edificio.findOne({ edificio_id: cfg.edificio_id }).lean() || { edificio_id: cfg.edificio_id };
          const { subject, html } = facturaMensual({
            edificio, mes, anio,
            totales: r.ingreso.totales,
            precio_ficha: cfg.precio_ficha_residente,
            comision: cfg.comision_cleancare,
            urls: { ingreso: r.ingreso.pdf_url, consumo: r.consumo.pdf_url },
          });
          await notificar({
            tipo: 'factura_mensual',
            destinatario_email: cfg.email_admin_edificio,
            canal: 'email',
            subject, html,
            attachments: [
              { filename: `factura-ingreso-${mes}-${anio}.pdf`, url: r.ingreso.pdf_url },
              { filename: `consumo-resumen-${mes}-${anio}.pdf`, url: r.consumo.pdf_url },
            ],
            relacionado: { tipo: 'factura', ref_id: r.ingreso.factura_id },
          }).catch((e) => console.warn('No se pudo notificar factura:', e.message));
        }

        resultados.push({ edificio: cfg.edificio_id, ok: true, aptos: r.aptos.length });
      } catch (err) {
        resultados.push({ edificio: cfg.edificio_id, error: err.message });
      }
    }

    return res.json({ ok: true, mes, anio, hoy, resultados });
  } catch (err) {
    console.error('Error cron facturacion:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

module.exports = handler;
