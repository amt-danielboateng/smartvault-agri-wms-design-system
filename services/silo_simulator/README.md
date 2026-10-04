# Silo Sensor Simulator

A standalone Python simulator that publishes realistic MQTT sensor telemetry
mimicking IoT nodes deployed inside grain silos across Ghana's agricultural belts.

## What it tests

```
  simulator  →  Mosquitto (port 8883)  →  mqtt_bridge  →  Celery  →  TimescaleDB
                                                       ↓
                                          check_spoilage_thresholds
                                                       ↓
                                          SMS alert (Africa's Talking)
                                                       ↓
                                          GET /api/telemetry/readings/
```

---

## Setup

```bash
cd services/silo_simulator
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
```

---

## Configuration

The simulator reads from your project's root `.env`. When run from the host,
override `MQTT_HOST` because the Docker-only hostname `mosquitto` is not
resolvable outside Docker. The supported configuration values are:

| Variable | Default | Description |
|----------|---------|-------------|
| `MQTT_HOST` | `localhost` | Mosquitto broker host |
| `MQTT_PORT` | `1883` | Broker port (1883 = plain, 8883 = TLS) |
| `MQTT_USERNAME` | _(empty)_ | Broker username (from `infra/mosquitto/passwd`) |
| `MQTT_PASSWORD` | _(empty)_ | Broker password |
| `MQTT_USE_TLS` | `false` | Set `true` to use mTLS (port 8883) |
| `MQTT_CA_CERT` | _(empty)_ | Path to CA cert (TLS mode only) |
| `MQTT_CLIENT_CERT` | _(empty)_ | Path to client cert (TLS mode only) |
| `MQTT_CLIENT_KEY` | _(empty)_ | Path to client key (TLS mode only) |
| `PUBLISH_INTERVAL_SECONDS` | `30` | How often each silo publishes |

---

## Usage

```bash
# Host-based local test using the plain MQTT listener
MQTT_HOST=localhost MQTT_PORT=1883 MQTT_USE_TLS=false \
MQTT_USERNAME=bridge MQTT_PASSWORD=bridge-local python simulator.py

# Faster ticks for rapid testing
python simulator.py --interval 5

# Start with one silo in CRITICAL (triggers spoilage alert)
python simulator.py --scenario CRITICAL:SILO-KMS-01

# Multiple overrides
python simulator.py --scenario WARNING:SILO-SUY-01,SILENT:SILO-TAM-01,CRITICAL:SILO-KMS-02
```

---

## Silo Fleet

| Silo ID | Warehouse | Commodity |
|---------|-----------|-----------|
| `SILO-KMS-01` | Kumasi Central Grain Store | Maize (White Dent) |
| `SILO-KMS-02` | Kumasi Central Grain Store | Soya Bean |
| `SILO-SUY-01` | Sunyani Aggregation Hub | Cowpea |
| `SILO-TAM-01` | Tamale Northern Silo | Paddy Rice |
| `SILO-TEK-01` | Techiman Commodity Center | Maize (White Dent) |

---

## Scenarios

| Scenario | What it simulates | Thresholds |
|----------|------------------|------------|
| `NORMAL` | Healthy grain, good aeration | No breach |
| `WARNING` | Aeration degrading, readings creep toward limits | Approaching (28–30 °C / 70–74 %) |
| `CRITICAL` | Active spoilage risk — aeration failed | **Breach** (> 30 °C / > 75 %) → triggers Celery alert |
| `RECOVERING` | Aeration restored, values drifting down | Slowly back below threshold |
| `SILENT` | Sensor stops publishing entirely | Tests `scan_all_silos_for_spoilage` beat task |

---

## Hot-Reload (Change Scenarios Without Restarting)

Edit `scenarios.json` while the simulator is running:

```json
{
  "SILO-KMS-01": "CRITICAL",
  "SILO-KMS-02": "WARNING",
  "SILO-SUY-01": "NORMAL",
  "SILO-TAM-01": "SILENT",
  "SILO-TEK-01": "RECOVERING"
}
```

The simulator re-reads this file at the start of every publish cycle.
Changes take effect on the next tick — no restart needed.

---

## Recommended Test Scenarios

### 1. Baseline health check
Start all silos in `NORMAL`. Open `GET /api/telemetry/readings/` and confirm
readings arrive. The frontend telemetry screen refreshes live readings every
60 seconds.

### 2. Spoilage alert pipeline
Set `SILO-TAM-01` to `CRITICAL`. Within one publish interval:
- A `SiloSensorReading` row appears in TimescaleDB.
- Celery fires `check_spoilage_thresholds`.
- If `WAREHOUSE_MANAGER_PHONE` is set in `.env`, an SMS is dispatched.
- Check Celery worker logs: `docker compose logs -f celery`

### 3. Silent sensor detection
Set `SILO-KMS-02` to `SILENT`. Wait for the Celery beat task
`scan_all_silos_for_spoilage` to run (every 15 minutes). It should log
a warning about the stale silo.

### 4. Day/night temperature cycle
Run with `--interval 5` and leave all silos in `NORMAL` for a few minutes.
Watch temperatures rise and fall on the telemetry screen — they follow a
realistic sinusoidal cycle (peak ~14:00 local, trough ~04:00 local).

### 5. Recovery after incident
1. Set a silo to `CRITICAL` → confirm alert fires.
2. Switch to `RECOVERING` → watch readings slowly drop below thresholds.
3. Switch to `NORMAL` → readings stabilise on the natural cycle.
