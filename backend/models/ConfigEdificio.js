const mongoose = require('mongoose');

const configEdificioSchema = new mongoose.Schema({
  edificio_id:        { type: String, required: true, unique: true },
  creditos_mensuales: { type: Number, default: 10 },
  costo_lavado:       { type: Number, default: 1 },
  costo_secado:       { type: Number, default: 1 },
  duracion_lavado:    { type: Number, default: 45 },
  duracion_secado:    { type: Number, default: 30 },
  activo:             { type: Boolean, default: true },
  actualizado:        { type: Date, default: Date.now }
});

module.exports = mongoose.model('ConfigEdificio', configEdificioSchema, 'config_edificios');
