const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const usuarioSchema = new mongoose.Schema({
  email:       { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:    { type: String, required: true },
  nombre:      { type: String, required: true },
  rol:         { type: String, enum: ['admin', 'residente'], default: 'residente' },
  edificio_id: { type: String, required: true },
  unidad:      { type: String }, // ej: "apto-302"
  activo:      { type: Boolean, default: true },
  creado:      { type: Date, default: Date.now }
});

usuarioSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

usuarioSchema.methods.compararPassword = function (candidata) {
  return bcrypt.compare(candidata, this.password);
};

module.exports = mongoose.model('Usuario', usuarioSchema, 'usuarios');
