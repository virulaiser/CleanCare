const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// NOTA: un apartamento puede tener varios usuarios (pareja, familia, inquilinos).
// La facturación va al dueño del apartamento → se agrega por (apartamento + edificio_id),
// no por usuario_id. Por eso email es unique pero apartamento+edificio NO lo es.
// En Uso.residente_id guardamos el apartamento para que la agregación sea directa.
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

// Índice no único para búsquedas rápidas de todos los usuarios de un apartamento
usuarioSchema.index({ edificio_id: 1, apartamento: 1 });

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
