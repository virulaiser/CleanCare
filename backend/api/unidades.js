const connectDB = require('../lib/mongodb');
const Unidad = require('../models/Unidad');

module.exports = async (req, res) => {
  try {
    await connectDB();

    // GET /api/unidades?edificioId=X — público (para dropdown del registro)
    if (req.method === 'GET') {
      const { edificioId, activa } = req.query;
      if (!edificioId) return res.status(400).json({ ok: false, error: 'Falta edificioId' });
      const filter = { edificio_id: edificioId };
      if (activa !== undefined) filter.activa = activa === 'true';
      const unidades = await Unidad.find(filter)
        .sort({ piso: 1, numero_apto: 1, codigo: 1 })
        .lean();
      return res.json({ ok: true, unidades });
    }

    // POST /api/unidades — admin: agregar unidad manual
    if (req.method === 'POST') {
      const { edificio_id, codigo, piso, numero_apto, es_extra, tipo_extra } = req.body;
      if (!edificio_id || !codigo) return res.status(400).json({ ok: false, error: 'Faltan edificio_id y codigo' });

      const unidad = await Unidad.create({
        edificio_id, codigo,
        piso: piso ?? null, numero_apto: numero_apto ?? null,
        es_extra: !!es_extra, tipo_extra: es_extra ? (tipo_extra || 'otro') : null,
      });
      return res.status(201).json({ ok: true, unidad });
    }

    // PATCH /api/unidades?id=X — admin: activar/desactivar
    if (req.method === 'PATCH') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ ok: false, error: 'Falta id' });

      const { activa, codigo } = req.body;
      const update = {};
      if (activa !== undefined) update.activa = !!activa;
      if (codigo) update.codigo = codigo;

      const unidad = await Unidad.findByIdAndUpdate(id, update, { new: true });
      if (!unidad) return res.status(404).json({ ok: false, error: 'Unidad no encontrada' });
      return res.json({ ok: true, unidad });
    }

    // DELETE /api/unidades?id=X — admin: borrado duro (solo si no hay usuarios)
    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ ok: false, error: 'Falta id' });
      const result = await Unidad.findByIdAndDelete(id);
      if (!result) return res.status(404).json({ ok: false, error: 'Unidad no encontrada' });
      return res.json({ ok: true });
    }

    return res.status(405).json({ ok: false, error: 'Método no permitido' });
  } catch (err) {
    console.error('Error unidades:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
};
