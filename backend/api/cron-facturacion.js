const ConfigEdificio = require('../models/ConfigEdificio');
const Factura = require('../models/Factura');
const { generarFacturasMes } = require('../lib/facturacion');

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
