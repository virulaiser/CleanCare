/*
  CleanCare — BLE Firmware v3.0

  Features:
  - BLE server "CleanCare-ESP32"
  - LED/relay control via BLE commands
  - Auto-reset cada 24h (si no hay ciclo activo)
  - Registro de usos en NVS (memoria no volátil)
  - Recibe fecha/hora de la app
  - Extracción de logs con clave

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
// ESP32-001 — ver firmware/ble_test/.env
#define ESP32_ID            "001"
#define SERVICE_UUID        "cc7a5001-bb73-4e02-8f1d-a0b0c0d0e0f1"
#define CONTROL_CHAR_UUID   "cc7a5001-bb73-4e02-8f1d-a0b0c0d0e0f2"
#define STATUS_CHAR_UUID    "cc7a5001-bb73-4e02-8f1d-a0b0c0d0e0f3"

#define LED_PIN 2
#define RELAY_PIN 21                     // D21 — relay de la máquina
#define BOOT_PULSE_PIN 32                // D32 — pulso al arrancar (reset BLE externo)
#define BOOT_PULSE_MS 3000               // Duración del pulso de boot
#define BUZZER_PIN 26                    // Buzzer del shield Cytron Robo ESP32
#define BUZZER_CHANNEL 0
#define RESET_INTERVAL_MS   86400000UL  // 24 horas en ms
#define WARNING_THRESHOLD_SEC 30         // Beep cada 5s en los últimos 30s
#define WARNING_INTERVAL_MS 5000
#define MAX_LOGS            200         // Máximo de registros en NVS
#define LOG_ACCESS_KEY      "cleancare2026"

Preferences preferences;
BLECharacteristic *statusCharacteristic;
BLEServer *bleServer;

bool deviceConnected = false;
bool advertisingRestartPending = false;
unsigned long advertisingRestartAt = 0;
bool bootPulseActive = true;
unsigned long bootPulseEndsAt = 0;
bool disconnectBeepPending = false;
bool ledOn = false;
unsigned long lastWarningBeepAt = 0;
unsigned long ledBlinkAt = 0;
bool ledBlinkState = false;
unsigned long ledOffTime = 0;
unsigned long durationMs = 0;
unsigned long startTime = 0;
int connectionCount = 0;

// Fecha/hora recibida de la app
String currentDateTime = "";
unsigned long dateTimeReceivedAt = 0;  // millis() cuando se recibió

// Forward declarations
void buzzerInit();
void playTone(int freq, int durationMs);
void playBootMelody();
void playStartMelody();
void playEndMelody();
void playDisconnectBeep();
void playWarningBeep();

// ==========================================
// NVS — REGISTRO DE USOS
// ==========================================

int getLogCount() {
  preferences.begin("logs", true);
  int count = preferences.getInt("count", 0);
  preferences.end();
  return count;
}

void saveLog(String dateTime, String userId, int durationSec, String tipo) {
  preferences.begin("logs", false);
  int count = preferences.getInt("count", 0);

  // Si llegamos al máximo, rotar (borrar el más viejo)
  if (count >= MAX_LOGS) {
    // Mover todo un lugar hacia atrás
    for (int i = 0; i < MAX_LOGS - 1; i++) {
      String next = preferences.getString(("l" + String(i + 1)).c_str(), "");
      preferences.putString(("l" + String(i)).c_str(), next);
    }
    count = MAX_LOGS - 1;
  }

  // Formato: "FECHA|USUARIO|DURACION|TIPO"
  String entry = dateTime + "|" + userId + "|" + String(durationSec) + "|" + tipo;
  preferences.putString(("l" + String(count)).c_str(), entry);
  preferences.putInt("count", count + 1);
  preferences.end();

  Serial.print("[NVS] Log guardado #");
  Serial.print(count);
  Serial.print(": ");
  Serial.println(entry);
}

void sendAllLogs() {
  if (!deviceConnected || !statusCharacteristic) return;

  preferences.begin("logs", true);
  int count = preferences.getInt("count", 0);

  // Enviar header
  String header = "LOGS:" + String(count);
  statusCharacteristic->setValue(header.c_str());
  statusCharacteristic->notify();
  delay(100);

  Serial.print("[NVS] Enviando ");
  Serial.print(count);
  Serial.println(" logs por BLE...");

  // Enviar cada log
  for (int i = 0; i < count; i++) {
    String entry = preferences.getString(("l" + String(i)).c_str(), "");
    if (entry.length() > 0) {
      String line = "LOG:" + String(i) + ":" + entry;
      statusCharacteristic->setValue(line.c_str());
      statusCharacteristic->notify();
      delay(50);  // Dar tiempo al BLE
    }
  }

  // Enviar fin
  statusCharacteristic->setValue("LOGS_END");
  statusCharacteristic->notify();
  preferences.end();

  Serial.println("[NVS] Logs enviados completos");
}

void clearAllLogs() {
  preferences.begin("logs", false);
  int count = preferences.getInt("count", 0);
  for (int i = 0; i < count; i++) {
    preferences.remove(("l" + String(i)).c_str());
  }
  preferences.putInt("count", 0);
  preferences.end();
  Serial.println("[NVS] Todos los logs borrados");
}

// Calcular fecha/hora actual aproximada
String getCurrentDateTime() {
  if (currentDateTime.length() == 0) return "sin-fecha";
  if (dateTimeReceivedAt == 0) return currentDateTime;

  // No ajustamos por millis — devolvemos la última fecha recibida
  // (la app envía la hora en cada conexión, suficiente precisión)
  return currentDateTime;
}

// ==========================================
// BLE CALLBACKS
// ==========================================

class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *pServer) {
    deviceConnected = true;
    connectionCount++;
    Serial.println("=========================================");
    Serial.println("[OK] CLIENTE CONECTADO");
    Serial.print("[INFO] Conexion #");
    Serial.println(connectionCount);
    Serial.println("=========================================");
  }

  void onDisconnect(BLEServer *pServer) {
    deviceConnected = false;
    Serial.println("=========================================");
    Serial.println("[!!] CLIENTE DESCONECTADO");
    Serial.println("[INFO] Programando re-advertising en 500ms...");
    Serial.println("=========================================");
    // Beep y re-advertising diferidos al loop — evita bloquear la callback BLE.
    disconnectBeepPending = true;
    advertisingRestartPending = true;
    advertisingRestartAt = millis() + 500;
  }
};

void sendStatus();
void turnOff(bool playEndMel);

class ControlCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pChar) {
    String value = pChar->getValue().c_str();
    Serial.println("-----------------------------------------");
    Serial.print("[CMD] Recibido: \"");
    Serial.print(value);
    Serial.println("\"");

    // --- ON:segundos o ON:segundos:userId:tipo ---
    if (value.startsWith("ON")) {
      // Parsear: ON:60 o ON:60:USR-ABC123:lavarropas
      int sep1 = value.indexOf(':');
      int sep2 = value.indexOf(':', sep1 + 1);
      int sep3 = (sep2 > 0) ? value.indexOf(':', sep2 + 1) : -1;

      int durationSec = 60;
      String userId = "desconocido";
      String tipo = "desconocido";

      if (sep1 > 0) {
        if (sep2 > 0) {
          durationSec = value.substring(sep1 + 1, sep2).toInt();
          if (sep3 > 0) {
            userId = value.substring(sep2 + 1, sep3);
            tipo = value.substring(sep3 + 1);
          } else {
            userId = value.substring(sep2 + 1);
          }
        } else {
          durationSec = value.substring(sep1 + 1).toInt();
        }
      }
      if (durationSec <= 0) durationSec = 60;

      ledOn = true;
      durationMs = (unsigned long)durationSec * 1000;
      startTime = millis();
      ledOffTime = startTime + durationMs;
      lastWarningBeepAt = 0;
      ledBlinkAt = millis();
      digitalWrite(LED_PIN, HIGH);
      digitalWrite(RELAY_PIN, HIGH);
      playStartMelody();
      Serial.println("[OK] RELAY D21 ACTIVADO");

      Serial.print("[OK] LED ON por ");
      Serial.print(durationSec);
      Serial.print("s (");
      Serial.print(durationSec / 60);
      Serial.println(" min)");

      // Guardar registro en NVS
      saveLog(getCurrentDateTime(), userId, durationSec, tipo);

      sendStatus();

    // --- OFF ---
    } else if (value == "OFF") {
      Serial.println("[CMD] Apagando...");
      turnOff(false);  // cancelado manualmente — sin melodía de fin

    // --- STATUS ---
    } else if (value == "STATUS") {
      sendStatus();

    // --- TIME:2026-04-11T15:30:00 ---
    } else if (value.startsWith("TIME:")) {
      currentDateTime = value.substring(5);
      dateTimeReceivedAt = millis();
      Serial.print("[OK] Fecha/hora sincronizada: ");
      Serial.println(currentDateTime);

    // --- LOGS:cleancare2026 (con clave) ---
    } else if (value.startsWith("LOGS:")) {
      String key = value.substring(5);
      if (key == LOG_ACCESS_KEY) {
        Serial.println("[OK] Clave correcta — enviando logs...");
        sendAllLogs();
      } else {
        Serial.println("[!!] Clave incorrecta para acceder a logs");
        statusCharacteristic->setValue("LOGS_ERROR:clave_incorrecta");
        statusCharacteristic->notify();
      }

    // --- CLEAR_LOGS:cleancare2026 ---
    } else if (value.startsWith("CLEAR_LOGS:")) {
      String key = value.substring(11);
      if (key == LOG_ACCESS_KEY) {
        clearAllLogs();
        statusCharacteristic->setValue("LOGS_CLEARED");
        statusCharacteristic->notify();
      } else {
        Serial.println("[!!] Clave incorrecta");
      }

    // --- INFO ---
    } else if (value == "INFO") {
      int logCount = getLogCount();
      unsigned long uptimeSec = millis() / 1000;
      String info = "INFO:" + String(connectionCount) + ":" + String(logCount) + ":" + String(uptimeSec) + ":" + currentDateTime;
      statusCharacteristic->setValue(info.c_str());
      statusCharacteristic->notify();
      Serial.print("[TX] ");
      Serial.println(info);

    } else {
      Serial.print("[??] Comando desconocido: ");
      Serial.println(value);
    }
    Serial.println("-----------------------------------------");
  }
};

// ==========================================
// BUZZER — patrones de sonido (Cytron shield)
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

void playBootMelody() {
  playTone(523, 80); delay(30);   // C5
  playTone(784, 120);             // G5
}

void playStartMelody() {
  playTone(523, 80); delay(40);   // C5
  playTone(659, 80); delay(40);   // E5
  playTone(784, 150);             // G5
}

void playEndMelody() {
  playTone(784, 100); delay(50);  // G5
  playTone(880, 100); delay(50);  // A5
  playTone(988, 100); delay(50);  // B5
  playTone(1047, 300);            // C6
}

void playDisconnectBeep() {
  playTone(400, 100); delay(60);
  playTone(300, 150);
}

void playWarningBeep() {
  playTone(1500, 60);
}

// ==========================================
// FUNCIONES
// ==========================================

void sendStatus() {
  if (!deviceConnected || !statusCharacteristic) return;

  String status;
  if (ledOn) {
    int remaining = (int)((ledOffTime - millis()) / 1000);
    if (remaining < 0) remaining = 0;
    status = "ON:" + String(remaining);
  } else {
    status = "OFF:0";
  }

  statusCharacteristic->setValue(status.c_str());
  statusCharacteristic->notify();
  Serial.print("[TX] ");
  Serial.println(status);
}

void turnOff(bool playEndMel = true) {
  ledOn = false;
  ledOffTime = 0;
  durationMs = 0;
  startTime = 0;
  digitalWrite(LED_PIN, LOW);
  digitalWrite(RELAY_PIN, LOW);
  Serial.println("[OK] LED + RELAY D21 APAGADOS");
  if (playEndMel) playEndMelody();
  sendStatus();
}

// ==========================================
// SETUP
// ==========================================

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("=============================================");
  Serial.println("   CleanCare ESP32 — BLE Firmware v3.0");
  Serial.println("=============================================");
  Serial.println();

  // 1. LED + RELAY + PULSO BOOT D32
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);
  pinMode(BOOT_PULSE_PIN, OUTPUT);
  digitalWrite(BOOT_PULSE_PIN, HIGH);
  bootPulseEndsAt = millis() + BOOT_PULSE_MS;
  buzzerInit();
  Serial.println("[1/6] LED GPIO 2 + RELAY GPIO 21 + BOOT PULSE GPIO 32 HIGH (3s) + BUZZER GPIO 26");

  // 2. NVS
  Serial.println("[2/6] Inicializando NVS...");
  int logCount = getLogCount();
  Serial.print("       Registros guardados: ");
  Serial.println(logCount);

  // 3. BLE Init
  Serial.println("[3/6] Inicializando BLE...");
  BLEDevice::init("CleanCare-ESP32");
  Serial.println("       Nombre: CleanCare-ESP32");

  // 4. Server
  Serial.println("[4/6] Creando servidor BLE...");
  bleServer = BLEDevice::createServer();
  bleServer->setCallbacks(new ServerCallbacks());

  // 5. Service + Characteristics
  Serial.println("[5/6] Creando servicio...");
  BLEService *service = bleServer->createService(SERVICE_UUID);

  BLECharacteristic *controlChar = service->createCharacteristic(
    CONTROL_CHAR_UUID,
    BLECharacteristic::PROPERTY_WRITE
  );
  controlChar->setCallbacks(new ControlCallbacks());

  statusCharacteristic = service->createCharacteristic(
    STATUS_CHAR_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
  );
  statusCharacteristic->addDescriptor(new BLE2902());
  statusCharacteristic->setValue("OFF:0");

  service->start();
  Serial.println("       UUIDs:");
  Serial.print("       Service: ");
  Serial.println(SERVICE_UUID);
  Serial.print("       Control: ");
  Serial.println(CONTROL_CHAR_UUID);
  Serial.print("       Status:  ");
  Serial.println(STATUS_CHAR_UUID);

  // 6. Advertising
  Serial.println("[6/6] Advertising...");
  BLEAdvertising *advertising = BLEDevice::getAdvertising();
  advertising->addServiceUUID(SERVICE_UUID);
  advertising->setScanResponse(true);
  advertising->setMinPreferred(0x06);
  advertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();

  Serial.println();
  Serial.println("=============================================");
  Serial.println("   ESP32 LISTO — Esperando conexion");
  Serial.println("   Auto-reset en 24h si no hay ciclo activo");
  Serial.println("=============================================");
  Serial.println();
  Serial.println("Comandos BLE disponibles:");
  Serial.println("  ON:60              Encender 60 seg");
  Serial.println("  ON:60:USR-XX:lav   Encender con registro");
  Serial.println("  OFF                Apagar");
  Serial.println("  STATUS             Pedir estado");
  Serial.println("  TIME:2026-04-11..  Sincronizar fecha");
  Serial.println("  LOGS:clave         Extraer registros");
  Serial.println("  CLEAR_LOGS:clave   Borrar registros");
  Serial.println("  INFO               Info del ESP32");
  Serial.println();

  // Parpadear LED 3 veces + melodía de boot
  for (int i = 0; i < 3; i++) {
    digitalWrite(LED_PIN, HIGH); delay(200);
    digitalWrite(LED_PIN, LOW); delay(200);
  }
  playBootMelody();
  Serial.println("[OK] Firmware v3.0 listo");
  Serial.println();
}

// ==========================================
// LOOP
// ==========================================

void loop() {
  // Pulso de boot en D32 (3s HIGH al arrancar)
  if (bootPulseActive && millis() >= bootPulseEndsAt) {
    bootPulseActive = false;
    digitalWrite(BOOT_PULSE_PIN, LOW);
    Serial.println("[OK] Boot pulse D32 terminado (LOW)");
  }

  // Reiniciar advertising tras desconexión (desde loop, no desde callback)
  if (advertisingRestartPending && millis() >= advertisingRestartAt) {
    advertisingRestartPending = false;
    BLEDevice::startAdvertising();
    Serial.println("[OK] Advertising reiniciado — ESP32 visible de nuevo");
  }

  if (disconnectBeepPending) {
    disconnectBeepPending = false;
    playDisconnectBeep();
  }

  // Auto-reset cada 24h (solo si no hay ciclo activo)
  if (millis() >= RESET_INTERVAL_MS && !ledOn) {
    Serial.println();
    Serial.println("[RESET] 24h cumplidas — reiniciando ESP32...");
    Serial.println();
    delay(1000);
    ESP.restart();
  }

  // Apagar LED cuando se cumple el tiempo
  if (ledOn && millis() >= ledOffTime) {
    Serial.println();
    Serial.println("[TIMER] Tiempo cumplido!");
    turnOff(true);  // melodía de fin
  }

  // Warning beeps en los últimos 30s + LED parpadea rápido
  if (ledOn) {
    unsigned long remaining = (ledOffTime - millis()) / 1000;
    if (remaining <= WARNING_THRESHOLD_SEC) {
      if (millis() - lastWarningBeepAt > WARNING_INTERVAL_MS) {
        playWarningBeep();
        lastWarningBeepAt = millis();
      }
      // LED parpadea cada 250ms en el tramo final
      if (millis() - ledBlinkAt > 250) {
        ledBlinkState = !ledBlinkState;
        digitalWrite(LED_PIN, ledBlinkState ? HIGH : LOW);
        ledBlinkAt = millis();
      }
    }
  }

  // Status cada 2 seg si conectado y encendido
  static unsigned long lastNotify = 0;
  if (deviceConnected && ledOn && (millis() - lastNotify > 2000)) {
    sendStatus();
    lastNotify = millis();
  }

  // Heartbeat cada 30 seg
  static unsigned long lastHeartbeat = 0;
  if (!deviceConnected && (millis() - lastHeartbeat > 30000)) {
    Serial.print("[HEARTBEAT] vivo — ");
    Serial.print(millis() / 1000);
    Serial.print("s uptime — ");
    Serial.print(getLogCount());
    Serial.println(" logs guardados");
    lastHeartbeat = millis();
  }

  delay(100);
}
