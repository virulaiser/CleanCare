const mongoose = require('mongoose');

const configEdificioSchema = new mongoose.Schema({
  edificio_id:        { type: String, required: true, unique: true },
  creditos_mensuales: { type: Number, default: 10 },
  costo_lavado:       { type: Number, default: 1 },
  costo_secado:       { type: Number, default: 1 },
  duracion_lavado:    { type: Number, default: 45 },
  duracion_secado:    { type: Number, default: 30 },
  max_compra_fichas:  { type: Number, default: 10 },

  // Economía
  precio_ficha_residente: { type: Number, default: 120 },  // $ que el admin_edificio cobra al residente
  comision_cleancare:     { type: Number, default: 33 },   // $ que CleanCare cobra al admin_edificio por ficha vendida

  // Consumo por ciclo (para reporte de agua / electricidad)
  litros_por_lavado: { type: Number, default: 60 },
  litros_por_secado: { type: Number, default: 0 },
  kwh_por_lavado:    { type: Number, default: 1.2 },
  kwh_por_secado:    { type: Number, default: 2.5 },

  // Facturación
  facturacion_dia:  { type: Number, default: 31 },
  facturacion_hora: { type: String, default: '23:59' },

  // Canales de envío (scaffolding — hoy no se envía, solo se guarda)
  email_admin_edificio:    { type: String, default: '' },
  whatsapp_admin_edificio: { type: String, default: '' },
  canal_preferido:         { type: String, enum: ['email', 'whatsapp', 'ninguno'], default: 'ninguno' },

  activo:      { type: Boolean, default: true },
  actualizado: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ConfigEdificio', configEdificioSchema, 'config_edificios');
