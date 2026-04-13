/*
  CleanCare — Raspberry Pi Pico W BLE Firmware v1.0
  ===================================================

  Hardware:
    - Raspberry Pi Pico W (chip BLE: CYW43439)
    - Relay en GPIO 15 (LOW = activado, HIGH = apagado en relés activos por bajo)
    - LED indicador en LED_BUILTIN (LED on-board del CYW43)

  Protocolo BLE — IDÉNTICO al ESP32:
    Service UUID:       12345678-1234-1234-1234-123456789abc
    Control (Write):    12345678-1234-1234-1234-123456789abd
    Status (Read+Notif):12345678-1234-1234-1234-123456789abe
    Nombre BLE:         CleanCare-Pico

  Comandos:
    ON:60                       → Encender relay 60s
    ON:60:USR-XXXX:lavarropas   → Encender + registrar uso
    OFF                         → Apagar relay
    STATUS                      → Pedir estado actual
    TIME:2026-04-13T15:30:00    → Sincronizar fecha/hora
    LOGS:cleancare2026          → Extraer registros (con clave)
    CLEAR_LOGS:cleancare2026    → Borrar registros
    INFO                        → Conexiones, logs, uptime, fecha

  Características:
    - Auto-reset cada 24h si no hay ciclo activo
    - Logs persistentes en LittleFS (hasta 200 registros)
    - Heartbeat cada 30s en serial
    - LED parpadea 3 veces al arrancar
    - Logs protegidos con clave

  Dependencias:
    - ArduinoBLE (gestor de librerías o platformio.ini)
    - LittleFS (incluido en arduino-pico core de earlephilhower)

  Subir:
    cd firmware/pico_w_ble
    pio run --target upload
    pio device monitor
*/

#include <Arduino.h>
#include <ArduinoBLE.h>
#include <LittleFS.h>

// ------------------- Configuración -------------------
#define BLE_DEVICE_NAME      "CleanCare-Pico"
#define SERVICE_UUID         "12345678-1234-1234-1234-123456789abc"
#define CONTROL_CHAR_UUID    "12345678-1234-1234-1234-123456789abd"
#define STATUS_CHAR_UUID     "12345678-1234-1234-1234-123456789abe"

#define RELAY_PIN            15
#define RELAY_ACTIVE_LOW     true   // Cambiar a false si tu relé es activo-alto
#define RESET_INTERVAL_MS    86400000UL  // 24h
#define MAX_LOGS             200
#define LOG_ACCESS_KEY       "cleancare2026"
#define LOGS_PATH            "/logs.txt"

// ------------------- Estado global -------------------
BLEService cleancareService(SERVICE_UUID);
BLECharacteristic controlChar(CONTROL_CHAR_UUID, BLEWrite, 128);
BLECharacteristic statusChar(STATUS_CHAR_UUID, BLERead | BLENotify, 64);

bool   relayOn          = false;
unsigned long relayOffMs= 0;
unsigned long startMs   = 0;
int    connectionCount  = 0;

String currentDateTime  = "";
unsigned long dateTimeReceivedAt = 0;

// ------------------- Helpers de relé -------------------
inline void relayWrite(bool on) {
  if (RELAY_ACTIVE_LOW) digitalWrite(RELAY_PIN, on ? LOW : HIGH);
  else                  digitalWrite(RELAY_PIN, on ? HIGH : LOW);
}

// ------------------- LittleFS — registros -------------------
//
// Formato del archivo /logs.txt — una línea por registro:
//   FECHA|USUARIO|DURACION|TIPO\n
// Limitado a MAX_LOGS líneas (rotación FIFO al exceder).

int fsLogCount() {
  if (!LittleFS.exists(LOGS_PATH)) return 0;
  File f = LittleFS.open(LOGS_PATH, "r");
  if (!f) return 0;
  int n = 0;
  while (f.available()) { if (f.read() == '\n') n++; }
  f.close();
  return n;
}

void fsRotateIfNeeded() {
  int n = fsLogCount();
  if (n < MAX_LOGS) return;
  // Leer todas las líneas, descartar la primera, reescribir
  File r = LittleFS.open(LOGS_PATH, "r");
  if (!r) return;
  String all;
  bool firstSkipped = false;
  while (r.available()) {
    String line = r.readStringUntil('\n');
    if (!firstSkipped) { firstSkipped = true; continue; }
    if (line.length() > 0) { all += line; all += '\n'; }
  }
  r.close();
  File w = LittleFS.open(LOGS_PATH, "w");
  if (w) { w.print(all); w.close(); }
}

void fsSaveLog(const String& dateTime, const String& userId,
               int durationSec, const String& tipo) {
  fsRotateIfNeeded();
  File f = LittleFS.open(LOGS_PATH, "a");
  if (!f) {
    Serial.println("[FS] Error abriendo logs.txt para append");
    return;
  }
  String entry = dateTime + "|" + userId + "|" + String(durationSec) + "|" + tipo;
  f.println(entry);
  f.close();
  Serial.print("[FS] Log guardado: "); Serial.println(entry);
}

void fsClearLogs() {
  if (LittleFS.exists(LOGS_PATH)) LittleFS.remove(LOGS_PATH);
  Serial.println("[FS] Logs borrados");
}

void fsSendAllLogs() {
  int total = fsLogCount();
  // Header
  String header = "LOGS:" + String(total);
  statusChar.writeValue(header.c_str());
  delay(80);
  if (total == 0) {
    statusChar.writeValue("LOGS_END");
    return;
  }
  File f = LittleFS.open(LOGS_PATH, "r");
  if (!f) {
    statusChar.writeValue("LOGS_END");
    return;
  }
  int idx = 0;
  while (f.available()) {
    String line = f.readStringUntil('\n');
    line.trim();
    if (line.length() == 0) continue;
    String out = "LOG:" + String(idx) + ":" + line;
    statusChar.writeValue(out.c_str());
    delay(40);
    idx++;
  }
  f.close();
  statusChar.writeValue("LOGS_END");
  Serial.print("[FS] "); Serial.print(idx); Serial.println(" logs enviados");
}

String getCurrentDateTime() {
  if (currentDateTime.length() == 0) return "sin-fecha";
  return currentDateTime;
}

// ------------------- BLE — status -------------------
void sendStatus() {
  String s;
  if (relayOn) {
    long remaining = (long)((relayOffMs - millis()) / 1000);
    if (remaining < 0) remaining = 0;
    s = "ON:" + String(remaining);
  } else {
    s = "OFF:0";
  }
  statusChar.writeValue(s.c_str());
  Serial.print("[TX] "); Serial.println(s);
}

void turnOff() {
  relayOn   = false;
  relayOffMs= 0;
  startMs   = 0;
  relayWrite(false);
  digitalWrite(LED_BUILTIN, LOW);
  Serial.println("[OK] Relay APAGADO");
  sendStatus();
}

// ------------------- Manejador de comandos -------------------
void handleCommand(const String& value) {
  Serial.println("-----------------------------------------");
  Serial.print("[CMD] \""); Serial.print(value); Serial.println("\"");

  if (value.startsWith("ON")) {
    int sep1 = value.indexOf(':');
    int sep2 = (sep1 > 0) ? value.indexOf(':', sep1 + 1) : -1;
    int sep3 = (sep2 > 0) ? value.indexOf(':', sep2 + 1) : -1;

    int durationSec = 60;
    String userId = "desconocido";
    String tipo   = "desconocido";

    if (sep1 > 0) {
      if (sep2 > 0) {
        durationSec = value.substring(sep1 + 1, sep2).toInt();
        if (sep3 > 0) {
          userId = value.substring(sep2 + 1, sep3);
          tipo   = value.substring(sep3 + 1);
        } else {
          userId = value.substring(sep2 + 1);
        }
      } else {
        durationSec = value.substring(sep1 + 1).toInt();
      }
    }
    if (durationSec <= 0) durationSec = 60;

    relayOn    = true;
    startMs    = millis();
    relayOffMs = startMs + (unsigned long)durationSec * 1000UL;
    relayWrite(true);
    digitalWrite(LED_BUILTIN, HIGH);

    Serial.print("[OK] Relay ON por "); Serial.print(durationSec); Serial.println("s");
    fsSaveLog(getCurrentDateTime(), userId, durationSec, tipo);
    sendStatus();

  } else if (value == "OFF") {
    turnOff();

  } else if (value == "STATUS") {
    sendStatus();

  } else if (value.startsWith("TIME:")) {
    currentDateTime = value.substring(5);
    dateTimeReceivedAt = millis();
    Serial.print("[OK] Fecha: "); Serial.println(currentDateTime);

  } else if (value.startsWith("LOGS:")) {
    String key = value.substring(5);
    if (key == LOG_ACCESS_KEY) {
      fsSendAllLogs();
    } else {
      Serial.println("[!!] Clave incorrecta");
      statusChar.writeValue("LOGS_ERROR:clave_incorrecta");
    }

  } else if (value.startsWith("CLEAR_LOGS:")) {
    String key = value.substring(11);
    if (key == LOG_ACCESS_KEY) {
      fsClearLogs();
      statusChar.writeValue("LOGS_CLEARED");
    } else {
      Serial.println("[!!] Clave incorrecta");
    }

  } else if (value == "INFO") {
    int logCount = fsLogCount();
    unsigned long uptimeSec = millis() / 1000;
    String info = "INFO:" + String(connectionCount) + ":" + String(logCount)
                + ":" + String(uptimeSec) + ":" + currentDateTime;
    statusChar.writeValue(info.c_str());
    Serial.print("[TX] "); Serial.println(info);

  } else {
    Serial.print("[??] Desconocido: "); Serial.println(value);
  }
  Serial.println("-----------------------------------------");
}

// ------------------- BLE callbacks -------------------
void onCentralConnected(BLEDevice central) {
  connectionCount++;
  Serial.println("=========================================");
  Serial.print("[OK] Cliente conectado — "); Serial.println(central.address());
  Serial.print("[INFO] Conexión #"); Serial.println(connectionCount);
  Serial.println("=========================================");
}

void onCentralDisconnected(BLEDevice central) {
  Serial.println("=========================================");
  Serial.print("[!!] Cliente desconectado — "); Serial.println(central.address());
  Serial.println("=========================================");
}

void onControlWritten(BLEDevice central, BLECharacteristic chr) {
  // Leer payload
  int len = chr.valueLength();
  if (len <= 0 || len > 127) return;
  uint8_t buf[128];
  chr.readValue(buf, len);
  buf[len] = 0;
  String value = String((char*)buf);
  handleCommand(value);
}

// ------------------- Setup -------------------
void setup() {
  Serial.begin(115200);
  unsigned long t0 = millis();
  while (!Serial && (millis() - t0 < 2000)) { /* esperar USB serial */ }

  Serial.println();
  Serial.println("=============================================");
  Serial.println("  CleanCare Pico W — BLE Firmware v1.0");
  Serial.println("=============================================");

  // Relay + LED
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(LED_BUILTIN, OUTPUT);
  relayWrite(false);
  digitalWrite(LED_BUILTIN, LOW);
  Serial.print("[1/5] Relay GPIO "); Serial.println(RELAY_PIN);

  // LittleFS
  Serial.println("[2/5] Montando LittleFS...");
  if (!LittleFS.begin()) {
    Serial.println("       (formateando — primera vez)");
    LittleFS.format();
    LittleFS.begin();
  }
  Serial.print("       Logs guardados: "); Serial.println(fsLogCount());

  // BLE
  Serial.println("[3/5] Inicializando BLE (CYW43)...");
  if (!BLE.begin()) {
    Serial.println("[!!] BLE.begin() falló — verificá que sea Pico W (no Pico clásico)");
    while (1) { delay(1000); }
  }
  BLE.setLocalName(BLE_DEVICE_NAME);
  BLE.setDeviceName(BLE_DEVICE_NAME);
  BLE.setAdvertisedService(cleancareService);

  Serial.println("[4/5] Registrando servicio + características...");
  cleancareService.addCharacteristic(controlChar);
  cleancareService.addCharacteristic(statusChar);
  BLE.addService(cleancareService);

  statusChar.writeValue("OFF:0");
  controlChar.setEventHandler(BLEWritten, onControlWritten);

  BLE.setEventHandler(BLEConnected,    onCentralConnected);
  BLE.setEventHandler(BLEDisconnected, onCentralDisconnected);

  Serial.println("[5/5] Iniciando advertising...");
  BLE.advertise();

  Serial.println();
  Serial.println("=============================================");
  Serial.print("   "); Serial.print(BLE_DEVICE_NAME); Serial.println(" listo");
  Serial.println("   Auto-reset en 24h si no hay ciclo activo");
  Serial.println("=============================================");
  Serial.println();

  // Parpadear LED 3 veces
  for (int i = 0; i < 3; i++) {
    digitalWrite(LED_BUILTIN, HIGH); delay(180);
    digitalWrite(LED_BUILTIN, LOW);  delay(180);
  }
}

// ------------------- Loop -------------------
void loop() {
  // BLE poll
  BLE.poll();

  // Auto-reset 24h (sólo sin ciclo)
  if (millis() >= RESET_INTERVAL_MS && !relayOn) {
    Serial.println("[RESET] 24h cumplidas — reiniciando...");
    delay(500);
    rp2040.reboot();
  }

  // Apagar al cumplir tiempo
  if (relayOn && millis() >= relayOffMs) {
    Serial.println("[TIMER] Tiempo cumplido");
    turnOff();
  }

  // Notify status cada 2s si hay ciclo activo
  static unsigned long lastNotify = 0;
  if (relayOn && (millis() - lastNotify > 2000)) {
    sendStatus();
    lastNotify = millis();
  }

  // Heartbeat cada 30s
  static unsigned long lastHeartbeat = 0;
  if (millis() - lastHeartbeat > 30000) {
    Serial.print("[HEARTBEAT] uptime ");
    Serial.print(millis() / 1000);
    Serial.print("s — logs ");
    Serial.println(fsLogCount());
    lastHeartbeat = millis();
  }
}
