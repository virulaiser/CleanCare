const ConfigEdificio = require('../models/ConfigEdificio');
const Usuario = require('../models/Usuario');
const Transaccion = require('../models/Transaccion');

async function handler(req, res) {
  try {
    if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Método no permitido' });

    // Verificar CRON_SECRET (Vercel envía el header Authorization: Bearer <CRON_SECRET>)
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && (!authHeader || authHeader !== `Bearer ${cronSecret}`)) {
      return res.status(401).json({ ok: false, error: 'No autorizado' });
    }

    const ahora = new Date();
    const primerDiaMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const primerDiaProximoMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1);
    const mesLabel = ahora.toLocaleString('es', { month: 'long', year: 'numeric' });

    const configs = await ConfigEdificio.find({ activo: true }).lean();
    let edificios_procesados = 0;
    let usuarios_acreditados = 0;

    for (const config of configs) {
      // Idempotencia: verificar que no se haya asignado este mes
      const yaAsignado = await Transaccion.findOne({
        edificio_id: config.edificio_id,
        tipo: 'asignacion_mensual',
        fecha: { $gte: primerDiaMes, $lt: primerDiaProximoMes }
      });

      if (yaAsignado) continue;

      const usuarios = await Usuario.find({
        edificio_id: config.edificio_id,
        activo: true,
        rol: 'residente'
      }).lean();

      if (usuarios.length === 0) continue;

      const transacciones = usuarios.map(u => ({
        usuario_id: u.usuario_id,
        edificio_id: config.edificio_id,
        tipo: 'asignacion_mensual',
        cantidad: config.creditos_mensuales,
        descripcion: `Asignación mensual ${mesLabel}`,
        creado_por: 'sistema'
      }));

      await Transaccion.insertMany(transacciones);
      edificios_procesados++;
      usuarios_acreditados += usuarios.length;
    }

    return res.json({ ok: true, edificios_procesados, usuarios_acreditados });
  } catch (err) {
    console.error('Error cron asignacion:', err);
    return res.status(500).json({ ok: false, error: 'Error interno' });
  }
}

module.exports = handler;
