const mongoose = require('mongoose');
const crypto = require('crypto');

const facturaSchema = new mongoose.Schema({
  factura_id:  { type: String, unique: true },
  edificio_id: { type: String, required: true },
  mes:         { type: Number, required: true },  // 1-12
  anio:        { type: Number, required: true },
  tipo:        { type: String, enum: ['ingreso', 'consumo_resumen', 'resumen_apto'], required: true },
  apartamento: { type: String, default: null },   // solo para tipo='resumen_apto'
  pdf_url:     { type: String, required: true },
  totales:     { type: mongoose.Schema.Types.Mixed, default: {} },
  generada:    { type: Date, default: Date.now },
  enviada:     { type: Boolean, default: false },
  canal_envio: { type: String, enum: ['email', 'whatsapp', null], default: null }
});

facturaSchema.pre('validate', function () {
  if (!this.factura_id) {
    this.factura_id = 'FAC-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  }
});

facturaSchema.index({ edificio_id: 1, anio: 1, mes: 1, tipo: 1, apartamento: 1 }, { unique: true });
facturaSchema.index({ edificio_id: 1, generada: -1 });

module.exports = mongoose.model('Factura', facturaSchema, 'facturas');
