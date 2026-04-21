const Transaccion = require('../models/Transaccion');
const Usuario = require('../models/Usuario');
const ConfigEdificio = require('../models/ConfigEdificio');

// Saldo por apto: agrega todas las transacciones con (edificio_id, apartamento).
async function obtenerSaldoApto(edificio_id, apartamento) {
  if (!edificio_id || !apartamento) return 0;
  const result = await Transaccion.aggregate([
    { $match: { edificio_id, apartamento } },
    { $group: { _id: null, saldo: { $sum: '$cantidad' } } }
  ]);
  return result.length > 0 ? result[0].saldo : 0;
}

// Wrapper backwards-compat: resuelve el apto del usuario y devuelve el saldo del apto.
// Si el usuario no tiene apto (ej: admin), cae a la agregación por usuario_id.
async function obtenerSaldo(usuario_id) {
  const u = await Usuario.findOne({ usuario_id }, { edificio_id: 1, apartamento: 1 }).lean();
  if (u && u.edificio_id && u.apartamento) {
    return obtenerSaldoApto(u.edificio_id, u.apartamento);
  }
  const result = await Transaccion.aggregate([
    { $match: { usuario_id } },
    { $group: { _id: null, saldo: { $sum: '$cantidad' } } }
  ]);
  return result.length > 0 ? result[0].saldo : 0;
}

async function listarTransaccionesApto(edificio_id, apartamento, limite) {
  if (!edificio_id || !apartamento) return [];
  return Transaccion.find({ edificio_id, apartamento }).sort({ fecha: -1 }).limit(limite).lean();
}

async function handler(req, res) {
  try {
    // GET /api/billetera — saldo + movimientos del apto del usuario autenticado
    if (req.method === 'GET' && !req.query.usuarioId) {
      const usuario_id = req.usuario.usuario_id;
      const limite = parseInt(req.query.limite) || 20;

      const u = await Usuario.findOne({ usuario_id, activo: true }).lean();
      if (!u) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });

      const [saldo, transacciones] = await Promise.all([
        obtenerSaldoApto(u.edificio_id, u.apartamento),
        listarTransaccionesApto(u.edificio_id, u.apartamento, limite),
      ]);

      return res.json({ ok: true, saldo, transacciones });
    }

    // GET /api/billetera?usuarioId=X — saldo del apto de un usuario (admin / admin_edificio)
    if (req.method === 'GET' && req.query.usuarioId) {
      if (!['admin', 'admin_edificio'].includes(req.usuario.rol)) return res.status(403).json({ ok: false, error: 'Solo admin' });

      const usuario_id = req.query.usuarioId;
      const limite = parseInt(req.query.limite) || 20;

      const u = await Usuario.findOne({ usuario_id }).lean();
      if (!u) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
      if (req.usuario.rol === 'admin_edificio' && u.edificio_id !== req.usuario.edificio_id) {
        return res.status(403).json({ ok: false, error: 'El usuario no pertenece a tu edificio' });
      }

      const [saldo, transacciones] = await Promise.all([
        obtenerSaldoApto(u.edificio_id, u.apartamento),
        listarTransaccionesApto(u.edificio_id, u.apartamento, limite),
      ]);

      return res.json({ ok: true, saldo, transacciones });
    }

    // POST /api/billetera/creditos — agregar créditos a un usuario (admin o admin_edificio)
    if (req.method === 'POST' && req.path === '/api/billetera/creditos') {
      if (!['admin', 'admin_edificio'].includes(req.usuario.rol)) return res.status(403).json({ ok: false, error: 'Solo admin' });

      const { usuario_id, cantidad, descripcion } = req.body;
      if (!usuario_id || !cantidad) return res.status(400).json({ ok: false, error: 'usuario_id y cantidad son requeridos' });

      const usuario = await Usuario.findOne({ usuario_id, activo: true });
      if (!usuario) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });

      // admin_edificio solo puede acreditar a usuarios de su propio edificio
      if (req.usuario.rol === 'admin_edificio' && usuario.edificio_id !== req.usuario.edificio_id) {
        return res.status(403).json({ ok: false, error: 'El usuario no pertenece a tu edificio' });
      }

      const transaccion = await Transaccion.create({
        usuario_id,
        edificio_id: usuario.edificio_id,
        apartamento: usuario.apartamento,
        tipo: 'ajuste_admin',
        cantidad: Number(cantidad),
        descripcion: descripcion || `Ajuste manual por admin`,
        creado_por: req.usuario.usuario_id
      });

      const nuevo_saldo = await obtenerSaldoApto(usuario.edificio_id, usuario.apartamento);
      return res.json({ ok: true, transaccion, nuevo_saldo });
    }

    // POST /api/billetera/comprar — solo el TITULAR del apto compra fichas
    if (req.method === 'POST' && req.path === '/api/billetera/comprar') {
      const usuario_id = req.usuario.usuario_id;
      const pin = String(req.body?.pin ?? '').trim();
      const cantidad = Number(req.body?.cantidad);

      if (!/^\d{4}$/.test(pin)) return res.status(400).json({ ok: false, error: 'PIN inválido' });
      if (!Number.isInteger(cantidad) || cantidad < 1) return res.status(400).json({ ok: false, error: 'Cantidad inválida' });

      const usuario = await Usuario.findOne({ usuario_id, activo: true });
      if (!usuario) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });

      if (usuario.rol_apto !== 'titular' || usuario.estado_aprobacion !== 'aprobado') {
        return res.status(403).json({ ok: false, error: 'Solo el titular del apto puede comprar fichas' });
      }

      const pinOk = await usuario.compararPin(pin);
      if (!pinOk) return res.status(401).json({ ok: false, error: 'PIN incorrecto' });

      const config = await ConfigEdificio.findOne({ edificio_id: usuario.edificio_id }).lean();
      const maxCompra = config?.max_compra_fichas ?? 10;
      if (cantidad > maxCompra) return res.status(400).json({ ok: false, error: `El máximo por compra es ${maxCompra} fichas` });

      const transaccion = await Transaccion.create({
        usuario_id,
        edificio_id: usuario.edificio_id,
        apartamento: usuario.apartamento,
        tipo: 'compra',
        cantidad,
        descripcion: `Compra de ${cantidad} ficha${cantidad === 1 ? '' : 's'}`,
        creado_por: usuario_id
      });

      const nuevo_saldo = await obtenerSaldoApto(usuario.edificio_id, usuario.apartamento);
      return res.json({ ok: true, transaccion, nuevo_saldo });
    }

    // PATCH /api/billetera/pin — solo el TITULAR cambia su PIN de compra
    if (req.method === 'PATCH' && req.path === '/api/billetera/pin') {
      const usuario_id = req.usuario.usuario_id;
      const pinActual = String(req.body?.pin_actual ?? '').trim();
      const pinNuevo = String(req.body?.pin_nuevo ?? '').trim();

      if (!/^\d{4}$/.test(pinActual)) return res.status(400).json({ ok: false, error: 'PIN actual inválido' });
      if (!/^\d{4}$/.test(pinNuevo)) return res.status(400).json({ ok: false, error: 'El nuevo PIN debe ser de 4 dígitos' });

      const usuario = await Usuario.findOne({ usuario_id, activo: true });
      if (!usuario) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });

      if (usuario.rol_apto !== 'titular' || usuario.estado_aprobacion !== 'aprobado') {
        return res.status(403).json({ ok: false, error: 'Solo el titular del apto puede cambiar el PIN' });
      }

      const pinOk = await usuario.compararPin(pinActual);
      if (!pinOk) return res.status(401).json({ ok: false, error: 'PIN actual incorrecto' });

      usuario.pin_compra = pinNuevo;
      await usuario.save();
      return res.json({ ok: true });
    }

    // POST /api/billetera/creditos-masivo — admin / admin_edificio agrega créditos a todos los titulares de un edificio
    if (req.method === 'POST' && req.path === '/api/billetera/creditos-masivo') {
      if (!['admin', 'admin_edificio'].includes(req.usuario.rol)) return res.status(403).json({ ok: false, error: 'Solo admin' });

      const { edificio_id, cantidad, descripcion } = req.body;
      if (!edificio_id || !cantidad) return res.status(400).json({ ok: false, error: 'edificio_id y cantidad son requeridos' });
      if (req.usuario.rol === 'admin_edificio' && edificio_id !== req.usuario.edificio_id) {
        return res.status(403).json({ ok: false, error: 'No podés operar sobre otro edificio' });
      }

      // 1 crédito por apto, acreditado al titular aprobado
      const titulares = await Usuario.find({
        edificio_id, activo: true, rol: 'residente',
        rol_apto: 'titular', estado_aprobacion: 'aprobado',
      }).lean();
      if (titulares.length === 0) return res.status(404).json({ ok: false, error: 'No hay titulares aprobados en este edificio' });

      const transacciones = titulares.map(u => ({
        usuario_id: u.usuario_id,
        edificio_id,
        apartamento: u.apartamento,
        tipo: 'ajuste_admin',
        cantidad: Number(cantidad),
        descripcion: descripcion || `Créditos masivos por admin`,
        creado_por: req.usuario.usuario_id
      }));

      await Transaccion.insertMany(transacciones);
      return res.json({ ok: true, total_aptos: titulares.length, cantidad_por_apto: Number(cantidad) });
    }

    return res.status(405).json({ ok: false, error: 'Método no permitido' });
  } catch (err) {
    console.error('Error billetera:', err);
    return res.status(500).json({ ok: false, error: 'Error interno' });
  }
}

module.exports = handler;
module.exports.obtenerSaldo = obtenerSaldo;
module.exports.obtenerSaldoApto = obtenerSaldoApto;
