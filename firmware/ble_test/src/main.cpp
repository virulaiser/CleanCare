/*
  CleanCare — BLE Test Firmware
  ESP32 actua como servidor BLE.
  - Anuncia como "CleanCare-ESP32"
  - Recibe comandos ON/OFF via BLE
  - Prende/apaga LED integrado (GPIO 2)
  - Notifica estado y cuenta regresiva
  - Cuando termina el tiempo, apaga LED y notifica "off"
*/

#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// UUIDs del servicio y caracteristicas
#define SERVICE_UUID        "12345678-1234-1234-1234-123456789abc"
#define CONTROL_CHAR_UUID   "12345678-1234-1234-1234-123456789abd"  // Write
#define STATUS_CHAR_UUID    "12345678-1234-1234-1234-123456789abe"  // Notify

#define LED_PIN 2  // LED integrado del ESP32

BLECharacteristic *statusCharacteristic;
bool deviceConnected = false;
bool ledOn = false;
unsigned long ledOffTime = 0;      // Millis cuando se debe apagar
unsigned long durationMs = 0;      // Duracion total en ms
unsigned long startTime = 0;       // Cuando se prendio

// Callback de conexion
class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *pServer) {
    deviceConnected = true;
    Serial.println(">> Cliente conectado");
  }

  void onDisconnect(BLEServer *pServer) {
    deviceConnected = false;
    Serial.println(">> Cliente desconectado");
    // Reiniciar advertising para nueva conexion
    delay(500);
    pServer->startAdvertising();
  }
};

// Callback de escritura en la caracteristica de control
class ControlCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pChar) {
    String value = pChar->getValue().c_str();
    Serial.print("Comando recibido: ");
    Serial.println(value);

    if (value.startsWith("ON")) {
      // Formato: "ON:60" (ON + duracion en segundos)
      int sepIndex = value.indexOf(':');
      int durationSec = 60; // default 60 segundos
      if (sepIndex > 0) {
        durationSec = value.substring(sepIndex + 1).toInt();
        if (durationSec <= 0) durationSec = 60;
      }

      ledOn = true;
      durationMs = (unsigned long)durationSec * 1000;
      startTime = millis();
      ledOffTime = startTime + durationMs;
      digitalWrite(LED_PIN, HIGH);

      Serial.print("LED ON por ");
      Serial.print(durationSec);
      Serial.println(" segundos");

      // Notificar estado
      sendStatus();

    } else if (value == "OFF") {
      turnOff();
    } else if (value == "STATUS") {
      sendStatus();
    }
  }
};

void sendStatus() {
  if (!deviceConnected || !statusCharacteristic) return;

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

  Serial.print("Status enviado: ");
  Serial.println(status);
}

void turnOff() {
  ledOn = false;
  ledOffTime = 0;
  durationMs = 0;
  startTime = 0;
  digitalWrite(LED_PIN, LOW);
  Serial.println("LED OFF");
  sendStatus();
}

void setup() {
  Serial.begin(115200);
  Serial.println("\n=== CleanCare BLE Test ===");

  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  // Inicializar BLE
  BLEDevice::init("CleanCare-ESP32");

  BLEServer *server = BLEDevice::createServer();
  server->setCallbacks(new ServerCallbacks());

  // Crear servicio
  BLEService *service = server->createService(SERVICE_UUID);

  // Caracteristica de control (Write)
  BLECharacteristic *controlChar = service->createCharacteristic(
    CONTROL_CHAR_UUID,
    BLECharacteristic::PROPERTY_WRITE
  );
  controlChar->setCallbacks(new ControlCallbacks());

  // Caracteristica de estado (Notify + Read)
  statusCharacteristic = service->createCharacteristic(
    STATUS_CHAR_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
  );
  statusCharacteristic->addDescriptor(new BLE2902());
  statusCharacteristic->setValue("OFF:0");

  // Iniciar servicio y advertising
  service->start();

  BLEAdvertising *advertising = BLEDevice::getAdvertising();
  advertising->addServiceUUID(SERVICE_UUID);
  advertising->setScanResponse(true);
  advertising->setMinPreferred(0x06);
  advertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();

  Serial.println("BLE listo. Esperando conexion...");
  Serial.print("Nombre: CleanCare-ESP32");
  Serial.print("  Servicio: ");
  Serial.println(SERVICE_UUID);
}

void loop() {
  // Verificar si hay que apagar el LED
  if (ledOn && millis() >= ledOffTime) {
    Serial.println(">> Tiempo cumplido!");
    turnOff();
  }

  // Enviar status cada 2 segundos si esta conectado y encendido
  static unsigned long lastNotify = 0;
  if (deviceConnected && ledOn && (millis() - lastNotify > 2000)) {
    sendStatus();
    lastNotify = millis();
  }

  delay(100);
}
