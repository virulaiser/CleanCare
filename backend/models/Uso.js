const mongoose = require('mongoose');

const usoSchema = new mongoose.Schema({
  maquina_id:   { type: String, required: true },
  edificio_id:  { type: String, required: true },
  tipo:         { type: String, enum: ['lavarropas', 'secadora'], default: 'lavarropas' },
  duracion_min: { type: Number, required: true, min: 1, max: 120 },
  residente_id: { type: String, required: true },
  completado:   { type: Boolean, default: false },
  fecha:        { type: Date, default: Date.now }
});

usoSchema.index({ edificio_id: 1, fecha: -1 });

module.exports = mongoose.model('Uso', usoSchema, 'usos');
