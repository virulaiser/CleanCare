const ConfigEdificio = require('../models/ConfigEdificio');

const DEFAULTS = {
  creditos_mensuales: 10,
  costo_lavado: 1,
  costo_secado: 1,
  duracion_lavado: 45,
  duracion_secado: 30,
  max_compra_fichas: 10,
  precio_ficha_residente: 120,
  comision_cleancare: 33,
  litros_por_lavado: 60,
  litros_por_secado: 0,
  kwh_por_lavado: 1.2,
  kwh_por_secado: 2.5,
  facturacion_dia: 31,
  facturacion_hora: '23:59',
  email_admin_edificio: '',
  whatsapp_admin_edificio: '',
  canal_preferido: 'ninguno',
  activo: true,
};

async function handler(req, res) {
  try {
    // GET /api/config-edificio?edificioId=X
    if (req.method === 'GET') {
      const edificio_id = req.query.edificioId;
      if (!edificio_id) return res.status(400).json({ ok: false, error: 'edificioId requerido' });

      let config = await ConfigEdificio.findOne({ edificio_id }).lean();
      if (!config) {
        config = { edificio_id, ...DEFAULTS };
      } else {
        // Completar defaults de campos nuevos para configs preexistentes
        for (const k of Object.keys(DEFAULTS)) {
          if (config[k] == null) config[k] = DEFAULTS[k];
        }
        // Auto-corrección: si costo_lavado / costo_secado vienen con decimal
        // es casi seguro un mistake (el admin cargó pesos en vez de fichas).
        // En ese caso NO redondeamos al valor grande — forzamos a 1 (default sano).
        // Solo si es entero válido >=1 lo dejamos como está.
        const patch = {};
        const cl = Number(config.costo_lavado);
        const cs = Number(config.costo_secado);
        const clCorr = Number.isInteger(cl) && cl >= 1 ? cl : 1;
        const csCorr = Number.isInteger(cs) && cs >= 1 ? cs : 1;
        if (clCorr !== config.costo_lavado) patch.costo_lavado = clCorr;
        if (csCorr !== config.costo_secado) patch.costo_secado = csCorr;
        if (Object.keys(patch).length > 0) {
          await ConfigEdificio.updateOne({ edificio_id }, { $set: patch });
          Object.assign(config, patch);
          console.log(`[config] corregido costo_lavado/secado en ${edificio_id} (forzado a 1 por detectar decimal/inválido):`, patch);
        }
      }

      return res.json({ ok: true, config });
    }

    // PUT /api/config-edificio
    if (req.method === 'PUT') {
      const body = req.body || {};
      const { edificio_id } = body;
      if (!edificio_id) return res.status(400).json({ ok: false, error: 'edificio_id requerido' });

      // Construir update usando defaults cuando falten campos
      const update = { edificio_id, activo: true, actualizado: new Date() };
      for (const k of Object.keys(DEFAULTS)) {
        if (k === 'activo') continue;
        update[k] = body[k] !== undefined ? body[k] : DEFAULTS[k];
      }

      // Normalizar enteros donde corresponde (fichas, no pesos ni decimales)
      const INT_FIELDS = [
        'creditos_mensuales', 'costo_lavado', 'costo_secado',
        'duracion_lavado', 'duracion_secado',
        'max_compra_fichas', 'precio_ficha_residente', 'comision_cleancare',
        'facturacion_dia',
      ];
      for (const k of INT_FIELDS) {
        const n = Math.round(Number(update[k]));
        update[k] = Number.isFinite(n) && n >= 0 ? n : DEFAULTS[k];
      }
      // costo_lavado y costo_secado son fichas — mínimo 1
      if (update.costo_lavado < 1) update.costo_lavado = 1;
      if (update.costo_secado < 1) update.costo_secado = 1;

      const config = await ConfigEdificio.findOneAndUpdate(
        { edificio_id }, update, { upsert: true, new: true }
      );

      return res.json({ ok: true, config });
    }

    return res.status(405).json({ ok: false, error: 'Método no permitido' });
  } catch (err) {
    console.error('Error config-edificio:', err);
    return res.status(500).json({ ok: false, error: 'Error interno' });
  }
}

module.exports = handler;
