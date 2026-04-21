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
