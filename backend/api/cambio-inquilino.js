const connectDB = require('../lib/mongodb');
const Usuario = require('../models/Usuario');
const Transaccion = require('../models/Transaccion');
const Ocupacion = require('../models/Ocupacion');
const Edificio = require('../models/Edificio');
const Uso = require('../models/Uso');
const { pdfCierreInquilino, pdfApertura, uploadPDF } = require('../lib/pdf-ocupacion');
const { obtenerSaldoApto } = require('./billetera');
const { notificar } = require('../lib/notificar');
const { cierreInquilino: tplCierre, aperturaInquilino: tplApertura } = require('../lib/email-templates');

function esAdminOEdificio(u, edificio_id) {
  if (!u) return false;
  if (u.rol === 'admin') return true;
  if (u.rol === 'admin_edificio' && u.edificio_id === edificio_id) return true;
  return false;
}

module.exports = async (req, res) => {
  try {
    await connectDB();

    // POST /api/apartamento/cerrar-inquilino
    if (req.method === 'POST' && req.path === '/api/apartamento/cerrar-inquilino') {
      const { edificio_id, apartamento, notas } = req.body || {};
      if (!edificio_id || !apartamento) return res.status(400).json({ ok: false, error: 'edificio_id y apartamento requeridos' });
      if (!esAdminOEdificio(req.usuario, edificio_id)) return res.status(403).json({ ok: false, error: 'No podés cerrar el inquilino de este apartamento' });

      // 1. Bloquear si hay ciclo activo
      const cicloActivo = await Uso.findOne({ edificio_id, residente_id: apartamento, estado: 'activo' }).lean();
      if (cicloActivo) return res.status(409).json({ ok: false, error: 'Hay un ciclo en curso en este apto. Esperá a que termine.' });

      // 2. Encontrar ocupación vigente (o crearla sobre la marcha si no existe — legacy)
      let ocupacion = await Ocupacion.findOne({ edificio_id, apartamento, hasta: null });
      if (!ocupacion) {
        const titularExistente = await Usuario.findOne({
          edificio_id, apartamento, activo: true, rol_apto: 'titular', estado_aprobacion: 'aprobado',
        }).lean();
        if (!titularExistente) return res.status(404).json({ ok: false, error: 'No hay una ocupación vigente para este apto' });
        // Crear la ocupación vigente con el titular actual
        ocupacion = await Ocupacion.create({
          edificio_id, apartamento,
          desde: titularExistente.aprobado_en || titularExistente.creado || new Date(),
          titular_usuario_id: titularExistente.usuario_id,
          miembros_usuario_ids: [],
        });
      }

      // 3. Juntar inquilinos actuales
      const inquilinos = await Usuario.find({ edificio_id, apartamento, activo: true }).lean();
      const titular = inquilinos.find(u => u.rol_apto === 'titular') || inquilinos[0];
      const miembros = inquilinos.filter(u => u.usuario_id !== titular?.usuario_id);

      // 4. Calcular saldo actual y resetearlo a 0
      const saldoActual = await obtenerSaldoApto(edificio_id, apartamento);
      if (saldoActual !== 0) {
        await Transaccion.create({
          usuario_id: titular?.usuario_id || req.usuario.usuario_id,
          edificio_id, apartamento,
          tipo: 'ajuste_admin',
          cantidad: -saldoActual,
          descripcion: `Reset de saldo por cambio de inquilino (saldo previo: ${saldoActual})`,
          creado_por: req.usuario.usuario_id,
        });
      }

      // 5. Construir movimientos del período para el PDF
      const txs = await Transaccion.find({
        edificio_id, apartamento,
        fecha: { $gte: new Date(ocupacion.desde), $lte: new Date() },
      }).sort({ fecha: 1 }).lean();
      const userIds = [...new Set(txs.map(t => t.usuario_id))];
      const usuariosMap = new Map(
        (await Usuario.find({ usuario_id: { $in: userIds } }, { usuario_id: 1, nombre: 1 }).lean())
          .map(u => [u.usuario_id, u.nombre])
      );
      const tipoLabel = {
        asignacion_mensual: 'Asignación', ajuste_admin: 'Ajuste',
        uso_maquina: 'Uso', devolucion: 'Devolución', compra: 'Compra',
      };
      const movimientos = txs.map(t => ({
        fecha: new Date(t.fecha).toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: '2-digit' }),
        tipo: tipoLabel[t.tipo] || t.tipo,
        descripcion: t.descripcion || '—',
        usuario: usuariosMap.get(t.usuario_id) || t.usuario_id,
        cantidad: (t.cantidad >= 0 ? '+' : '') + t.cantidad,
      }));

      // 6. Generar PDF de cierre
      const edificio = await Edificio.findOne({ edificio_id }).lean() || { edificio_id };
      const pdfBuf = await pdfCierreInquilino({
        edificio, apartamento,
        ocupacion: { desde: ocupacion.desde, hasta: new Date() },
        titular, miembros, movimientos,
        saldoFinal: saldoActual,
        ocupacionId: ocupacion.ocupacion_id,
      });
      const pdfUrl = await uploadPDF(pdfBuf, `ocupaciones/${edificio_id}/${apartamento}/${ocupacion.ocupacion_id}-cierre.pdf`);

      // 7. Cerrar ocupación
      ocupacion.hasta = new Date();
      ocupacion.cerrada_por = req.usuario.usuario_id;
      ocupacion.motivo_cierre = 'rotacion';
      ocupacion.saldo_al_cierre = saldoActual;
      ocupacion.pdf_cierre_url = pdfUrl;
      ocupacion.miembros_usuario_ids = miembros.map(m => m.usuario_id);
      ocupacion.notas = notas || '';
      await ocupacion.save();

      // 8. Marcar usuarios inactivos con fecha_baja
      await Usuario.updateMany(
        { edificio_id, apartamento, activo: true },
        { $set: { activo: false, fecha_baja: new Date(), motivo_baja: 'cambio_inquilino' } }
      );

      // 9. Notificar al titular saliente
      if (titular?.email) {
        const { subject, html } = tplCierre({ edificio, apartamento, titular, saldoFinal: saldoActual, pdfUrl });
        await notificar({
          tipo: 'cierre_ocupacion',
          destinatario_usuario_id: titular.usuario_id,
          destinatario_email: titular.email,
          canal: 'email',
          subject, html,
          attachments: [{ filename: `cierre-${apartamento}.pdf`, url: pdfUrl }],
          relacionado: { tipo: 'ocupacion', ref_id: ocupacion.ocupacion_id },
        }).catch((e) => console.warn('No se pudo notificar cierre:', e.message));
      }

      return res.json({
        ok: true,
        ocupacion: ocupacion.toObject(),
        saldo_previo: saldoActual,
        pdf_cierre_url: pdfUrl,
        inquilinos_dados_baja: inquilinos.length,
      });
    }

    // POST /api/apartamento/confirmar-titular — admin aprueba un pendiente y lo marca titular
    // Abre una ocupación nueva con él como titular.
    if (req.method === 'POST' && req.path === '/api/apartamento/confirmar-titular') {
      const { usuario_id } = req.body || {};
      if (!usuario_id) return res.status(400).json({ ok: false, error: 'usuario_id requerido' });

      const candidato = await Usuario.findOne({ usuario_id, activo: true });
      if (!candidato) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
      if (!esAdminOEdificio(req.usuario, candidato.edificio_id)) return res.status(403).json({ ok: false, error: 'No podés confirmar titulares de este edificio' });

      // Si ya hay una ocupación vigente, rechazar (primero cerrar al anterior)
      const vigente = await Ocupacion.findOne({ edificio_id: candidato.edificio_id, apartamento: candidato.apartamento, hasta: null });
      if (vigente) {
        // Si el vigente es el mismo candidato, idempotente
        if (vigente.titular_usuario_id !== candidato.usuario_id) {
          return res.status(409).json({ ok: false, error: 'Este apto ya tiene un titular vigente. Cerrá primero el inquilino actual.' });
        }
      }

      candidato.rol_apto = 'titular';
      candidato.estado_aprobacion = 'aprobado';
      candidato.aprobado_por = req.usuario.usuario_id;
      candidato.aprobado_en = new Date();
      await candidato.save();

      // Crear ocupación vigente si no existía
      let ocupacion = vigente;
      if (!ocupacion) {
        ocupacion = await Ocupacion.create({
          edificio_id: candidato.edificio_id,
          apartamento: candidato.apartamento,
          desde: new Date(),
          titular_usuario_id: candidato.usuario_id,
          miembros_usuario_ids: [],
        });

        // PDF de apertura + email de bienvenida
        try {
          const edificio = await Edificio.findOne({ edificio_id: candidato.edificio_id }).lean() || { edificio_id: candidato.edificio_id };
          const pdfBuf = await pdfApertura({ edificio, apartamento: candidato.apartamento, titular: candidato.toObject(), ocupacionId: ocupacion.ocupacion_id });
          const url = await uploadPDF(pdfBuf, `ocupaciones/${candidato.edificio_id}/${candidato.apartamento}/${ocupacion.ocupacion_id}-apertura.pdf`);
          ocupacion.pdf_apertura_url = url;
          await ocupacion.save();

          if (candidato.email) {
            const { subject, html } = tplApertura({ edificio, apartamento: candidato.apartamento, titular: candidato.toObject(), pdfUrl: url });
            await notificar({
              tipo: 'apertura_ocupacion',
              destinatario_usuario_id: candidato.usuario_id,
              destinatario_email: candidato.email,
              canal: 'email',
              subject, html,
              attachments: [{ filename: `bienvenida-${candidato.apartamento}.pdf`, url }],
              relacionado: { tipo: 'ocupacion', ref_id: ocupacion.ocupacion_id },
            }).catch((e) => console.warn('No se pudo notificar apertura:', e.message));
          }
        } catch (err) {
          console.warn('No se pudo generar PDF apertura:', err.message);
        }
      }

      return res.json({ ok: true, usuario: candidato.toObject(), ocupacion: ocupacion.toObject() });
    }

    // GET /api/apartamento/ocupaciones?edificioId=X&apartamento=Y
    if (req.method === 'GET' && req.path === '/api/apartamento/ocupaciones') {
      const { edificioId, apartamento } = req.query;
      if (!edificioId) return res.status(400).json({ ok: false, error: 'edificioId requerido' });
      if (!esAdminOEdificio(req.usuario, edificioId)) return res.status(403).json({ ok: false, error: 'Sin permisos' });

      const filter = { edificio_id: edificioId };
      if (apartamento) filter.apartamento = apartamento;
      const ocupaciones = await Ocupacion.find(filter).sort({ desde: -1 }).limit(200).lean();
      return res.json({ ok: true, ocupaciones });
    }

    return res.status(405).json({ ok: false, error: 'Método no permitido' });
  } catch (err) {
    console.error('Error cambio-inquilino:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
};
