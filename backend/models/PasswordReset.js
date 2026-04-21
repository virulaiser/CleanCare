const mongoose = require('mongoose');
const crypto = require('crypto');

const passwordResetSchema = new mongoose.Schema({
  reset_id:    { type: String, unique: true },
  token:       { type: String, required: true, unique: true, index: true },
  usuario_id:  { type: String, required: true, index: true },
  email:       { type: String, required: true },
  expira_en:   { type: Date, required: true },
  usado:       { type: Boolean, default: false },
  usado_en:    { type: Date, default: null },
  ip_origen:   { type: String, default: null },
  creado:      { type: Date, default: Date.now },
});

passwordResetSchema.pre('validate', function () {
  if (!this.reset_id) {
    this.reset_id = 'PRS-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  }
});

// TTL: MongoDB borra el doc 24 h después de expira_en (deja margen por si hace falta auditar)
passwordResetSchema.index({ expira_en: 1 }, { expireAfterSeconds: 86400 });

module.exports = mongoose.model('PasswordReset', passwordResetSchema, 'password_resets');
