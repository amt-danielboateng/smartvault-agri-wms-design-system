#include <Arduino.h>
#include <Preferences.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <SHTSensor.h>
#include <ArduinoJson.h>

// ── Defaults (overridden by NVS) ──────────────────────────────────────────────
#define DEFAULT_SILO_ID    "silo-001"
#define DEFAULT_MQTT_HOST  "mosquitto"
#define DEFAULT_MQTT_PORT  8883
#define DS18B20_PIN        4
#define PUBLISH_MS         30000
#define PROVISION_TIMEOUT  10000   // ms to wait for serial provisioning at boot

// ── NVS namespace ─────────────────────────────────────────────────────────────
Preferences prefs;

struct Config {
  String siloId;
  String wifiSsid;
  String wifiPassword;
  String mqttHost;
  uint16_t mqttPort;
};

// ── Sensor setup ──────────────────────────────────────────────────────────────
OneWire oneWire(DS18B20_PIN);
DallasTemperature ds18b20(&oneWire);
SHTSensor sht31;

WiFiClientSecure wifiClient;
PubSubClient mqtt(wifiClient);

// ── Serial provisioning ───────────────────────────────────────────────────────
// Send "PROVISION" within PROVISION_TIMEOUT ms at boot to enter config mode.
// Format: KEY=VALUE\n  (keys: SILO_ID, WIFI_SSID, WIFI_PASS, MQTT_HOST, MQTT_PORT)
void runProvisioningIfRequested(Config &cfg) {
  Serial.println("[SmartVault] Send PROVISION within 10s to configure...");
  unsigned long start = millis();
  while (millis() - start < PROVISION_TIMEOUT) {
    if (Serial.available()) {
      String line = Serial.readStringUntil('\n');
      line.trim();
      if (line == "PROVISION") {
        Serial.println("[SmartVault] Provisioning mode. Enter KEY=VALUE pairs. Send DONE to save.");
        prefs.begin("sv-config", false);
        while (true) {
          while (!Serial.available()) delay(10);
          String entry = Serial.readStringUntil('\n');
          entry.trim();
          if (entry == "DONE") break;
          int sep = entry.indexOf('=');
          if (sep < 0) continue;
          String key = entry.substring(0, sep);
          String val = entry.substring(sep + 1);
          if      (key == "SILO_ID")   prefs.putString("silo_id",   val);
          else if (key == "WIFI_SSID") prefs.putString("wifi_ssid", val);
          else if (key == "WIFI_PASS") prefs.putString("wifi_pass", val);
          else if (key == "MQTT_HOST") prefs.putString("mqtt_host", val);
          else if (key == "MQTT_PORT") prefs.putUShort("mqtt_port", val.toInt());
          Serial.println("[SmartVault] Saved: " + key);
        }
        prefs.end();
        Serial.println("[SmartVault] Config saved. Rebooting...");
        delay(500);
        ESP.restart();
      }
    }
  }
}

Config loadConfig() {
  prefs.begin("sv-config", true);
  Config cfg;
  cfg.siloId      = prefs.getString("silo_id",   DEFAULT_SILO_ID);
  cfg.wifiSsid    = prefs.getString("wifi_ssid",  "");
  cfg.wifiPassword= prefs.getString("wifi_pass",  "");
  cfg.mqttHost    = prefs.getString("mqtt_host",  DEFAULT_MQTT_HOST);
  cfg.mqttPort    = prefs.getUShort("mqtt_port",  DEFAULT_MQTT_PORT);
  prefs.end();
  return cfg;
}

void connectWifi(const Config &cfg) {
  WiFi.begin(cfg.wifiSsid.c_str(), cfg.wifiPassword.c_str());
  Serial.print("[SmartVault] Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println(" connected.");
}

void connectMqtt(PubSubClient &client, const Config &cfg) {
  while (!client.connected()) {
    Serial.print("[SmartVault] Connecting to MQTT...");
    if (client.connect(cfg.siloId.c_str())) {
      Serial.println(" connected.");
    } else {
      Serial.printf(" failed (rc=%d). Retry in 5s.\n", client.state());
      delay(5000);
    }
  }
}

Config cfg;

void setup() {
  Serial.begin(115200);
  ds18b20.begin();
  sht31.init();

  runProvisioningIfRequested(cfg);
  cfg = loadConfig();

  if (cfg.wifiSsid.isEmpty()) {
    Serial.println("[SmartVault] ERROR: No WiFi credentials. Send PROVISION via serial.");
    while (true) delay(1000);
  }

  connectWifi(cfg);
  wifiClient.setInsecure(); // Replace with CA cert bundle in production
  mqtt.setServer(cfg.mqttHost.c_str(), cfg.mqttPort);
  connectMqtt(mqtt, cfg);
}

void loop() {
  if (!mqtt.connected()) connectMqtt(mqtt, cfg);
  mqtt.loop();

  ds18b20.requestTemperatures();
  float tempC    = ds18b20.getTempCByIndex(0);
  sht31.readSample();
  float humidity = sht31.getHumidity();

  StaticJsonDocument<128> doc;
  doc["silo_id"]          = cfg.siloId;
  doc["temperature_c"]    = tempC;
  doc["humidity_percent"] = humidity;

  char buf[128];
  serializeJson(doc, buf);

  String topic = "silo/" + cfg.siloId + "/telemetry";
  mqtt.publish(topic.c_str(), buf, false);
  Serial.printf("[SmartVault] Published: %s\n", buf);

  delay(PUBLISH_MS);
}
