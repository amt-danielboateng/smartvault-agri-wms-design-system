#include <Arduino.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <SHTSensor.h>
#include <ArduinoJson.h>

// ── Configuration ────────────────────────────────────────────────────────────
#define SILO_ID       "silo-001"
#define WIFI_SSID     "YOUR_SSID"
#define WIFI_PASSWORD "YOUR_PASSWORD"
#define MQTT_HOST     "your-broker.example.com"
#define MQTT_PORT     8883
#define DS18B20_PIN   4
#define PUBLISH_MS    30000

// ── Sensor setup ─────────────────────────────────────────────────────────────
OneWire oneWire(DS18B20_PIN);
DallasTemperature ds18b20(&oneWire);
SHTSensor sht31;

WiFiClientSecure wifiClient;
PubSubClient mqtt(wifiClient);

void connectWifi() {
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    while (WiFi.status() != WL_CONNECTED) delay(500);
}

void connectMqtt() {
    while (!mqtt.connected()) {
        if (mqtt.connect(SILO_ID)) break;
        delay(5000);
    }
}

void setup() {
    Serial.begin(115200);
    ds18b20.begin();
    sht31.init();
    connectWifi();
    wifiClient.setInsecure(); // Replace with CA cert in production
    mqtt.setServer(MQTT_HOST, MQTT_PORT);
    connectMqtt();
}

void loop() {
    if (!mqtt.connected()) connectMqtt();
    mqtt.loop();

    ds18b20.requestTemperatures();
    float tempC = ds18b20.getTempCByIndex(0);
    sht31.readSample();
    float humidity = sht31.getHumidity();

    StaticJsonDocument<128> doc;
    doc["silo_id"] = SILO_ID;
    doc["temperature_c"] = tempC;
    doc["humidity_percent"] = humidity;

    char buf[128];
    serializeJson(doc, buf);
    mqtt.publish("silo/" SILO_ID "/telemetry", buf, /*retained=*/false);

    delay(PUBLISH_MS);
}
