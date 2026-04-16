const connectDB = require('../lib/mongodb');
const Uso = require('../models/Uso');
const Usuario = require('../models/Usuario');
const Transaccion = require('../models/Transaccion');

// GET /api/resumen-apartamento?edificioId=X&mes=Y&anio=Z
// Agrupa el consumo del mes por apartamento (no por usuario).
// Las facturas van al dueño del apto, así que un apto con varios usuarios
// (pareja, familia) tiene consumo combinado.
module.exports = async (req, res) => {
  try {
    await connectDB();
    if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Método no permitido' });

    const { edificioId, mes, anio } = req.query;
    if (!edificioId || !mes || !anio) {
      return res.status(400).json({ ok: false, error: 'edificioId, mes y anio requeridos' });
    }

    const mesNum = parseInt(mes);
    const anioNum = parseInt(anio);
    const inicio = new Date(anioNum, mesNum - 1, 1);
    const fin = new Date(anioNum, mesNum, 1);

    // Agrupar usos por residente_id (apartamento) + tipo
    const usosPorApto = await Uso.aggregate([
      { $match: {
          edificio_id: edificioId,
          fecha: { $gte: inicio, $lt: fin },
          estado: { $in: ['completado', 'activo'] },
      }},
      { $group: {
          _id: { apartamento: '$residente_id', tipo: '$tipo' },
          cantidad: { $sum: 1 },
          minutos: { $sum: '$duracion_min' },
      }},
    ]);

    // Map apto → { lav, sec, min_lav, min_sec, usos_total, min_total }
    const map = {};
    usosPorApto.forEach((u) => {
      const apto = u._id.apartamento || '-';
      if (!map[apto]) map[apto] = { apartamento: apto, lavados: 0, secados: 0, min_lav: 0, min_sec: 0 };
      if (u._id.tipo === 'secadora') {
        map[apto].secados += u.cantidad;
        map[apto].min_sec += u.minutos;
      } else {
        map[apto].lavados += u.cantidad;
        map[apto].min_lav += u.minutos;
      }
    });

    // Traer usuarios del edificio agrupados por apto
    const usuarios = await Usuario.find({
      edificio_id: edificioId, rol: 'residente', activo: true,
    }).lean();

    const usuariosPorApto = {};
    for (const u of usuarios) {
      const apto = u.apartamento || '-';
      if (!usuariosPorApto[apto]) usuariosPorApto[apto] = [];
      usuariosPorApto[apto].push({
        usuario_id: u.usuario_id,
        nombre: u.nombre,
        email: u.email,
        telefono: u.telefono,
      });
    }

    // Saldo sumado por apto (suma saldos de sus usuarios)
    const usuario_ids = usuarios.map((u) => u.usuario_id);
    const saldos = await Transaccion.aggregate([
      { $match: { usuario_id: { $in: usuario_ids } } },
      { $group: { _id: '$usuario_id', saldo: { $sum: '$cantidad' } } },
    ]);
    const saldoPorUsuario = {};
    saldos.forEach((s) => { saldoPorUsuario[s._id] = s.saldo; });

    // Combinar: incluir aptos que tienen usuarios aunque no tengan usos
    const aptos = new Set([...Object.keys(map), ...Object.keys(usuariosPorApto)]);
    const resumen = Array.from(aptos).sort().map((apto) => {
      const c = map[apto] || { apartamento: apto, lavados: 0, secados: 0, min_lav: 0, min_sec: 0 };
      const uList = usuariosPorApto[apto] || [];
      const saldo_total = uList.reduce((s, u) => s + (saldoPorUsuario[u.usuario_id] || 0), 0);
      return {
        apartamento: apto,
        edificio_id: edificioId,
        usuarios: uList,
        cant_usuarios: uList.length,
        lavados: c.lavados,
        secados: c.secados,
        min_lavado: c.min_lav,
        min_secado: c.min_sec,
        usos_total: c.lavados + c.secados,
        minutos_total: c.min_lav + c.min_sec,
        saldo_total,
      };
    });

    res.json({
      ok: true,
      edificio: edificioId,
      mes: mesNum,
      anio: anioNum,
      resumen,
      total_aptos: resumen.length,
      total_usos: resumen.reduce((s, r) => s + r.usos_total, 0),
    });
  } catch (err) {
    console.error('Error resumen-apartamento:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
};
