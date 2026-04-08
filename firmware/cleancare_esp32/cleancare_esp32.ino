// CleanCare ESP32 Firmware
// Servidor HTTP local para control de relay (lavarropas/secadoras)
// Endpoints: POST /activar, GET /estado

#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>

const char* ssid = "WIFI_EDIFICIO";
const char* password = "PASSWORD";
const int RELAY_PIN = 26;

WebServer server(80);

bool relayActivo = false;
unsigned long tiempoInicio = 0;
unsigned long duracionMs = 0;

void setup() {
  Serial.begin(115200);
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConectado. IP: " + WiFi.localIP().toString());

  server.on("/activar", HTTP_POST, handleActivar);
  server.on("/estado", HTTP_GET, handleEstado);
  server.begin();
}

void loop() {
  server.handleClient();

  if (relayActivo && millis() - tiempoInicio >= duracionMs) {
    digitalWrite(RELAY_PIN, LOW);
    relayActivo = false;
    Serial.println("Relay apagado (tiempo cumplido)");
  }
}

void handleActivar() {
  if (server.hasArg("plain")) {
    JsonDocument doc;
    deserializeJson(doc, server.arg("plain"));
    int minutos = doc["minutos"] | 0;

    if (minutos > 0 && minutos <= 120) {
      duracionMs = (unsigned long)minutos * 60000;
      tiempoInicio = millis();
      relayActivo = true;
      digitalWrite(RELAY_PIN, HIGH);

      server.send(200, "application/json", "{\"estado\":\"funcionando\",\"minutos\":" + String(minutos) + "}");
    } else {
      server.send(400, "application/json", "{\"error\":\"minutos debe ser entre 1 y 120\"}");
    }
  } else {
    server.send(400, "application/json", "{\"error\":\"body vacío\"}");
  }
}

void handleEstado() {
  String json;
  if (relayActivo) {
    unsigned long transcurrido = millis() - tiempoInicio;
    int restantes = (duracionMs - transcurrido) / 60000;
    json = "{\"estado\":\"funcionando\",\"minutos_restantes\":" + String(restantes) + "}";
  } else {
    json = "{\"estado\":\"apagado\",\"minutos_restantes\":0}";
  }
  server.send(200, "application/json", json);
}
