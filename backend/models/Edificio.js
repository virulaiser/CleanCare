const mongoose = require('mongoose');
const crypto = require('crypto');

const edificioSchema = new mongoose.Schema({
  edificio_id:     { type: String, unique: true },
  nombre:          { type: String, required: true },
  direccion:       { type: String },
  admin_nombre:    { type: String },
  admin_telefono:  { type: String },
  activo:          { type: Boolean, default: true },
  creado:          { type: Date, default: Date.now }
});

edificioSchema.pre('validate', function () {
  if (!this.edificio_id) {
    this.edificio_id = 'EDI-' + crypto.randomBytes(3).toString('hex').toUpperCase();
  }
});

module.exports = mongoose.model('Edificio', edificioSchema, 'edificios');
