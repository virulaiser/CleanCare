const mongoose = require('mongoose');

const dispositivoSchema = new mongoose.Schema({
  esp32_id:           { type: String, required: true, unique: true },  // ej "001"
  tipo_hw:            { type: String, enum: ['esp32', 'pico'], default: 'esp32' },
  ble_name:           { type: String, default: 'CleanCare-ESP32' },
  service_uuid:       { type: String, required: true },
  control_uuid:       { type: String, required: true },
  status_uuid:        { type: String, required: true },
  maquina_asignada:   { type: String, default: null },  // maquina_id o null
  edificio_id:        { type: String, default: null },
  ubicacion:          { type: String, default: '' },
  activo:             { type: Boolean, default: true },
  creado:             { type: Date, default: Date.now },
});

dispositivoSchema.index({ edificio_id: 1 });
dispositivoSchema.index({ maquina_asignada: 1 });

module.exports = mongoose.model('Dispositivo', dispositivoSchema, 'dispositivos');
