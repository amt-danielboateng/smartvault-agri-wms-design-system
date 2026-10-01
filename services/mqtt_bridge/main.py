"""
MQTT → Celery bridge.
Subscribes to silo/+/telemetry and enqueues sensor readings for persistence.
"""
import json
import os
import ssl
import paho.mqtt.client as mqtt
from celery import Celery

MQTT_HOST = os.getenv("MQTT_HOST", "mosquitto")
MQTT_PORT = int(os.getenv("MQTT_PORT", 8883))
MQTT_USE_TLS = os.getenv("MQTT_USE_TLS", "true").lower() == "true"
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

celery_app = Celery("mqtt_bridge", broker=REDIS_URL)


@celery_app.task(name="apps.telemetry.tasks.persist_reading")
def persist_reading(payload: dict):
    pass  # Implemented in backend telemetry app


def on_connect(client, userdata, flags, rc):
    print(f"MQTT connected (rc={rc})")
    client.subscribe("silo/+/telemetry", qos=1)


def on_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode())
        topic_parts = msg.topic.split("/")
        payload["silo_id"] = topic_parts[1]
        persist_reading.delay(payload)
    except (json.JSONDecodeError, IndexError) as e:
        print(f"Bad message on {msg.topic}: {e}")


def main():
    client = mqtt.Client()
    if MQTT_USE_TLS:
        client.tls_set(cert_reqs=ssl.CERT_REQUIRED, tls_version=ssl.PROTOCOL_TLS)
    client.on_connect = on_connect
    client.on_message = on_message
    client.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
    client.loop_forever()


if __name__ == "__main__":
    main()
