const mongoose = require('mongoose');
const crypto = require('crypto');

const ocupacionSchema = new mongoose.Schema({
  ocupacion_id:       { type: String, unique: true },
  edificio_id:        { type: String, required: true },
  apartamento:        { type: String, required: true },
  desde:              { type: Date, required: true },
  hasta:              { type: Date, default: null }, // null = vigente
  titular_usuario_id: { type: String },
  miembros_usuario_ids: [{ type: String }],
  cerrada_por:        { type: String, default: null },
  motivo_cierre:      { type: String, enum: ['rotacion', 'baja', 'admin', null], default: null },
  saldo_al_cierre:    { type: Number, default: null },
  pdf_cierre_url:     { type: String, default: '' },
  pdf_apertura_url:   { type: String, default: '' },
  notas:              { type: String, default: '' },
  creada:             { type: Date, default: Date.now },
});

ocupacionSchema.pre('validate', function () {
  if (!this.ocupacion_id) {
    this.ocupacion_id = 'OCU-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  }
});

// Solo puede haber UNA ocupación vigente (hasta=null) por (edificio, apto).
ocupacionSchema.index(
  { edificio_id: 1, apartamento: 1, hasta: 1 },
  { unique: true, partialFilterExpression: { hasta: null } }
);
ocupacionSchema.index({ edificio_id: 1, apartamento: 1, desde: -1 });

module.exports = mongoose.model('Ocupacion', ocupacionSchema, 'ocupaciones');
