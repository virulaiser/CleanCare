const mongoose = require('mongoose');
const crypto = require('crypto');

const transaccionSchema = new mongoose.Schema({
  transaccion_id: { type: String, unique: true },
  usuario_id:     { type: String, required: true },
  edificio_id:    { type: String, required: true },
  tipo:           { type: String, enum: ['asignacion_mensual', 'ajuste_admin', 'uso_maquina', 'devolucion'], required: true },
  cantidad:       { type: Number, required: true },
  descripcion:    { type: String },
  referencia_id:  { type: String },
  creado_por:     { type: String },
  fecha:          { type: Date, default: Date.now }
});

transaccionSchema.pre('validate', function () {
  if (!this.transaccion_id) {
    this.transaccion_id = 'TXN-' + crypto.randomBytes(3).toString('hex').toUpperCase();
  }
});

transaccionSchema.index({ usuario_id: 1, fecha: -1 });
transaccionSchema.index({ edificio_id: 1, fecha: -1 });
transaccionSchema.index({ edificio_id: 1, tipo: 1, fecha: -1 });

module.exports = mongoose.model('Transaccion', transaccionSchema, 'transacciones');
