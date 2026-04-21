const connectDB = require('../lib/mongodb');
const Factura = require('../models/Factura');
const Usuario = require('../models/Usuario');
const { generarFacturasMes } = require('../lib/facturacion');

module.exports = async (req, res) => {
  try {
    await connectDB();

    // Residente pide sus propios PDFs por apto
    if (req.method === 'GET' && req.path === '/api/facturacion/aptos/mios') {
      const u = await Usuario.findOne({ usuario_id: req.usuario.usuario_id, activo: true }).lean();
      if (!u) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
      const facturas = await Factura.find({
        edificio_id: u.edificio_id,
        apartamento: u.apartamento,
        tipo: 'resumen_apto',
      }).sort({ anio: -1, mes: -1 }).lean();
      return res.json({ ok: true, facturas });
    }

    const esSuper = req.usuario?.rol === 'admin';
    const esEdi = req.usuario?.rol === 'admin_edificio';

    if (req.method === 'GET' && req.path === '/api/facturacion') {
      if (!esSuper && !esEdi) return res.status(403).json({ ok: false, error: 'Solo admin' });
      const filter = {};
      if (esEdi) filter.edificio_id = req.usuario.edificio_id;
      else if (req.query.edificioId) filter.edificio_id = req.query.edificioId;
      if (req.query.mes)  filter.mes = Number(req.query.mes);
      if (req.query.anio) filter.anio = Number(req.query.anio);
      if (req.query.tipo) filter.tipo = req.query.tipo;
      if (req.query.apartamento) filter.apartamento = req.query.apartamento;
      const facturas = await Factura.find(filter).sort({ generada: -1 }).limit(500).lean();
      return res.json({ ok: true, facturas });
    }

    // POST /api/facturacion/generar — forzar generación de un mes/edificio (idempotente)
    if (req.method === 'POST' && req.path === '/api/facturacion/generar') {
      if (!esSuper && !esEdi) return res.status(403).json({ ok: false, error: 'Solo admin' });
      const { edificio_id, mes, anio } = req.body || {};
      if (!edificio_id || !mes || !anio) return res.status(400).json({ ok: false, error: 'edificio_id, mes, anio requeridos' });
      if (esEdi && edificio_id !== req.usuario.edificio_id) {
        return res.status(403).json({ ok: false, error: 'No podés operar sobre otro edificio' });
      }
      const resumen = await generarFacturasMes(edificio_id, Number(mes), Number(anio));
      return res.json({ ok: true, resumen });
    }

    return res.status(405).json({ ok: false, error: 'Método no permitido' });
  } catch (err) {
    console.error('Error facturacion:', err);
    return res.status(500).json({ ok: false, error: err.message || 'Error interno' });
  }
};
