const connectDB = require('../lib/mongodb');
const Transaccion = require('../models/Transaccion');

// POST /api/admin/fix-fichas-decimales?dryRun=1
// Recorre transacciones tipo 'uso_maquina' con cantidad decimal (no entera)
// y emite una transacción compensatoria 'ajuste_admin' por cada una,
// de modo que el costo efectivo del ciclo quede en -1 ficha.
//
// Idempotente: usa referencia_id = `<uso_tx_id>_fix` para evitar duplicar ajustes.
//
// Protección: solo super-admin (enforzado en index.js con soloAdmin).
module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Método no permitido' });
    await connectDB();

    const dryRun = req.query.dryRun === '1' || req.query.dryRun === 'true';
    const edificioId = req.query.edificioId; // opcional: limitar a un edificio

    const filter = { tipo: 'uso_maquina' };
    if (edificioId) filter.edificio_id = edificioId;

    const txs = await Transaccion.find(filter).lean();
    const decimales = txs.filter((t) => {
      const n = Number(t.cantidad);
      return Number.isFinite(n) && n !== Math.trunc(n);
    });

    if (decimales.length === 0) {
      return res.json({ ok: true, mensaje: 'Sin transacciones decimales', detectadas: 0, corregidas: 0 });
    }

    const correcciones = [];
    let aplicadas = 0;
    let yaExistian = 0;

    for (const tx of decimales) {
      // cantidad original es negativa (ej -9.56) → compensar con +(|cantidad|-1)
      const costoOriginal = Math.abs(Number(tx.cantidad));
      const ajuste = costoOriginal - 1; // puede ser decimal, por ej 8.56
      if (ajuste <= 0) continue;

      const referencia = `${tx._id.toString()}_fix`;

      // Idempotencia
      const existe = await Transaccion.findOne({ referencia_id: referencia, tipo: 'ajuste_admin' }).lean();
      if (existe) {
        yaExistian++;
        correcciones.push({
          tx_id: tx._id,
          usuario_id: tx.usuario_id,
          apartamento: tx.apartamento,
          original: tx.cantidad,
          ajuste,
          status: 'ya-corregida',
        });
        continue;
      }

      correcciones.push({
        tx_id: tx._id,
        usuario_id: tx.usuario_id,
        apartamento: tx.apartamento,
        edificio_id: tx.edificio_id,
        original: tx.cantidad,
        ajuste,
        status: dryRun ? 'dry-run' : 'aplicada',
      });

      if (!dryRun) {
        await Transaccion.create({
          usuario_id: tx.usuario_id,
          edificio_id: tx.edificio_id,
          apartamento: tx.apartamento,
          tipo: 'ajuste_admin',
          cantidad: ajuste,
          descripcion: `Corrección fichas decimales (uso ${tx.descripcion || tx._id})`,
          referencia_id: referencia,
          creado_por: req.usuario?.usuario_id || 'sistema',
        });
        aplicadas++;
      }
    }

    return res.json({
      ok: true,
      dryRun,
      detectadas: decimales.length,
      corregidas_ahora: aplicadas,
      ya_corregidas_antes: yaExistian,
      correcciones,
    });
  } catch (err) {
    console.error('Error admin-fix-fichas:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
};
