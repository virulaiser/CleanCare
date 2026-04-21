const mongoose = require('mongoose');

const unidadSchema = new mongoose.Schema({
  edificio_id:  { type: String, required: true },
  codigo:       { type: String, required: true }, // '101', '3B', 'portero', etc.
  piso:         { type: Number, default: null },
  numero_apto:  { type: Number, default: null },
  es_extra:     { type: Boolean, default: false },
  tipo_extra:   { type: String, enum: ['portero', 'otro', null], default: null },
  activa:       { type: Boolean, default: true },
  creada:       { type: Date, default: Date.now }
});

unidadSchema.index({ edificio_id: 1, codigo: 1 }, { unique: true });
unidadSchema.index({ edificio_id: 1, activa: 1 });

module.exports = mongoose.model('Unidad', unidadSchema, 'unidades');
