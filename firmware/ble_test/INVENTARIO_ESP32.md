# ============================================================
# CleanCare — Inventario de ESP32
# ============================================================
# Cada ESP32 tiene UUIDs únicos. Cuando programes uno nuevo,
# cambiá ESP32_ID + UUIDs en src/main.cpp y app/src/constants/ble.ts
# a la vez (deben coincidir), y agregá una fila acá.
#
# Esquema:  cc7a5XXX-bb73-4e02-8f1d-a0b0c0d0e0fY
#   XXX = número de ESP32 (001, 002, ...)
#   Y   = 1=SERVICE  2=CONTROL  3=STATUS
# ============================================================

# --- ESP32 #001 (actual) ---
ESP32_ID=001
BLE_NAME=CleanCare-ESP32
MAQUINA_ASIGNADA=LAV-XXXXXX        # rellenar con el maquina_id que usará
UBICACION=Torre Norte - Piso 1     # descripción libre
SERVICE_UUID=cc7a5001-bb73-4e02-8f1d-a0b0c0d0e0f1
CONTROL_UUID=cc7a5001-bb73-4e02-8f1d-a0b0c0d0e0f2
STATUS_UUID =cc7a5001-bb73-4e02-8f1d-a0b0c0d0e0f3

# --- ESP32 #002 (ejemplo futuro) ---
# ESP32_ID=002
# BLE_NAME=CleanCare-ESP32
# MAQUINA_ASIGNADA=SEC-XXXXXX
# UBICACION=Torre Norte - Piso 2
# SERVICE_UUID=cc7a5002-bb73-4e02-8f1d-a0b0c0d0e0f1
# CONTROL_UUID=cc7a5002-bb73-4e02-8f1d-a0b0c0d0e0f2
# STATUS_UUID =cc7a5002-bb73-4e02-8f1d-a0b0c0d0e0f3
