const ConfigEdificio = require('../models/ConfigEdificio');

async function handler(req, res) {
  try {
    // GET /api/config-edificio?edificioId=X
    if (req.method === 'GET') {
      const edificio_id = req.query.edificioId;
      if (!edificio_id) return res.status(400).json({ ok: false, error: 'edificioId requerido' });

      let config = await ConfigEdificio.findOne({ edificio_id }).lean();
      if (!config) {
        config = { edificio_id, creditos_mensuales: 10, costo_lavado: 1, costo_secado: 1, duracion_lavado: 45, duracion_secado: 30, activo: true };
      }

      return res.json({ ok: true, config });
    }

    // PUT /api/config-edificio
    if (req.method === 'PUT') {
      const { edificio_id, creditos_mensuales, costo_lavado, costo_secado, duracion_lavado, duracion_secado } = req.body;
      if (!edificio_id) return res.status(400).json({ ok: false, error: 'edificio_id requerido' });

      const config = await ConfigEdificio.findOneAndUpdate(
        { edificio_id },
        {
          edificio_id,
          creditos_mensuales: creditos_mensuales ?? 10,
          costo_lavado: costo_lavado ?? 1,
          costo_secado: costo_secado ?? 1,
          duracion_lavado: duracion_lavado ?? 45,
          duracion_secado: duracion_secado ?? 30,
          activo: true,
          actualizado: new Date()
        },
        { upsert: true, new: true }
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
