/*
  CleanCare — BLE Firmware v4.0 (multi-máquina)

  Features:
  - BLE server "CleanCare-ESP32"
  - Controla hasta MAX_MAQUINAS (4) en pines de relay separados
  - Cada comando ON:seg:user:tipo:maquina_id activa un slot específico
  - Sin maquina_id, usa slot 0 (compat v3)
  - Mapeo maquina_id → slot persistido en NVS
  - Soporta múltiples clientes BLE simultáneos (hasta 3 conexiones)
  - Auto-reset cada 24h (si ninguna máquina está activa)
  - Registro de usos en NVS
  - Recibe fecha/hora de la app

  Subir:
    cd firmware/ble_test
    pio run --target upload
    pio device monitor
*/

#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <Preferences.h>

// UUIDs — DEBEN coincidir con app/src/constants/ble.ts
#define ESP32_ID            "001"
#define SERVICE_UUID        "cc7a5001-bb73-4e02-8f1d-a0b0c0d0e0f1"
#define CONTROL_CHAR_UUID   "cc7a5001-bb73-4e02-8f1d-a0b0c0d0e0f2"
#define STATUS_CHAR_UUID    "cc7a5001-bb73-4e02-8f1d-a0b0c0d0e0f3"

#define LED_PIN 2
#define BOOT_PULSE_PIN 32
#define BOOT_PULSE_MS 3000
#define BUZZER_PIN 26
#define BUZZER_CHANNEL 0
#define RESET_INTERVAL_MS   86400000UL
#define WARNING_THRESHOLD_SEC 30
#define WARNING_INTERVAL_MS 5000
#define MAX_LOGS            200
#define LOG_ACCESS_KEY      "cleancare2026"

// Multi-máquina
#define MAX_MAQUINAS 4
const int RELAY_PINS[MAX_MAQUINAS] = { 21, 22, 23, 19 };

struct MaquinaSlot {
  String maquina_id;        // "" si libre
  bool activa;              // true si relay ON
  unsigned long offTime;
  unsigned long startTime;
  unsigned long durationMs;
  String usuario;
  String tipo;
  unsigned long lastWarningBeep;
};
MaquinaSlot slots[MAX_MAQUINAS];

Preferences preferences;
BLECharacteristic *statusCharacteristic;
BLEServer *bleServer;

int deviceCount = 0;
bool advertisingRestartPending = false;
unsigned long advertisingRestartAt = 0;
bool bootPulseActive = true;
unsigned long bootPulseEndsAt = 0;
bool disconnectBeepPending = false;
int connectionCount = 0;

String currentDateTime = "";
unsigned long dateTimeReceivedAt = 0;

// Forward declarations
void buzzerInit();
void playTone(int freq, int durationMs);
void playBootMelody();
void playStartMelody();
void playEndMelody();
void playDisconnectBeep();
void playWarningBeep();
void sendStatusAll();
void sendStatusSlot(int idx);
void turnOffSlot(int idx, bool playEndMel);
bool anyActive();

// ==========================================
// NVS — MAPEO DE MÁQUINAS (maquina_id → slot)
// ==========================================

void loadMapping() {
  preferences.begin("maqmap", true);
  for (int i = 0; i < MAX_MAQUINAS; i++) {
    slots[i].maquina_id = preferences.getString(("s" + String(i)).c_str(), "");
  }
  preferences.end();
}

void saveMapping() {
  preferences.begin("maqmap", false);
  for (int i = 0; i < MAX_MAQUINAS; i++) {
    preferences.putString(("s" + String(i)).c_str(), slots[i].maquina_id);
  }
  preferences.end();
}

int findOrAssignSlot(String maquina_id) {
  if (maquina_id.length() == 0) return 0;  // legacy: sin id → slot 0

  // Existente
  for (int i = 0; i < MAX_MAQUINAS; i++) {
    if (slots[i].maquina_id == maquina_id) return i;
  }
  // Libre
  for (int i = 0; i < MAX_MAQUINAS; i++) {
    if (slots[i].maquina_id.length() == 0) {
      slots[i].maquina_id = maquina_id;
      saveMapping();
      Serial.print("[MAP] Slot ");
      Serial.print(i);
      Serial.print(" asignado a ");
      Serial.println(maquina_id);
      return i;
    }
  }
  return -1;
}

int findSlot(String maquina_id) {
  if (maquina_id.length() == 0) return 0;
  for (int i = 0; i < MAX_MAQUINAS; i++) {
    if (slots[i].maquina_id == maquina_id) return i;
  }
  return -1;
}

// ==========================================
// NVS — LOGS DE USOS
// ==========================================

int getLogCount() {
  preferences.begin("logs", true);
  int count = preferences.getInt("count", 0);
  preferences.end();
  return count;
}

void saveLog(String dateTime, String userId, int durationSec, String tipo, String maquina_id) {
  preferences.begin("logs", false);
  int count = preferences.getInt("count", 0);

  if (count >= MAX_LOGS) {
    for (int i = 0; i < MAX_LOGS - 1; i++) {
      String next = preferences.getString(("l" + String(i + 1)).c_str(), "");
      preferences.putString(("l" + String(i)).c_str(), next);
    }
    count = MAX_LOGS - 1;
  }

  String entry = dateTime + "|" + userId + "|" + String(durationSec) + "|" + tipo + "|" + maquina_id;
  preferences.putString(("l" + String(count)).c_str(), entry);
  preferences.putInt("count", count + 1);
  preferences.end();

  Serial.print("[NVS] Log #");
  Serial.print(count);
  Serial.print(": ");
  Serial.println(entry);
}

void sendAllLogs() {
  if (deviceCount == 0 || !statusCharacteristic) return;

  preferences.begin("logs", true);
  int count = preferences.getInt("count", 0);

  String header = "LOGS:" + String(count);
  statusCharacteristic->setValue(header.c_str());
  statusCharacteristic->notify();
  delay(100);

  for (int i = 0; i < count; i++) {
    String entry = preferences.getString(("l" + String(i)).c_str(), "");
    if (entry.length() > 0) {
      String line = "LOG:" + String(i) + ":" + entry;
      statusCharacteristic->setValue(line.c_str());
      statusCharacteristic->notify();
      delay(50);
    }
  }

  statusCharacteristic->setValue("LOGS_END");
  statusCharacteristic->notify();
  preferences.end();
}

void clearAllLogs() {
  preferences.begin("logs", false);
  int count = preferences.getInt("count", 0);
  for (int i = 0; i < count; i++) {
    preferences.remove(("l" + String(i)).c_str());
  }
  preferences.putInt("count", 0);
  preferences.end();
  Serial.println("[NVS] Logs borrados");
}

String getCurrentDateTime() {
  if (currentDateTime.length() == 0) return "sin-fecha";
  return currentDateTime;
}

// ==========================================
// BLE CALLBACKS
// ==========================================

class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *pServer) {
    deviceCount++;
    connectionCount++;
    Serial.println("=========================================");
    Serial.print("[OK] CLIENTE CONECTADO — total activos: ");
    Serial.println(deviceCount);
    Serial.print("[INFO] Conexion #");
    Serial.println(connectionCount);
    Serial.print("[STATE] Slots: ");
    for (int i = 0; i < MAX_MAQUINAS; i++) {
      Serial.print("s");
      Serial.print(i);
      Serial.print("=");
      if (slots[i].maquina_id.length() == 0) Serial.print("libre");
      else {
        Serial.print(slots[i].maquina_id);
        Serial.print(slots[i].activa ? "[ON]" : "[idle]");
      }
      Serial.print(" ");
    }
    Serial.println();
    // LED encendido mientras hay cliente conectado (si no hay slot activo también)
    digitalWrite(LED_PIN, HIGH);
    Serial.println("=========================================");
    // Mantener advertising para aceptar más clientes
    BLEDevice::startAdvertising();
  }

  void onDisconnect(BLEServer *pServer) {
    if (deviceCount > 0) deviceCount--;
    Serial.println("=========================================");
    Serial.print("[!!] CLIENTE DESCONECTADO — quedan: ");
    Serial.println(deviceCount);
    Serial.println("=========================================");
    if (deviceCount == 0 && !anyActive()) digitalWrite(LED_PIN, LOW);
    disconnectBeepPending = true;
    advertisingRestartPending = true;
    advertisingRestartAt = millis() + 500;
  }
};

void turnOnSlot(int idx, int durSec, String userId, String tipo, String maquina_id) {
  if (idx < 0 || idx >= MAX_MAQUINAS) return;
  slots[idx].activa = true;
  slots[idx].durationMs = (unsigned long)durSec * 1000;
  slots[idx].startTime = millis();
  slots[idx].offTime = millis() + slots[idx].durationMs;
  slots[idx].usuario = userId;
  slots[idx].tipo = tipo;
  slots[idx].lastWarningBeep = 0;
  digitalWrite(RELAY_PINS[idx], HIGH);
  digitalWrite(LED_PIN, HIGH);
  playStartMelody();

  Serial.print("[ON] Slot ");
  Serial.print(idx);
  Serial.print(" (pin D");
  Serial.print(RELAY_PINS[idx]);
  Serial.print(") — ");
  Serial.print(maquina_id);
  Serial.print(" — ");
  Serial.print(durSec);
  Serial.println("s");

  saveLog(getCurrentDateTime(), userId, durSec, tipo, maquina_id);
  sendStatusSlot(idx);
}

class ControlCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pChar) {
    String value = pChar->getValue().c_str();
    // Blink LED brevemente para confirmar recepción
    digitalWrite(LED_PIN, LOW); delay(30); digitalWrite(LED_PIN, HIGH);
    Serial.println("-----------------------------------------");
    Serial.print("[RX] ");
    Serial.print(value.length());
    Serial.print(" bytes @ ");
    Serial.print(millis() / 1000);
    Serial.println("s");
    Serial.print("[CMD] \"");
    Serial.print(value);
    Serial.println("\"");

    // --- ON:seg:userId:tipo:maquina_id ---
    if (value.startsWith("ON")) {
      // Parsear hasta 4 separadores
      int parts[5];
      int count = 0;
      int start = 0;
      for (int i = 0; i <= value.length() && count < 5; i++) {
        if (i == value.length() || value.charAt(i) == ':') {
          parts[count++] = i;
          if (count >= 5) break;
        }
      }
      // parts[0] = posición del primer ':' o fin (así quedamos con "ON")
      int durationSec = 60;
      String userId = "desconocido";
      String tipo = "desconocido";
      String maquina_id = "";

      // Formato: ON : dur : user : tipo : maq
      //        p0   p1    p2    p3     p4
      if (count >= 2) durationSec = value.substring(parts[0] + 1, parts[1]).toInt();
      if (count >= 3) userId = value.substring(parts[1] + 1, parts[2]);
      if (count >= 4) tipo = value.substring(parts[2] + 1, parts[3]);
      if (count >= 5) maquina_id = value.substring(parts[3] + 1, parts[4]);
      if (durationSec <= 0) durationSec = 60;

      int slotIdx = findOrAssignSlot(maquina_id);
      if (slotIdx < 0) {
        Serial.println("[!!] Todos los slots ocupados");
        statusCharacteristic->setValue("ERROR:no_slots");
        statusCharacteristic->notify();
      } else {
        turnOnSlot(slotIdx, durationSec, userId, tipo, maquina_id);
      }

    // --- OFF  u  OFF:maquina_id ---
    } else if (value.startsWith("OFF")) {
      int sep = value.indexOf(':');
      if (sep < 0) {
        // Apagar todas (legacy)
        for (int i = 0; i < MAX_MAQUINAS; i++) if (slots[i].activa) turnOffSlot(i, false);
      } else {
        String mid = value.substring(sep + 1);
        int idx = findSlot(mid);
        if (idx >= 0) turnOffSlot(idx, false);
      }

    // --- STATUS  u  STATUS:maquina_id ---
    } else if (value.startsWith("STATUS")) {
      int sep = value.indexOf(':');
      if (sep < 0) {
        sendStatusAll();
      } else {
        String mid = value.substring(sep + 1);
        int idx = findSlot(mid);
        if (idx >= 0) sendStatusSlot(idx);
        else sendStatusAll();
      }

    // --- TIME:YYYY-MM-DDTHH:MM:SS ---
    } else if (value.startsWith("TIME:")) {
      currentDateTime = value.substring(5);
      dateTimeReceivedAt = millis();
      Serial.print("[OK] TIME: ");
      Serial.println(currentDateTime);

    // --- LOGS:clave ---
    } else if (value.startsWith("LOGS:")) {
      String key = value.substring(5);
      if (key == LOG_ACCESS_KEY) sendAllLogs();
      else { statusCharacteristic->setValue("LOGS_ERROR"); statusCharacteristic->notify(); }

    // --- CLEAR_LOGS:clave ---
    } else if (value.startsWith("CLEAR_LOGS:")) {
      String key = value.substring(11);
      if (key == LOG_ACCESS_KEY) {
        clearAllLogs();
        statusCharacteristic->setValue("LOGS_CLEARED"); statusCharacteristic->notify();
      }

    // --- INFO ---
    } else if (value == "INFO") {
      int logCount = getLogCount();
      unsigned long uptimeSec = millis() / 1000;
      String info = "INFO:" + String(connectionCount) + ":" + String(logCount) + ":" + String(uptimeSec) + ":" + currentDateTime + ":" + String(MAX_MAQUINAS);
      statusCharacteristic->setValue(info.c_str());
      statusCharacteristic->notify();

    // --- MAP — lista el mapeo actual maquina_id → slot ---
    } else if (value == "MAP") {
      String out = "MAP";
      for (int i = 0; i < MAX_MAQUINAS; i++) {
        out += ":" + String(i) + "=" + (slots[i].maquina_id.length() > 0 ? slots[i].maquina_id : "-");
      }
      statusCharacteristic->setValue(out.c_str());
      statusCharacteristic->notify();

    // --- MAP_CLEAR — borra el mapeo entero ---
    } else if (value == "MAP_CLEAR") {
      for (int i = 0; i < MAX_MAQUINAS; i++) {
        slots[i].maquina_id = "";
        if (slots[i].activa) turnOffSlot(i, false);
      }
      saveMapping();
      statusCharacteristic->setValue("MAP_CLEARED"); statusCharacteristic->notify();

    } else {
      Serial.print("[??] Desconocido: ");
      Serial.println(value);
    }
    Serial.println("-----------------------------------------");
  }
};

// ==========================================
// BUZZER
// ==========================================

void buzzerInit() {
  ledcSetup(BUZZER_CHANNEL, 1000, 8);
  ledcAttachPin(BUZZER_PIN, BUZZER_CHANNEL);
  ledcWrite(BUZZER_CHANNEL, 0);
}

void playTone(int freq, int durationMs) {
  ledcWriteTone(BUZZER_CHANNEL, freq);
  delay(durationMs);
  ledcWriteTone(BUZZER_CHANNEL, 0);
}

void playBootMelody() { playTone(523, 80); delay(30); playTone(784, 120); }
void playStartMelody() { playTone(523, 80); delay(40); playTone(659, 80); delay(40); playTone(784, 150); }
void playEndMelody() { playTone(784, 100); delay(50); playTone(880, 100); delay(50); playTone(988, 100); delay(50); playTone(1047, 300); }
void playDisconnectBeep() { playTone(400, 100); delay(60); playTone(300, 150); }
void playWarningBeep() { playTone(1500, 60); }

// ==========================================
// STATUS / OFF
// ==========================================

void sendStatusSlot(int idx) {
  if (deviceCount == 0 || !statusCharacteristic) return;
  String status;
  String mid = slots[idx].maquina_id.length() > 0 ? slots[idx].maquina_id : String("slot") + String(idx);
  if (slots[idx].activa) {
    int remaining = (int)((slots[idx].offTime - millis()) / 1000);
    if (remaining < 0) remaining = 0;
    status = "ON:" + String(remaining) + ":" + mid;
  } else {
    status = "OFF:0:" + mid;
  }
  statusCharacteristic->setValue(status.c_str());
  statusCharacteristic->notify();
  Serial.print("[TX] ");
  Serial.println(status);
}

void sendStatusAll() {
  if (deviceCount == 0 || !statusCharacteristic) return;
  // Compat v3: si solo el slot 0 existe o está activo, enviar formato simple
  bool onlySlot0 = true;
  for (int i = 1; i < MAX_MAQUINAS; i++) {
    if (slots[i].maquina_id.length() > 0 || slots[i].activa) { onlySlot0 = false; break; }
  }
  if (onlySlot0) {
    String status;
    if (slots[0].activa) {
      int remaining = (int)((slots[0].offTime - millis()) / 1000);
      if (remaining < 0) remaining = 0;
      status = "ON:" + String(remaining);
    } else {
      status = "OFF:0";
    }
    statusCharacteristic->setValue(status.c_str());
    statusCharacteristic->notify();
    return;
  }
  // Multi-slot: STATUSALL:s0=ON:45:m1,s1=OFF:0:m2,...
  String out = "STATUSALL";
  for (int i = 0; i < MAX_MAQUINAS; i++) {
    out += ",s" + String(i) + "=";
    String mid = slots[i].maquina_id.length() > 0 ? slots[i].maquina_id : "-";
    if (slots[i].activa) {
      int remaining = (int)((slots[i].offTime - millis()) / 1000);
      if (remaining < 0) remaining = 0;
      out += "ON:" + String(remaining) + ":" + mid;
    } else {
      out += "OFF:0:" + mid;
    }
  }
  statusCharacteristic->setValue(out.c_str());
  statusCharacteristic->notify();
}

void turnOffSlot(int idx, bool playEndMel) {
  if (idx < 0 || idx >= MAX_MAQUINAS) return;
  slots[idx].activa = false;
  slots[idx].offTime = 0;
  slots[idx].durationMs = 0;
  slots[idx].startTime = 0;
  digitalWrite(RELAY_PINS[idx], LOW);
  if (!anyActive()) digitalWrite(LED_PIN, LOW);
  Serial.print("[OFF] Slot ");
  Serial.println(idx);
  if (playEndMel) playEndMelody();
  sendStatusSlot(idx);
}

bool anyActive() {
  for (int i = 0; i < MAX_MAQUINAS; i++) if (slots[i].activa) return true;
  return false;
}

// ==========================================
// SETUP
// ==========================================

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("=============================================");
  Serial.println("   CleanCare ESP32 — BLE Firmware v4.0 (multi)");
  Serial.println("=============================================");

  // Pines
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  for (int i = 0; i < MAX_MAQUINAS; i++) {
    pinMode(RELAY_PINS[i], OUTPUT);
    digitalWrite(RELAY_PINS[i], LOW);
    slots[i].activa = false;
    slots[i].maquina_id = "";
  }
  pinMode(BOOT_PULSE_PIN, OUTPUT);
  digitalWrite(BOOT_PULSE_PIN, HIGH);
  bootPulseEndsAt = millis() + BOOT_PULSE_MS;
  buzzerInit();

  Serial.print("[1/6] LED D2, RELAYS D21/22/23/19, BOOT D32, BUZZER D26\n");

  // NVS
  Serial.println("[2/6] NVS...");
  loadMapping();
  for (int i = 0; i < MAX_MAQUINAS; i++) {
    if (slots[i].maquina_id.length() > 0) {
      Serial.print("       Slot ");
      Serial.print(i);
      Serial.print(": ");
      Serial.println(slots[i].maquina_id);
    }
  }
  int logCount = getLogCount();
  Serial.print("       Logs: ");
  Serial.println(logCount);

  // BLE
  Serial.println("[3/6] BLE init...");
  BLEDevice::init("CleanCare-ESP32");

  Serial.println("[4/6] Server...");
  bleServer = BLEDevice::createServer();
  bleServer->setCallbacks(new ServerCallbacks());

  Serial.println("[5/6] Service...");
  BLEService *service = bleServer->createService(SERVICE_UUID);
  BLECharacteristic *controlChar = service->createCharacteristic(
    CONTROL_CHAR_UUID, BLECharacteristic::PROPERTY_WRITE
  );
  controlChar->setCallbacks(new ControlCallbacks());
  statusCharacteristic = service->createCharacteristic(
    STATUS_CHAR_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
  );
  statusCharacteristic->addDescriptor(new BLE2902());
  statusCharacteristic->setValue("OFF:0");
  service->start();

  Serial.println("[6/6] Advertising...");
  BLEAdvertising *advertising = BLEDevice::getAdvertising();
  advertising->addServiceUUID(SERVICE_UUID);
  advertising->setScanResponse(true);
  advertising->setMinPreferred(0x06);
  advertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();

  Serial.println();
  Serial.println("=============================================");
  Serial.println("   ESP32 LISTO — multi-máquina activo");
  Serial.println("=============================================");
  Serial.println();

  for (int i = 0; i < 3; i++) {
    digitalWrite(LED_PIN, HIGH); delay(200);
    digitalWrite(LED_PIN, LOW); delay(200);
  }
  playBootMelody();
}

// ==========================================
// LOOP
// ==========================================

void loop() {
  if (bootPulseActive && millis() >= bootPulseEndsAt) {
    bootPulseActive = false;
    digitalWrite(BOOT_PULSE_PIN, LOW);
  }

  if (advertisingRestartPending && millis() >= advertisingRestartAt) {
    advertisingRestartPending = false;
    BLEDevice::startAdvertising();
  }

  if (disconnectBeepPending) {
    disconnectBeepPending = false;
    playDisconnectBeep();
  }

  if (millis() >= RESET_INTERVAL_MS && !anyActive()) {
    Serial.println("[RESET] 24h — reiniciando...");
    delay(1000);
    ESP.restart();
  }

  // Timer + warning por cada slot
  for (int i = 0; i < MAX_MAQUINAS; i++) {
    if (!slots[i].activa) continue;

    if (millis() >= slots[i].offTime) {
      Serial.print("[TIMER] Slot ");
      Serial.println(i);
      turnOffSlot(i, true);
      continue;
    }

    unsigned long remaining = (slots[i].offTime - millis()) / 1000;
    if (remaining <= WARNING_THRESHOLD_SEC) {
      if (millis() - slots[i].lastWarningBeep > WARNING_INTERVAL_MS) {
        playWarningBeep();
        slots[i].lastWarningBeep = millis();
      }
    }
  }

  // Status periódico + log serial de progreso
  static unsigned long lastNotify = 0;
  if (deviceCount > 0 && anyActive() && (millis() - lastNotify > 2000)) {
    sendStatusAll();
    lastNotify = millis();
  }

  static unsigned long lastProgress = 0;
  if (anyActive() && (millis() - lastProgress > 10000)) {
    lastProgress = millis();
    for (int i = 0; i < MAX_MAQUINAS; i++) {
      if (!slots[i].activa) continue;
      int rem = (int)((slots[i].offTime - millis()) / 1000);
      if (rem < 0) rem = 0;
      Serial.print("[PROG] Slot ");
      Serial.print(i);
      Serial.print(" (");
      Serial.print(slots[i].maquina_id);
      Serial.print(") — ");
      Serial.print(rem);
      Serial.print("s (");
      Serial.print(rem / 60);
      Serial.println(" min)");
    }
  }

  static unsigned long lastHeartbeat = 0;
  if (deviceCount == 0 && !anyActive() && (millis() - lastHeartbeat > 30000)) {
    Serial.print("[HB] esperando cliente — uptime ");
    Serial.print(millis() / 1000);
    Serial.print("s — ");
    Serial.print(getLogCount());
    Serial.println(" logs");
    lastHeartbeat = millis();
  }

  // Heartbeat con cliente conectado pero sin actividad — muestra q el ESP32 está a la escucha
  static unsigned long lastIdleTalk = 0;
  if (deviceCount > 0 && !anyActive() && (millis() - lastIdleTalk > 15000)) {
    Serial.print("[IDLE] cliente conectado — esperando comando. Slots: ");
    for (int i = 0; i < MAX_MAQUINAS; i++) {
      Serial.print(slots[i].maquina_id.length() > 0 ? slots[i].maquina_id : "-");
      if (i < MAX_MAQUINAS - 1) Serial.print(" ");
    }
    Serial.println();
    lastIdleTalk = millis();
  }

  delay(100);
}
