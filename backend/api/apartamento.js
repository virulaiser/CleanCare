const Usuario = require('../models/Usuario');
const { notificar } = require('../lib/notificar');
const { miembroAprobado } = require('../lib/email-templates');

async function asegurarTitular(req, res) {
  const usuario = await Usuario.findOne({ usuario_id: req.usuario.usuario_id, activo: true }).lean();
  if (!usuario) {
    res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
    return null;
  }
  if (usuario.rol_apto !== 'titular' || usuario.estado_aprobacion !== 'aprobado') {
    res.status(403).json({ ok: false, error: 'Solo el titular del apto puede realizar esta acción' });
    return null;
  }
  return usuario;
}

function resumirMiembro(u) {
  return {
    usuario_id: u.usuario_id,
    nombre: u.nombre,
    email: u.email,
    telefono: u.telefono,
    apartamento: u.apartamento,
    edificio_id: u.edificio_id,
    rol_apto: u.rol_apto,
    estado_aprobacion: u.estado_aprobacion,
    aprobado_en: u.aprobado_en,
    creado: u.creado,
  };
}

async function handler(req, res) {
  try {
    // GET /api/apartamento/miembros — lista miembros del apto del titular
    if (req.method === 'GET' && req.path === '/api/apartamento/miembros') {
      const titular = await asegurarTitular(req, res);
      if (!titular) return;
      const miembros = await Usuario.find({
        edificio_id: titular.edificio_id,
        apartamento: titular.apartamento,
        activo: true,
      }).sort({ creado: 1 }).lean();
      return res.json({ ok: true, miembros: miembros.map(resumirMiembro) });
    }

    // POST /api/apartamento/aprobar { usuario_id }
    if (req.method === 'POST' && req.path === '/api/apartamento/aprobar') {
      const titular = await asegurarTitular(req, res);
      if (!titular) return;
      const { usuario_id } = req.body || {};
      if (!usuario_id) return res.status(400).json({ ok: false, error: 'usuario_id requerido' });

      const miembro = await Usuario.findOne({ usuario_id, activo: true });
      if (!miembro) return res.status(404).json({ ok: false, error: 'Miembro no encontrado' });
      if (miembro.edificio_id !== titular.edificio_id || miembro.apartamento !== titular.apartamento) {
        return res.status(403).json({ ok: false, error: 'El usuario no pertenece a tu apto' });
      }
      if (miembro.usuario_id === titular.usuario_id) {
        return res.status(400).json({ ok: false, error: 'No podés aprobarte a vos mismo' });
      }

      miembro.estado_aprobacion = 'aprobado';
      miembro.aprobado_por = titular.usuario_id;
      miembro.aprobado_en = new Date();
      miembro.rol_apto = 'miembro';
      await miembro.save();

      // Notificar al miembro aprobado
      if (miembro.email) {
        const { subject, html } = miembroAprobado({ apartamento: miembro.apartamento, titularNombre: titular.nombre });
        notificar({
          tipo: 'miembro_aprobado',
          destinatario_usuario_id: miembro.usuario_id,
          destinatario_email: miembro.email,
          canal: 'email',
          subject, html,
          relacionado: { tipo: 'usuario', ref_id: miembro.usuario_id },
        }).catch((e) => console.warn('No se pudo notificar miembro:', e.message));
      }

      return res.json({ ok: true, miembro: resumirMiembro(miembro) });
    }

    // POST /api/apartamento/rechazar { usuario_id }
    if (req.method === 'POST' && req.path === '/api/apartamento/rechazar') {
      const titular = await asegurarTitular(req, res);
      if (!titular) return;
      const { usuario_id } = req.body || {};
      if (!usuario_id) return res.status(400).json({ ok: false, error: 'usuario_id requerido' });

      const miembro = await Usuario.findOne({ usuario_id, activo: true });
      if (!miembro) return res.status(404).json({ ok: false, error: 'Miembro no encontrado' });
      if (miembro.edificio_id !== titular.edificio_id || miembro.apartamento !== titular.apartamento) {
        return res.status(403).json({ ok: false, error: 'El usuario no pertenece a tu apto' });
      }
      if (miembro.usuario_id === titular.usuario_id) {
        return res.status(400).json({ ok: false, error: 'No podés rechazarte a vos mismo' });
      }

      miembro.estado_aprobacion = 'rechazado';
      miembro.activo = false;
      await miembro.save();

      return res.json({ ok: true });
    }

    // POST /api/apartamento/transferir-titularidad { nuevo_titular_id }
    if (req.method === 'POST' && req.path === '/api/apartamento/transferir-titularidad') {
      const titular = await asegurarTitular(req, res);
      if (!titular) return;
      const { nuevo_titular_id } = req.body || {};
      if (!nuevo_titular_id) return res.status(400).json({ ok: false, error: 'nuevo_titular_id requerido' });
      if (nuevo_titular_id === titular.usuario_id) {
        return res.status(400).json({ ok: false, error: 'Ya sos el titular' });
      }

      const nuevoTitular = await Usuario.findOne({ usuario_id: nuevo_titular_id, activo: true });
      if (!nuevoTitular) return res.status(404).json({ ok: false, error: 'Nuevo titular no encontrado' });
      if (nuevoTitular.edificio_id !== titular.edificio_id || nuevoTitular.apartamento !== titular.apartamento) {
        return res.status(403).json({ ok: false, error: 'El nuevo titular no pertenece a tu apto' });
      }
      if (nuevoTitular.estado_aprobacion !== 'aprobado') {
        return res.status(400).json({ ok: false, error: 'El nuevo titular debe estar aprobado' });
      }

      // Aplicar en dos updates independientes (no hay transacciones en M0 de Atlas por default,
      // y ambos usuarios son del mismo apto → consistencia aceptable).
      await Usuario.updateOne({ usuario_id: titular.usuario_id }, { $set: { rol_apto: 'miembro', aprobado_por: nuevoTitular.usuario_id, aprobado_en: new Date() } });
      await Usuario.updateOne({ usuario_id: nuevoTitular.usuario_id }, { $set: { rol_apto: 'titular', aprobado_por: null } });

      return res.json({ ok: true });
    }

    return res.status(404).json({ ok: false, error: 'Endpoint no encontrado' });
  } catch (err) {
    console.error('Error apartamento:', err);
    return res.status(500).json({ ok: false, error: 'Error interno' });
  }
}

module.exports = handler;
