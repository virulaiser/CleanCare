const connectDB = require('../lib/mongodb');
const Usuario = require('../models/Usuario');
const { obtenerSaldo } = require('./billetera');

module.exports = async (req, res) => {
  try {
    await connectDB();

    if (req.method !== 'GET') {
      return res.status(405).json({ ok: false, error: 'Método no permitido' });
    }

    const { edificioId } = req.query;

    const filter = { activo: true, rol: 'residente' };
    if (edificioId) filter.edificio_id = edificioId;

    const usuarios = await Usuario.find(filter)
      .select('usuario_id nombre email apartamento telefono edificio_id')
      .lean();

    // Obtener saldo de cada usuario
    const conSaldo = await Promise.all(
      usuarios.map(async (u) => ({
        ...u,
        saldo: await obtenerSaldo(u.usuario_id)
      }))
    );

    return res.json({ ok: true, usuarios: conSaldo });
  } catch (err) {
    console.error('Error usuarios:', err);
    return res.status(500).json({ ok: false, error: 'Error interno' });
  }
};
