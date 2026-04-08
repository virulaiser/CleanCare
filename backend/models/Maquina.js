const mongoose = require('mongoose');

const maquinaSchema = new mongoose.Schema({
  maquina_id:  { type: String, required: true, unique: true },
  edificio_id: { type: String, required: true },
  tipo:        { type: String, enum: ['lavarropas', 'secadora'], default: 'lavarropas' },
  ip_local:    { type: String, required: true },
  nombre:      { type: String, required: true },
  activa:      { type: Boolean, default: true }
});

maquinaSchema.index({ edificio_id: 1 });

module.exports = mongoose.model('Maquina', maquinaSchema, 'maquinas');
