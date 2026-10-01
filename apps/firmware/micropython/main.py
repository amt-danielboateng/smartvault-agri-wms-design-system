"""
ESP32 MicroPython firmware — SHT31 + MQTTS telemetry publisher.
Config is read from /config.json on the device filesystem.
Send PROVISION via serial within 5 seconds at boot to reconfigure.
"""
import json
import time
import network
import ssl
import sys
import os
from machine import I2C, Pin
import umqtt.simple as mqtt

# ── Defaults ──────────────────────────────────────────────────────────────────
DEFAULTS = {
    "silo_id":       "silo-001",
    "wifi_ssid":     "",
    "wifi_password": "",
    "mqtt_host":     "mosquitto",
    "mqtt_port":     8883,
    "interval_s":    30,
}

CONFIG_PATH = "/config.json"
SHT31_ADDR  = 0x44


# ── Config helpers ────────────────────────────────────────────────────────────
def load_config() -> dict:
    try:
        with open(CONFIG_PATH) as f:
            stored = json.load(f)
        cfg = {**DEFAULTS, **stored}
    except (OSError, ValueError):
        cfg = dict(DEFAULTS)
    return cfg


def save_config(cfg: dict):
    with open(CONFIG_PATH, "w") as f:
        json.dump(cfg, f)


def run_provisioning():
    """Interactive serial provisioning — enter KEY=VALUE pairs, then DONE."""
    print("[SmartVault] Provisioning mode. Enter KEY=VALUE pairs. Type DONE to save & reboot.")
    cfg = load_config()
    while True:
        line = sys.stdin.readline().strip()
        if line == "DONE":
            break
        if "=" in line:
            key, _, val = line.partition("=")
            key = key.strip()
            val = val.strip()
            if key in cfg:
                # Preserve int types
                cfg[key] = int(val) if isinstance(cfg[key], int) else val
                print(f"[SmartVault] Set {key} = {val}")
            else:
                print(f"[SmartVault] Unknown key: {key}")
    save_config(cfg)
    print("[SmartVault] Config saved. Rebooting...")
    time.sleep(1)
    import machine
    machine.reset()


def check_provision_request():
    """Wait 5 seconds at boot for a PROVISION command over serial."""
    print("[SmartVault] Send PROVISION within 5s to configure...")
    deadline = time.ticks_add(time.ticks_ms(), 5000)
    while time.ticks_diff(deadline, time.ticks_ms()) > 0:
        if sys.stdin in [sys.stdin]:  # non-blocking check
            try:
                # Poll for input without blocking
                import select
                r, _, _ = select.select([sys.stdin], [], [], 0.1)
                if r:
                    line = sys.stdin.readline().strip()
                    if line == "PROVISION":
                        run_provisioning()
                        return
            except Exception:
                time.sleep(0.1)


# ── Sensor ────────────────────────────────────────────────────────────────────
def read_sht31(i2c: I2C) -> tuple:
    i2c.writeto(SHT31_ADDR, b"\x2c\x06")
    time.sleep_ms(50)
    data = i2c.readfrom(SHT31_ADDR, 6)
    temp_c   = -45 + 175 * (data[0] << 8 | data[1]) / 65535
    humidity = 100 * (data[3] << 8 | data[4]) / 65535
    return round(temp_c, 2), round(humidity, 2)


# ── Network ───────────────────────────────────────────────────────────────────
def connect_wifi(ssid: str, password: str):
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    if not wlan.isconnected():
        wlan.connect(ssid, password)
        print("[SmartVault] Connecting to WiFi", end="")
        while not wlan.isconnected():
            print(".", end="")
            time.sleep(0.5)
    print(f" connected. IP: {wlan.ifconfig()[0]}")


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    check_provision_request()
    cfg = load_config()

    if not cfg["wifi_ssid"]:
        print("[SmartVault] ERROR: No WiFi credentials. Send PROVISION via serial.")
        return

    connect_wifi(cfg["wifi_ssid"], cfg["wifi_password"])

    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ctx.verify_mode = ssl.CERT_NONE  # Replace with CA cert in production

    client = mqtt.MQTTClient(
        cfg["silo_id"], cfg["mqtt_host"],
        port=cfg["mqtt_port"], ssl=ctx,
    )
    client.connect()
    print(f"[SmartVault] MQTT connected to {cfg['mqtt_host']}:{cfg['mqtt_port']}")

    i2c   = I2C(0, scl=Pin(22), sda=Pin(21))
    topic = f"silo/{cfg['silo_id']}/telemetry"

    while True:
        try:
            temp_c, humidity = read_sht31(i2c)
            payload = json.dumps({
                "silo_id":          cfg["silo_id"],
                "temperature_c":    temp_c,
                "humidity_percent": humidity,
            })
            client.publish(topic, payload)
            print(f"[SmartVault] Published: {payload}")
        except Exception as e:
            print(f"[SmartVault] Error: {e} — reconnecting...")
            try:
                client.connect()
            except Exception:
                connect_wifi(cfg["wifi_ssid"], cfg["wifi_password"])

        time.sleep(cfg["interval_s"])


main()
