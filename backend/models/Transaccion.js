const mongoose = require('mongoose');
const crypto = require('crypto');

const transaccionSchema = new mongoose.Schema({
  transaccion_id: { type: String, unique: true },
  usuario_id:     { type: String, required: true },
  edificio_id:    { type: String, required: true },
  apartamento:    { type: String }, // Para billetera compartida por apto
  tipo:           { type: String, enum: ['asignacion_mensual', 'ajuste_admin', 'uso_maquina', 'devolucion', 'compra'], required: true },
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
  // Regla: las fichas siempre son enteras. Redondear defensivamente
  // cualquier cantidad que llegue con decimales (bug del costo_lavado en pesos).
  if (typeof this.cantidad === 'number' && !Number.isInteger(this.cantidad)) {
    this.cantidad = Math.trunc(this.cantidad) || (this.cantidad > 0 ? 1 : -1);
  }
});

transaccionSchema.index({ usuario_id: 1, fecha: -1 });
transaccionSchema.index({ edificio_id: 1, fecha: -1 });
transaccionSchema.index({ edificio_id: 1, tipo: 1, fecha: -1 });
transaccionSchema.index({ edificio_id: 1, apartamento: 1, fecha: -1 });

module.exports = mongoose.model('Transaccion', transaccionSchema, 'transacciones');
