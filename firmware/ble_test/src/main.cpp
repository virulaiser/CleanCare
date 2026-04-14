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

// UUIDs — DEBEN coincidir con la app
#define SERVICE_UUID        "12345678-1234-1234-1234-123456789abc"
#define CONTROL_CHAR_UUID   "12345678-1234-1234-1234-123456789abd"
#define STATUS_CHAR_UUID    "12345678-1234-1234-1234-123456789abe"

#define LED_PIN 2
#define RELAY_PIN 21                     // D21 — relay de la máquina
#define RESET_INTERVAL_MS   86400000UL  // 24 horas en ms
#define MAX_LOGS            200         // Máximo de registros en NVS
#define LOG_ACCESS_KEY      "cleancare2026"

Preferences preferences;
BLECharacteristic *statusCharacteristic;
BLEServer *bleServer;

bool deviceConnected = false;
bool advertisingRestartPending = false;
unsigned long advertisingRestartAt = 0;
bool ledOn = false;
unsigned long ledOffTime = 0;
unsigned long durationMs = 0;
unsigned long startTime = 0;
int connectionCount = 0;

// Fecha/hora recibida de la app
String currentDateTime = "";
unsigned long dateTimeReceivedAt = 0;  // millis() cuando se recibió

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
    // Marcar para reiniciar advertising desde el loop (evita problemas dentro del callback)
    advertisingRestartPending = true;
    advertisingRestartAt = millis() + 500;
  }
};

void sendStatus();
void turnOff();

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
      digitalWrite(LED_PIN, HIGH);
      digitalWrite(RELAY_PIN, HIGH);
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
      turnOff();

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

void turnOff() {
  ledOn = false;
  ledOffTime = 0;
  durationMs = 0;
  startTime = 0;
  digitalWrite(LED_PIN, LOW);
  digitalWrite(RELAY_PIN, LOW);
  Serial.println("[OK] LED + RELAY D21 APAGADOS");
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

  // 1. LED + RELAY
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);
  Serial.println("[1/6] LED GPIO 2 + RELAY GPIO 21 configurados");

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

  // Parpadear LED 3 veces
  for (int i = 0; i < 3; i++) {
    digitalWrite(LED_PIN, HIGH); delay(200);
    digitalWrite(LED_PIN, LOW); delay(200);
  }
  Serial.println("[OK] Firmware v3.0 listo");
  Serial.println();
}

// ==========================================
// LOOP
// ==========================================

void loop() {
  // Reiniciar advertising tras desconexión (desde loop, no desde callback)
  if (advertisingRestartPending && millis() >= advertisingRestartAt) {
    advertisingRestartPending = false;
    BLEDevice::startAdvertising();
    Serial.println("[OK] Advertising reiniciado — ESP32 visible de nuevo");
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
    turnOff();
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
