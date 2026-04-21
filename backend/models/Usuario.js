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
  rol:         { type: String, enum: ['admin', 'admin_edificio', 'residente'], default: 'residente' },
  edificio_id: { type: String, required: true },
  unidad:      { type: String },
  foto:        { type: String },
  pin_compra:  { type: String },
  // Modelo titular/miembro por apto: el titular es el dueño de la billetera del apto,
  // único que puede comprar fichas. Los miembros gastan del mismo pozo, previa aprobación.
  rol_apto:           { type: String, enum: ['titular', 'miembro'], default: 'miembro' },
  estado_aprobacion:  { type: String, enum: ['pendiente', 'aprobado', 'rechazado'], default: 'aprobado' },
  aprobado_por:       { type: String, default: null },
  aprobado_en:        { type: Date, default: null },
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
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  if (this.isModified('pin_compra') && this.pin_compra) {
    this.pin_compra = await bcrypt.hash(this.pin_compra, 10);
  }
});

usuarioSchema.methods.compararPassword = function (candidata) {
  return bcrypt.compare(candidata, this.password);
};

// PIN inicial por defecto '1111' cuando el usuario todavia no lo haya seteado.
usuarioSchema.methods.compararPin = async function (candidata) {
  if (!candidata) return false;
  if (!this.pin_compra) return candidata === '1111';
  return bcrypt.compare(candidata, this.pin_compra);
};

module.exports = mongoose.model('Usuario', usuarioSchema, 'usuarios');
