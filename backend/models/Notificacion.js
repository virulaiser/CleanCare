const mongoose = require('mongoose');
const crypto = require('crypto');

const notificacionSchema = new mongoose.Schema({
  notificacion_id:          { type: String, unique: true },
  tipo:                     { type: String, required: true }, // 'factura_mensual', 'cierre_ocupacion', etc.
  destinatario_usuario_id:  { type: String, default: null },
  destinatario_email:       { type: String, default: null },
  destinatario_whatsapp:    { type: String, default: null },
  canal:                    { type: String, enum: ['email', 'whatsapp', 'in_app'], default: 'email' },
  subject:                  { type: String, default: '' },
  body_html:                { type: String, default: '' },
  attachments:              [{ filename: String, url: String }],
  estado:                   { type: String, enum: ['pendiente', 'enviada', 'error', 'descartada'], default: 'pendiente' },
  proveedor:                { type: String, default: null }, // 'resend', 'smtp', etc.
  proveedor_id:             { type: String, default: null },
  error:                    { type: String, default: null },
  relacionado:              { tipo: String, ref_id: String },
  creada:                   { type: Date, default: Date.now },
  enviada_en:               { type: Date, default: null },
});

notificacionSchema.pre('validate', function () {
  if (!this.notificacion_id) {
    this.notificacion_id = 'NOT-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  }
});

notificacionSchema.index({ destinatario_usuario_id: 1, creada: -1 });
notificacionSchema.index({ destinatario_email: 1, creada: -1 });
notificacionSchema.index({ tipo: 1, creada: -1 });

module.exports = mongoose.model('Notificacion', notificacionSchema, 'notificaciones');
