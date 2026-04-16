const mongoose = require('mongoose');

const maquinaSchema = new mongoose.Schema({
  maquina_id:  { type: String, required: true, unique: true },
  edificio_id: { type: String, required: true },
  tipo:        { type: String, enum: ['lavarropas', 'secadora'], default: 'lavarropas' },
  nombre:      { type: String, required: true },
  activa:      { type: Boolean, default: true },
  dispositivo_id: { type: String, default: null },  // esp32_id del micro que la controla
  relay_pin:   { type: Number, default: null },     // pin del relay (0..N-1)
});

maquinaSchema.index({ edificio_id: 1 });

module.exports = mongoose.model('Maquina', maquinaSchema, 'maquinas');
