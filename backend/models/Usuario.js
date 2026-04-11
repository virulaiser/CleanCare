const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const usuarioSchema = new mongoose.Schema({
  usuario_id:  { type: String, unique: true },
  email:       { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:    { type: String, required: true },
  nombre:      { type: String, required: true },
  telefono:    { type: String, trim: true },
  apartamento: { type: String, trim: true },
  rol:         { type: String, enum: ['admin', 'residente'], default: 'residente' },
  edificio_id: { type: String, required: true },
  unidad:      { type: String },
  foto:        { type: String },
  activo:      { type: Boolean, default: true },
  creado:      { type: Date, default: Date.now }
});

usuarioSchema.pre('validate', function () {
  if (!this.usuario_id) {
    this.usuario_id = 'USR-' + crypto.randomBytes(3).toString('hex').toUpperCase();
  }
});

usuarioSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

usuarioSchema.methods.compararPassword = function (candidata) {
  return bcrypt.compare(candidata, this.password);
};

module.exports = mongoose.model('Usuario', usuarioSchema, 'usuarios');
