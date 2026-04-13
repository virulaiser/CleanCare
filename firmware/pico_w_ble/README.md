# CleanCare — Firmware Raspberry Pi Pico W (BLE)

Firmware **independiente del ESP32** para Raspberry Pi Pico W. Implementa el mismo
protocolo BLE que el ESP32, con los mismos UUIDs y comandos: la app no requiere
cambios para funcionar (excepto aceptar `CleanCare-Pico` además de `CleanCare-ESP32`
en el filtro por nombre).

## Hardware

| Componente | Detalle |
|---|---|
| Placa | Raspberry Pi Pico **W** (no la Pico clásica — necesita BLE) |
| Chip BLE | CYW43439 (incluido en la Pico W) |
| Relay | Módulo de 1 canal, activo por LOW (la mayoría) |
| Cableado | GPIO 15 → IN del relé · VBUS (5V) → VCC · GND → GND |

## Compilar y subir

### Con PlatformIO (recomendado)

```bash
cd firmware/pico_w_ble
pio run --target upload
pio device monitor
```

### Con Arduino IDE

1. Instalar el core *Raspberry Pi Pico/RP2040* de **earlephilhower** vía Boards Manager.
2. Instalar la librería **ArduinoBLE** desde Library Manager.
3. Seleccionar `Raspberry Pi Pico W`.
4. Abrir `src/main.cpp` y subir.

## Protocolo BLE (idéntico al ESP32)

| UUID | Tipo | Uso |
|---|---|---|
| `12345678-1234-1234-1234-123456789abc` | Service | Servicio principal |
| `12345678-1234-1234-1234-123456789abd` | Write | Comandos de la app |
| `12345678-1234-1234-1234-123456789abe` | Read + Notify | Estado y logs |

### Comandos aceptados

```
ON:60                       Encender 60s
ON:2700:USR-XXXX:lavarropas Encender + registrar uso
OFF                         Apagar
STATUS                      Pedir estado
TIME:2026-04-13T15:30:00    Sincronizar fecha/hora
LOGS:cleancare2026          Extraer logs (con clave)
CLEAR_LOGS:cleancare2026    Borrar logs
INFO                        Info: conexiones, logs, uptime, fecha
```

## Persistencia

Los registros se guardan en **LittleFS** (archivo `/logs.txt`). Cada línea es
`FECHA|USUARIO|DURACION|TIPO`. Rotación FIFO al llegar a 200 registros.

## Diferencias vs. ESP32

| | ESP32 | Pico W |
|---|---|---|
| Almacenamiento | NVS (Preferences) | LittleFS |
| BLE stack | Bluedroid | BTstack (CYW43) |
| Reset | `ESP.restart()` | `rp2040.reboot()` |
| Nombre BLE | `CleanCare-ESP32` | `CleanCare-Pico` |
| Librería | BLEDevice (Arduino-ESP32) | ArduinoBLE |

## Ajustes opcionales

Editar al inicio de `src/main.cpp`:

```cpp
#define RELAY_PIN          15      // GPIO del relay
#define RELAY_ACTIVE_LOW   true    // false si tu relé es activo-alto
#define RESET_INTERVAL_MS  86400000UL  // 24h
#define MAX_LOGS           200
#define LOG_ACCESS_KEY     "cleancare2026"
```
