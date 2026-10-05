#!/usr/bin/env sh
# =============================================================================
# SmartVault Agri-WMS — Production MQTT & HTTPS Certificate Generator
# =============================================================================
#
# Uses Let's Encrypt (via certbot + certbot-dns-duckdns) to obtain a publicly
# trusted TLS certificate for both Nginx (HTTPS) and Mosquitto (MQTTS).
#
# PREREQUISITES (run once on your Linux server):
#   sudo apt update && sudo apt install -y certbot python3-pip
#   sudo pip3 install certbot-dns-duckdns
#
# USAGE:
#   export DUCKDNS_TOKEN="your-duckdns-token-here"
#   export DUCKDNS_DOMAIN="your-subdomain"   # just the subdomain, e.g. "smartvault-wms"
#   sudo -E sh scripts/prod-certs/generate.sh
#
# The FQDN will be: <DUCKDNS_DOMAIN>.duckdns.org
# =============================================================================
set -eu

# ---------------------------------------------------------------------------
# Validate required environment variables
# ---------------------------------------------------------------------------
if [ -z "${DUCKDNS_TOKEN:-}" ]; then
  echo "ERROR: DUCKDNS_TOKEN is not set."
  echo "  export DUCKDNS_TOKEN=\"your-duckdns-token-here\""
  exit 1
fi

if [ -z "${DUCKDNS_DOMAIN:-}" ]; then
  echo "ERROR: DUCKDNS_DOMAIN is not set."
  echo "  export DUCKDNS_DOMAIN=\"your-subdomain\"  # e.g. smartvault-wms"
  exit 1
fi

FQDN="${DUCKDNS_DOMAIN}.duckdns.org"
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)

NGINX_CERT_DIR="$ROOT/infra/nginx/certs"
MQTT_CERT_DIR="$ROOT/infra/mosquitto/certs"
MOSQUITTO_DIR="$ROOT/infra/mosquitto"
DUCKDNS_CONF_DIR="/etc/letsencrypt/duckdns"
DUCKDNS_CONF="$DUCKDNS_CONF_DIR/credentials.ini"
LE_LIVE="/etc/letsencrypt/live/$FQDN"

mkdir -p "$NGINX_CERT_DIR" "$MQTT_CERT_DIR" "$DUCKDNS_CONF_DIR"

echo "==> Domain: $FQDN"

# ---------------------------------------------------------------------------
# Write DuckDNS credentials for the certbot plugin
# ---------------------------------------------------------------------------
echo "==> Writing DuckDNS credentials..."
cat > "$DUCKDNS_CONF" <<EOF
dns_duckdns_token = ${DUCKDNS_TOKEN}
EOF
chmod 600 "$DUCKDNS_CONF"

# ---------------------------------------------------------------------------
# Obtain / renew Let's Encrypt certificate via DNS-01 challenge
# ---------------------------------------------------------------------------
if [ ! -f "$LE_LIVE/fullchain.pem" ]; then
  echo "==> Requesting Let's Encrypt certificate for $FQDN ..."
  certbot certonly \
    --authenticator dns-duckdns \
    --dns-duckdns-credentials "$DUCKDNS_CONF" \
    --dns-duckdns-propagation-seconds 60 \
    --non-interactive \
    --agree-tos \
    --register-unsafely-without-email \
    -d "$FQDN"
else
  echo "==> Certificate already exists. Attempting renewal if needed..."
  certbot renew \
    --authenticator dns-duckdns \
    --dns-duckdns-credentials "$DUCKDNS_CONF" \
    --dns-duckdns-propagation-seconds 60 \
    --non-interactive \
    --quiet \
    --cert-name "$FQDN"
fi

# ---------------------------------------------------------------------------
# Copy Let's Encrypt certs into Nginx and Mosquitto cert directories
# ---------------------------------------------------------------------------
echo "==> Copying certs into infra directories..."

# Nginx: needs fullchain (cert + intermediates) and private key
cp "$LE_LIVE/fullchain.pem"  "$NGINX_CERT_DIR/server.crt"
cp "$LE_LIVE/privkey.pem"    "$NGINX_CERT_DIR/server.key"

# Mosquitto server: same cert. The chain.pem (intermediates only) is used as cafile
# so Mosquitto can present the full chain to clients for public-CA validation.
cp "$LE_LIVE/fullchain.pem"  "$MQTT_CERT_DIR/server.crt"
cp "$LE_LIVE/privkey.pem"    "$MQTT_CERT_DIR/server.key"
cp "$LE_LIVE/chain.pem"      "$MQTT_CERT_DIR/ca.crt"

# ---------------------------------------------------------------------------
# Generate a private CA for internal bridge client certificate (mTLS)
# ---------------------------------------------------------------------------
# The Let's Encrypt cert covers the server identity (port 8883).
# For the internal mqtt_bridge service that connects as a client, we still
# use a lightweight private CA — but this is internal only and never exposed
# to public clients. Public clients authenticate with username/password.
# ---------------------------------------------------------------------------

if [ ! -f "$MQTT_CERT_DIR/internal-ca.crt" ]; then
  echo "==> Generating internal CA for bridge client certificate..."
  openssl genrsa -out "$MQTT_CERT_DIR/internal-ca.key" 4096
  openssl req -x509 -new -nodes \
    -key "$MQTT_CERT_DIR/internal-ca.key" \
    -sha256 -days 3650 \
    -out "$MQTT_CERT_DIR/internal-ca.crt" \
    -subj "/O=SmartVault/CN=SmartVault Internal MQTT CA"
fi

if [ ! -f "$MQTT_CERT_DIR/bridge.crt" ]; then
  echo "==> Generating MQTT bridge client certificate..."
  openssl genrsa -out "$MQTT_CERT_DIR/bridge.key" 2048
  openssl req -new \
    -key "$MQTT_CERT_DIR/bridge.key" \
    -out "$MQTT_CERT_DIR/bridge.csr" \
    -subj "/O=SmartVault/CN=mqtt-bridge"
  printf '%s\n' 'extendedKeyUsage=clientAuth' > "$MQTT_CERT_DIR/bridge.ext"
  openssl x509 -req \
    -in "$MQTT_CERT_DIR/bridge.csr" \
    -CA "$MQTT_CERT_DIR/internal-ca.crt" \
    -CAkey "$MQTT_CERT_DIR/internal-ca.key" \
    -CAcreateserial \
    -out "$MQTT_CERT_DIR/bridge.crt" \
    -days 365 -sha256 \
    -extfile "$MQTT_CERT_DIR/bridge.ext"
fi

# ---------------------------------------------------------------------------
# Generate Mosquitto password file for public clients (username/password auth)
# ---------------------------------------------------------------------------
if [ ! -f "$MOSQUITTO_DIR/passwd" ]; then
  echo "==> Creating Mosquitto password file..."
  # Add the bridge service account
  docker run --rm \
    -v "$MOSQUITTO_DIR:/mosquitto/config" \
    eclipse-mosquitto:2 \
    mosquitto_passwd -c -b /mosquitto/config/passwd bridge bridge-secret

  echo ""
  echo "  To add more users (e.g. IoT devices), run:"
  echo "    docker run --rm -v \$MOSQUITTO_DIR:/mosquitto/config eclipse-mosquitto:2 \\"
  echo "      mosquitto_passwd -b /mosquitto/config/passwd <username> <password>"
fi

# ---------------------------------------------------------------------------
# Set up automatic renewal via cron
# ---------------------------------------------------------------------------
CRON_JOB="0 3 * * * DUCKDNS_TOKEN=${DUCKDNS_TOKEN} DUCKDNS_DOMAIN=${DUCKDNS_DOMAIN} sh $ROOT/scripts/prod-certs/generate.sh >> /var/log/smartvault-cert-renew.log 2>&1"
EXISTING=$(crontab -l 2>/dev/null || true)

if ! echo "$EXISTING" | grep -qF "prod-certs/generate.sh"; then
  echo "==> Installing renewal cron job (runs daily at 03:00)..."
  (echo "$EXISTING"; echo "$CRON_JOB") | crontab -
else
  echo "==> Renewal cron job already installed."
fi

# ---------------------------------------------------------------------------
# Cleanup temp files and lock down permissions
# ---------------------------------------------------------------------------
rm -f "$MQTT_CERT_DIR"/*.csr "$MQTT_CERT_DIR"/*.ext "$MQTT_CERT_DIR"/*.srl

chmod 600 "$NGINX_CERT_DIR/server.key"
chmod 644 "$NGINX_CERT_DIR/server.crt"
chmod 600 "$MQTT_CERT_DIR/server.key" "$MQTT_CERT_DIR/internal-ca.key"
chmod 644 "$MQTT_CERT_DIR/server.crt" "$MQTT_CERT_DIR/ca.crt" "$MQTT_CERT_DIR/internal-ca.crt"
# bridge.key must be readable by the mqtt_bridge Docker container (runs as non-root)
chmod 640 "$MQTT_CERT_DIR/bridge.key"
chmod 644 "$MQTT_CERT_DIR/bridge.crt"
chmod 644 "$MOSQUITTO_DIR/passwd"

echo ""
echo "==> Production certificates are ready."
echo ""
echo "  FQDN      : $FQDN"
echo "  Nginx cert : $NGINX_CERT_DIR/server.crt"
echo "  MQTT cert  : $MQTT_CERT_DIR/server.crt"
echo "  Bridge cert: $MQTT_CERT_DIR/bridge.crt"
echo ""
echo "Next steps:"
echo "  1. Copy infra/mosquitto/mosquitto.prod.conf -> mosquitto.conf on your server"
echo "     (or use MOSQUITTO_CONF env var in docker-compose.prod.yml)"
echo "  2. Update .env: set DUCKDNS_DOMAIN=$DUCKDNS_DOMAIN"
echo "  3. Start the stack: docker compose -f docker-compose.prod.yml up -d"
