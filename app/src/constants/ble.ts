// Esquema de UUIDs por ESP32: cc7a5XXX-bb73-4e02-8f1d-a0b0c0d0e0fY
// XXX = número de unidad, Y = 1:service 2:control 3:status.
// Debe coincidir con firmware/ble_test/INVENTARIO_ESP32.md.

export const ESP32_ID = '001';
export const ESP32_BLE_NAME = 'CleanCare-ESP32';

export const SERVICE_UUID = 'cc7a5001-bb73-4e02-8f1d-a0b0c0d0e0f1';
export const CONTROL_UUID = 'cc7a5001-bb73-4e02-8f1d-a0b0c0d0e0f2';
export const STATUS_UUID  = 'cc7a5001-bb73-4e02-8f1d-a0b0c0d0e0f3';
