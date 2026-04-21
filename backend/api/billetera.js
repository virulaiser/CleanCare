const Transaccion = require('../models/Transaccion');
const Usuario = require('../models/Usuario');
const ConfigEdificio = require('../models/ConfigEdificio');

async function obtenerSaldo(usuario_id) {
  const result = await Transaccion.aggregate([
    { $match: { usuario_id } },
    { $group: { _id: null, saldo: { $sum: '$cantidad' } } }
  ]);
  return result.length > 0 ? result[0].saldo : 0;
}

async function handler(req, res) {
  try {
    // GET /api/billetera — saldo del usuario autenticado
    if (req.method === 'GET' && !req.query.usuarioId) {
      const usuario_id = req.usuario.usuario_id;
      const limite = parseInt(req.query.limite) || 20;

      const [saldo, transacciones] = await Promise.all([
        obtenerSaldo(usuario_id),
        Transaccion.find({ usuario_id }).sort({ fecha: -1 }).limit(limite).lean()
      ]);

      return res.json({ ok: true, saldo, transacciones });
    }

    // GET /api/billetera?usuarioId=X — saldo de un usuario (admin)
    if (req.method === 'GET' && req.query.usuarioId) {
      if (req.usuario.rol !== 'admin') return res.status(403).json({ ok: false, error: 'Solo admin' });

      const usuario_id = req.query.usuarioId;
      const limite = parseInt(req.query.limite) || 20;

      const [saldo, transacciones] = await Promise.all([
        obtenerSaldo(usuario_id),
        Transaccion.find({ usuario_id }).sort({ fecha: -1 }).limit(limite).lean()
      ]);

      return res.json({ ok: true, saldo, transacciones });
    }

    // POST /api/billetera/creditos — agregar créditos a un usuario (admin)
    if (req.method === 'POST' && req.path === '/api/billetera/creditos') {
      if (req.usuario.rol !== 'admin') return res.status(403).json({ ok: false, error: 'Solo admin' });

      const { usuario_id, cantidad, descripcion } = req.body;
      if (!usuario_id || !cantidad) return res.status(400).json({ ok: false, error: 'usuario_id y cantidad son requeridos' });

      const usuario = await Usuario.findOne({ usuario_id, activo: true });
      if (!usuario) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });

      const transaccion = await Transaccion.create({
        usuario_id,
        edificio_id: usuario.edificio_id,
        tipo: 'ajuste_admin',
        cantidad: Number(cantidad),
        descripcion: descripcion || `Ajuste manual por admin`,
        creado_por: req.usuario.usuario_id
      });

      const nuevo_saldo = await obtenerSaldo(usuario_id);
      return res.json({ ok: true, transaccion, nuevo_saldo });
    }

    // POST /api/billetera/comprar — residente compra fichas usando su PIN
    if (req.method === 'POST' && req.path === '/api/billetera/comprar') {
      const usuario_id = req.usuario.usuario_id;
      const pin = String(req.body?.pin ?? '').trim();
      const cantidad = Number(req.body?.cantidad);

      if (!/^\d{4}$/.test(pin)) return res.status(400).json({ ok: false, error: 'PIN inválido' });
      if (!Number.isInteger(cantidad) || cantidad < 1) return res.status(400).json({ ok: false, error: 'Cantidad inválida' });

      const usuario = await Usuario.findOne({ usuario_id, activo: true });
      if (!usuario) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });

      const pinOk = await usuario.compararPin(pin);
      if (!pinOk) return res.status(401).json({ ok: false, error: 'PIN incorrecto' });

      // Validar tope configurado por el admin
      const config = await ConfigEdificio.findOne({ edificio_id: usuario.edificio_id }).lean();
      const maxCompra = config?.max_compra_fichas ?? 10;
      if (cantidad > maxCompra) return res.status(400).json({ ok: false, error: `El máximo por compra es ${maxCompra} fichas` });

      const transaccion = await Transaccion.create({
        usuario_id,
        edificio_id: usuario.edificio_id,
        tipo: 'compra',
        cantidad,
        descripcion: `Compra de ${cantidad} ficha${cantidad === 1 ? '' : 's'}`,
        creado_por: usuario_id
      });

      const nuevo_saldo = await obtenerSaldo(usuario_id);
      return res.json({ ok: true, transaccion, nuevo_saldo });
    }

    // PATCH /api/billetera/pin — residente cambia su PIN de compra
    if (req.method === 'PATCH' && req.path === '/api/billetera/pin') {
      const usuario_id = req.usuario.usuario_id;
      const pinActual = String(req.body?.pin_actual ?? '').trim();
      const pinNuevo = String(req.body?.pin_nuevo ?? '').trim();

      if (!/^\d{4}$/.test(pinActual)) return res.status(400).json({ ok: false, error: 'PIN actual inválido' });
      if (!/^\d{4}$/.test(pinNuevo)) return res.status(400).json({ ok: false, error: 'El nuevo PIN debe ser de 4 dígitos' });

      const usuario = await Usuario.findOne({ usuario_id, activo: true });
      if (!usuario) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });

      const pinOk = await usuario.compararPin(pinActual);
      if (!pinOk) return res.status(401).json({ ok: false, error: 'PIN actual incorrecto' });

      usuario.pin_compra = pinNuevo;
      await usuario.save(); // pre-save hashea el nuevo PIN
      return res.json({ ok: true });
    }

    // POST /api/billetera/creditos-masivo — agregar créditos a todos los usuarios de un edificio (admin)
    if (req.method === 'POST' && req.path === '/api/billetera/creditos-masivo') {
      if (req.usuario.rol !== 'admin') return res.status(403).json({ ok: false, error: 'Solo admin' });

      const { edificio_id, cantidad, descripcion } = req.body;
      if (!edificio_id || !cantidad) return res.status(400).json({ ok: false, error: 'edificio_id y cantidad son requeridos' });

      const usuarios = await Usuario.find({ edificio_id, activo: true, rol: 'residente' }).lean();
      if (usuarios.length === 0) return res.status(404).json({ ok: false, error: 'No hay usuarios activos en este edificio' });

      const transacciones = usuarios.map(u => ({
        usuario_id: u.usuario_id,
        edificio_id,
        tipo: 'ajuste_admin',
        cantidad: Number(cantidad),
        descripcion: descripcion || `Créditos masivos por admin`,
        creado_por: req.usuario.usuario_id
      }));

      await Transaccion.insertMany(transacciones);
      return res.json({ ok: true, total_usuarios: usuarios.length, cantidad_por_usuario: Number(cantidad) });
    }

    return res.status(405).json({ ok: false, error: 'Método no permitido' });
  } catch (err) {
    console.error('Error billetera:', err);
    return res.status(500).json({ ok: false, error: 'Error interno' });
  }
}

module.exports = handler;
module.exports.obtenerSaldo = obtenerSaldo;
