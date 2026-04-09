const mongoose = require('mongoose');

const usoSchema = new mongoose.Schema({
  maquina_id:   { type: String, required: true },
  edificio_id:  { type: String, required: true },
  tipo:         { type: String, enum: ['lavarropas', 'secadora'], default: 'lavarropas' },
  duracion_min: { type: Number, required: true, min: 1, max: 120 },
  residente_id: { type: String, required: true },
  estado:       { type: String, enum: ['activo', 'completado', 'cancelado', 'averia'], default: 'activo' },
  fecha_inicio: { type: Date, default: Date.now },
  fecha_fin:    { type: Date },
  fecha:        { type: Date, default: Date.now },
  // Legacy field kept for backwards compatibility
  completado:   { type: Boolean, default: false },
});

usoSchema.index({ edificio_id: 1, fecha: -1 });
usoSchema.index({ maquina_id: 1, estado: 1 });

module.exports = mongoose.model('Uso', usoSchema, 'usos');
