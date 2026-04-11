/*
  CleanCare — BLE Firmware con diagnóstico

  Subir con PlatformIO:
    cd firmware/ble_test
    pio run --target upload
    pio device monitor
*/

#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// UUIDs — DEBEN coincidir con la app
#define SERVICE_UUID        "12345678-1234-1234-1234-123456789abc"
#define CONTROL_CHAR_UUID   "12345678-1234-1234-1234-123456789abd"
#define STATUS_CHAR_UUID    "12345678-1234-1234-1234-123456789abe"

#define LED_PIN 2

BLECharacteristic *statusCharacteristic;
BLEServer *bleServer;
bool deviceConnected = false;
bool ledOn = false;
unsigned long ledOffTime = 0;
unsigned long durationMs = 0;
unsigned long startTime = 0;
int connectionCount = 0;

// ==========================================
// CALLBACKS
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
    Serial.println("[INFO] Reiniciando advertising en 500ms...");
    Serial.println("=========================================");
    delay(500);
    pServer->startAdvertising();
    Serial.println("[OK] Advertising reiniciado — esperando nueva conexion");
  }
};

void sendStatus();
void turnOff();

class ControlCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pChar) {
    String value = pChar->getValue().c_str();
    Serial.println("-----------------------------------------");
    Serial.print("[CMD] Comando recibido: \"");
    Serial.print(value);
    Serial.println("\"");

    if (value.startsWith("ON")) {
      int sepIndex = value.indexOf(':');
      int durationSec = 60;
      if (sepIndex > 0) {
        durationSec = value.substring(sepIndex + 1).toInt();
        if (durationSec <= 0) durationSec = 60;
      }

      ledOn = true;
      durationMs = (unsigned long)durationSec * 1000;
      startTime = millis();
      ledOffTime = startTime + durationMs;
      digitalWrite(LED_PIN, HIGH);

      Serial.print("[OK] LED ENCENDIDO por ");
      Serial.print(durationSec);
      Serial.print(" segundos (");
      Serial.print(durationSec / 60);
      Serial.println(" minutos)");
      sendStatus();

    } else if (value == "OFF") {
      Serial.println("[CMD] Apagando LED...");
      turnOff();

    } else if (value == "STATUS") {
      Serial.println("[CMD] Enviando estado...");
      sendStatus();

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
  if (!deviceConnected || !statusCharacteristic) {
    Serial.println("[WARN] No se puede enviar status — sin cliente conectado");
    return;
  }

  String status;
  if (ledOn) {
    unsigned long now = millis();
    int remaining = (int)((ledOffTime - now) / 1000);
    if (remaining < 0) remaining = 0;
    status = "ON:" + String(remaining);
  } else {
    status = "OFF:0";
  }

  statusCharacteristic->setValue(status.c_str());
  statusCharacteristic->notify();
  Serial.print("[TX] Status -> ");
  Serial.println(status);
}

void turnOff() {
  ledOn = false;
  ledOffTime = 0;
  durationMs = 0;
  startTime = 0;
  digitalWrite(LED_PIN, LOW);
  Serial.println("[OK] LED APAGADO");
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
  Serial.println("   CleanCare ESP32 — BLE Firmware v2.0");
  Serial.println("=============================================");
  Serial.println();

  // 1. LED
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  Serial.println("[1/5] LED configurado en GPIO 2");

  // 2. BLE Init
  Serial.println("[2/5] Inicializando BLE...");
  BLEDevice::init("CleanCare-ESP32");
  Serial.println("       Nombre BLE: CleanCare-ESP32");

  // 3. Server + Callbacks
  Serial.println("[3/5] Creando servidor BLE...");
  bleServer = BLEDevice::createServer();
  bleServer->setCallbacks(new ServerCallbacks());
  Serial.println("       Callbacks registrados");

  // 4. Service + Characteristics
  Serial.println("[4/5] Creando servicio y caracteristicas...");
  BLEService *service = bleServer->createService(SERVICE_UUID);
  Serial.print("       Service UUID: ");
  Serial.println(SERVICE_UUID);

  BLECharacteristic *controlChar = service->createCharacteristic(
    CONTROL_CHAR_UUID,
    BLECharacteristic::PROPERTY_WRITE
  );
  controlChar->setCallbacks(new ControlCallbacks());
  Serial.print("       Control UUID: ");
  Serial.print(CONTROL_CHAR_UUID);
  Serial.println(" (Write)");

  statusCharacteristic = service->createCharacteristic(
    STATUS_CHAR_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
  );
  statusCharacteristic->addDescriptor(new BLE2902());
  statusCharacteristic->setValue("OFF:0");
  Serial.print("       Status UUID:  ");
  Serial.print(STATUS_CHAR_UUID);
  Serial.println(" (Read+Notify)");

  service->start();
  Serial.println("       Servicio iniciado");

  // 5. Advertising
  Serial.println("[5/5] Iniciando advertising...");
  BLEAdvertising *advertising = BLEDevice::getAdvertising();
  advertising->addServiceUUID(SERVICE_UUID);
  advertising->setScanResponse(true);
  advertising->setMinPreferred(0x06);
  advertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();

  Serial.println();
  Serial.println("=============================================");
  Serial.println("   ESP32 LISTO — Esperando conexion BLE");
  Serial.println("=============================================");
  Serial.println();
  Serial.println("Si la app no lo encuentra, verificar:");
  Serial.println("  1. Bluetooth del celular encendido");
  Serial.println("  2. Permiso de Ubicacion habilitado en la app");
  Serial.println("  3. Permiso de Bluetooth habilitado en la app");
  Serial.println("  4. ESP32 NO vinculado en Ajustes Bluetooth");
  Serial.println("  5. Celular cerca del ESP32 (< 5 metros)");
  Serial.println();

  // Parpadear LED 3 veces para confirmar que arrancó
  for (int i = 0; i < 3; i++) {
    digitalWrite(LED_PIN, HIGH);
    delay(200);
    digitalWrite(LED_PIN, LOW);
    delay(200);
  }
  Serial.println("[OK] LED parpadeó 3 veces — firmware listo");
  Serial.println();
}

// ==========================================
// LOOP
// ==========================================

void loop() {
  // Apagar LED cuando se cumple el tiempo
  if (ledOn && millis() >= ledOffTime) {
    Serial.println();
    Serial.println("[TIMER] Tiempo cumplido!");
    turnOff();
  }

  // Enviar status cada 2 segundos si está conectado y encendido
  static unsigned long lastNotify = 0;
  if (deviceConnected && ledOn && (millis() - lastNotify > 2000)) {
    sendStatus();
    lastNotify = millis();
  }

  // Heartbeat cada 30 seg si no hay conexión (para saber que sigue vivo)
  static unsigned long lastHeartbeat = 0;
  if (!deviceConnected && (millis() - lastHeartbeat > 30000)) {
    Serial.print("[HEARTBEAT] ESP32 vivo — advertising activo — ");
    Serial.print(millis() / 1000);
    Serial.println("s uptime");
    lastHeartbeat = millis();
  }

  delay(100);
}
