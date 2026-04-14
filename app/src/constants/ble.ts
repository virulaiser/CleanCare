// ============================================================
// CleanCare — UUIDs BLE
// ============================================================
// DEBEN coincidir con los que tiene el ESP32 en firmware/ble_test/.env
//
// Esquema: cc7a5XXX-bb73-4e02-8f1d-a0b0c0d0e0fY
//   XXX = número de ESP32 (001, 002, 003...)
//   Y   = 1=SERVICE, 2=CONTROL, 3=STATUS
//
// Cuando agregues un ESP32 nuevo, cambiá XXX en firmware y app a la vez.
// ============================================================

export const ESP32_ID = '001';
export const ESP32_BLE_NAME = 'CleanCare-ESP32';

export const SERVICE_UUID = 'cc7a5001-bb73-4e02-8f1d-a0b0c0d0e0f1';
export const CONTROL_UUID = 'cc7a5001-bb73-4e02-8f1d-a0b0c0d0e0f2';
export const STATUS_UUID  = 'cc7a5001-bb73-4e02-8f1d-a0b0c0d0e0f3';
