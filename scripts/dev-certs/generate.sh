#!/usr/bin/env sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
NGINX_DIR="$ROOT/infra/nginx/certs"
MQTT_DIR="$ROOT/infra/mosquitto/certs"
MOSQUITTO_DIR="$ROOT/infra/mosquitto"

mkdir -p "$NGINX_DIR" "$MQTT_DIR"

if [ ! -f "$NGINX_DIR/server.crt" ] || [ ! -f "$NGINX_DIR/server.key" ]; then
  echo "Generating local Nginx certificate..."
  openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
    -keyout "$NGINX_DIR/server.key" \
    -out "$NGINX_DIR/server.crt" \
    -subj "/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
fi

if [ ! -f "$MQTT_DIR/ca.crt" ] || [ ! -f "$MQTT_DIR/ca.key" ]; then
  echo "Generating local MQTT certificate authority..."
  openssl genrsa -out "$MQTT_DIR/ca.key" 4096
  openssl req -x509 -new -nodes -key "$MQTT_DIR/ca.key" \
    -sha256 -days 365 -out "$MQTT_DIR/ca.crt" \
    -subj "/CN=SmartVault local MQTT CA"
fi

if [ ! -f "$MQTT_DIR/server.crt" ] || [ ! -f "$MQTT_DIR/server.key" ]; then
  echo "Generating Mosquitto server certificate..."
  openssl genrsa -out "$MQTT_DIR/server.key" 2048
  openssl req -new -key "$MQTT_DIR/server.key" -out "$MQTT_DIR/server.csr" \
    -subj "/CN=mosquitto"
  printf '%s\n' \
    'subjectAltName=DNS:mosquitto,DNS:localhost,DNS:host.docker.internal,IP:127.0.0.1' \
    'extendedKeyUsage=serverAuth' > "$MQTT_DIR/server.ext"
  openssl x509 -req -in "$MQTT_DIR/server.csr" \
    -CA "$MQTT_DIR/ca.crt" -CAkey "$MQTT_DIR/ca.key" -CAcreateserial \
    -out "$MQTT_DIR/server.crt" -days 365 -sha256 -extfile "$MQTT_DIR/server.ext"
fi

if [ ! -f "$MQTT_DIR/bridge.crt" ] || [ ! -f "$MQTT_DIR/bridge.key" ]; then
  echo "Generating MQTT bridge client certificate..."
  openssl genrsa -out "$MQTT_DIR/bridge.key" 2048
  openssl req -new -key "$MQTT_DIR/bridge.key" -out "$MQTT_DIR/bridge.csr" \
    -subj "/CN=bridge"
  printf '%s\n' 'extendedKeyUsage=clientAuth' > "$MQTT_DIR/bridge.ext"
  openssl x509 -req -in "$MQTT_DIR/bridge.csr" \
    -CA "$MQTT_DIR/ca.crt" -CAkey "$MQTT_DIR/ca.key" -CAcreateserial \
    -out "$MQTT_DIR/bridge.crt" -days 365 -sha256 -extfile "$MQTT_DIR/bridge.ext"
fi

if [ ! -f "$MOSQUITTO_DIR/passwd" ]; then
  echo "Generating local Mosquitto password file..."
  docker run --rm \
    -v "$MOSQUITTO_DIR:/mosquitto/config" \
    eclipse-mosquitto:2 \
    mosquitto_passwd -c -b /mosquitto/config/passwd bridge bridge-local
fi

rm -f "$MQTT_DIR"/*.csr "$MQTT_DIR"/*.ext "$MQTT_DIR"/*.srl
chmod 600 "$NGINX_DIR/server.key" "$MQTT_DIR"/*.key
chmod 644 "$MQTT_DIR/server.key" "$MQTT_DIR/bridge.key"
chmod 644 "$MOSQUITTO_DIR/passwd"

echo "Local certificates are ready. Start the stack with:"
echo "  docker compose up --build"
echo "Open https://localhost and accept the local certificate warning."#!/usr/bin/env sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
NGINX_DIR="$ROOT/infra/nginx/certs"
MQTT_DIR="$ROOT/infra/mosquitto/certs"
MOSQUITTO_DIR="$ROOT/infra/mosquitto"

mkdir -p "$NGINX_DIR" "$MQTT_DIR"

if [ ! -f "$NGINX_DIR/server.crt" ] || [ ! -f "$NGINX_DIR/server.key" ]; then
  echo "Generating local Nginx certificate..."
  openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
    -keyout "$NGINX_DIR/server.key" \
    -out "$NGINX_DIR/server.crt" \
    -subj "/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
fi

if [ ! -f "$MQTT_DIR/ca.crt" ] || [ ! -f "$MQTT_DIR/ca.key" ]; then
  echo "Generating local MQTT certificate authority..."
  openssl genrsa -out "$MQTT_DIR/ca.key" 4096
  openssl req -x509 -new -nodes -key "$MQTT_DIR/ca.key" \
    -sha256 -days 365 -out "$MQTT_DIR/ca.crt" \
    -subj "/CN=SmartVault local MQTT CA"
fi

if [ ! -f "$MQTT_DIR/server.crt" ] || [ ! -f "$MQTT_DIR/server.key" ]; then
  echo "Generating Mosquitto server certificate..."
  openssl genrsa -out "$MQTT_DIR/server.key" 2048
  openssl req -new -key "$MQTT_DIR/server.key" -out "$MQTT_DIR/server.csr" \
    -subj "/CN=mosquitto"
  printf '%s\n' \
    'subjectAltName=DNS:mosquitto,DNS:localhost,IP:127.0.0.1' \
    'extendedKeyUsage=serverAuth' > "$MQTT_DIR/server.ext"
  openssl x509 -req -in "$MQTT_DIR/server.csr" \
    -CA "$MQTT_DIR/ca.crt" -CAkey "$MQTT_DIR/ca.key" -CAcreateserial \
    -out "$MQTT_DIR/server.crt" -days 365 -sha256 -extfile "$MQTT_DIR/server.ext"
fi

if [ ! -f "$MQTT_DIR/bridge.crt" ] || [ ! -f "$MQTT_DIR/bridge.key" ]; then
  echo "Generating MQTT bridge client certificate..."
  openssl genrsa -out "$MQTT_DIR/bridge.key" 2048
  openssl req -new -key "$MQTT_DIR/bridge.key" -out "$MQTT_DIR/bridge.csr" \
    -subj "/CN=bridge"
  printf '%s\n' 'extendedKeyUsage=clientAuth' > "$MQTT_DIR/bridge.ext"
  openssl x509 -req -in "$MQTT_DIR/bridge.csr" \
    -CA "$MQTT_DIR/ca.crt" -CAkey "$MQTT_DIR/ca.key" -CAcreateserial \
    -out "$MQTT_DIR/bridge.crt" -days 365 -sha256 -extfile "$MQTT_DIR/bridge.ext"
fi

if [ ! -f "$MOSQUITTO_DIR/passwd" ]; then
  echo "Generating local Mosquitto password file..."
  docker run --rm \
    -v "$MOSQUITTO_DIR:/mosquitto/config" \
    eclipse-mosquitto:2 \
    mosquitto_passwd -c -b /mosquitto/config/passwd bridge bridge-local
fi

rm -f "$MQTT_DIR"/*.csr "$MQTT_DIR"/*.ext "$MQTT_DIR"/*.srl
chmod 600 "$NGINX_DIR/server.key" "$MQTT_DIR"/*.key

echo "Local certificates are ready. Start the stack with:"
echo "  docker compose up --build"
echo "Open https://localhost and accept the local certificate warning."
