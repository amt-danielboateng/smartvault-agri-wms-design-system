"""ESP32 MicroPython firmware — SHT31 + MQTTS telemetry publisher."""
import json
import time
import network
import ssl
from machine import I2C, Pin
import umqtt.simple as mqtt

SILO_ID = "silo-001"
WIFI_SSID = "YOUR_SSID"
WIFI_PASSWORD = "YOUR_PASSWORD"
MQTT_HOST = "your-broker.example.com"
MQTT_PORT = 8883
TOPIC = f"silo/{SILO_ID}/telemetry"
INTERVAL_S = 30

# SHT31 I2C address
SHT31_ADDR = 0x44


def read_sht31(i2c):
    i2c.writeto(SHT31_ADDR, b"\x2c\x06")
    time.sleep_ms(50)
    data = i2c.readfrom(SHT31_ADDR, 6)
    temp_c = -45 + 175 * (data[0] << 8 | data[1]) / 65535
    humidity = 100 * (data[3] << 8 | data[4]) / 65535
    return round(temp_c, 2), round(humidity, 2)


def connect_wifi():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    wlan.connect(WIFI_SSID, WIFI_PASSWORD)
    while not wlan.isconnected():
        time.sleep(0.5)


def main():
    connect_wifi()
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ctx.verify_mode = ssl.CERT_NONE  # Replace with CA cert in production
    client = mqtt.MQTTClient(SILO_ID, MQTT_HOST, port=MQTT_PORT, ssl=ctx)
    client.connect()

    i2c = I2C(0, scl=Pin(22), sda=Pin(21))

    while True:
        temp_c, humidity = read_sht31(i2c)
        payload = json.dumps({"silo_id": SILO_ID, "temperature_c": temp_c, "humidity_percent": humidity})
        client.publish(TOPIC, payload)
        time.sleep(INTERVAL_S)


main()
