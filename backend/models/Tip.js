const mongoose = require('mongoose');

const tipSchema = new mongoose.Schema({
  texto:  { type: String, required: true },
  tipo:   { type: String, enum: ['lavarropas', 'secadora', 'ambos'], default: 'ambos' },
  activo: { type: Boolean, default: true },
  creado: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Tip', tipSchema, 'tips');
