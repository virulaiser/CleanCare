const Transaccion = require('../models/Transaccion');
const Usuario = require('../models/Usuario');

async function handler(req, res) {
  try {
    if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Método no permitido' });

    const { edificioId, mes, anio } = req.query;
    if (!edificioId || !mes || !anio) {
      return res.status(400).json({ ok: false, error: 'edificioId, mes y anio requeridos' });
    }

    const mesNum = parseInt(mes);
    const anioNum = parseInt(anio);
    const inicio = new Date(anioNum, mesNum - 1, 1);
    const fin = new Date(anioNum, mesNum, 1);

    // Aggregate transactions per user for the month
    const consumo = await Transaccion.aggregate([
      {
        $match: {
          edificio_id: edificioId,
          fecha: { $gte: inicio, $lt: fin }
        }
      },
      {
        $group: {
          _id: '$usuario_id',
          creditos_usados: {
            $sum: { $cond: [{ $eq: ['$tipo', 'uso_maquina'] }, { $abs: '$cantidad' }, 0] }
          },
          creditos_asignados: {
            $sum: {
              $cond: [
                { $in: ['$tipo', ['asignacion_mensual', 'ajuste_admin']] },
                '$cantidad',
                0
              ]
            }
          },
          devoluciones: {
            $sum: { $cond: [{ $eq: ['$tipo', 'devolucion'] }, '$cantidad', 0] }
          }
        }
      }
    ]);

    // Get user details and current balances
    const usuario_ids = consumo.map(c => c._id);
    const usuarios = await Usuario.find({ usuario_id: { $in: usuario_ids } }).lean();
    const usuarioMap = {};
    usuarios.forEach(u => { usuarioMap[u.usuario_id] = u; });

    // Get current balances for all users
    const saldos = await Transaccion.aggregate([
      { $match: { usuario_id: { $in: usuario_ids } } },
      { $group: { _id: '$usuario_id', saldo_actual: { $sum: '$cantidad' } } }
    ]);
    const saldoMap = {};
    saldos.forEach(s => { saldoMap[s._id] = s.saldo_actual; });

    const resumen = consumo.map(c => ({
      usuario_id: c._id,
      nombre: usuarioMap[c._id]?.nombre || c._id,
      apartamento: usuarioMap[c._id]?.apartamento || '-',
      creditos_usados: c.creditos_usados,
      creditos_asignados: c.creditos_asignados,
      devoluciones: c.devoluciones,
      saldo_actual: saldoMap[c._id] || 0
    }));

    const total_creditos_consumidos = resumen.reduce((sum, r) => sum + r.creditos_usados, 0);

    return res.json({
      ok: true,
      edificio: edificioId,
      mes: mesNum,
      anio: anioNum,
      resumen,
      total_creditos_consumidos
    });
  } catch (err) {
    console.error('Error resumen-creditos:', err);
    return res.status(500).json({ ok: false, error: 'Error interno' });
  }
}

module.exports = handler;
