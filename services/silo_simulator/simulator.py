#!/usr/bin/env python3
"""
SmartVault Agri-WMS — Silo Sensor Simulator
============================================
Publishes realistic MQTT telemetry mimicking IoT nodes inside grain silos
across Ghana's agricultural belts.

Data pipeline exercised:
    simulator  ->  Mosquitto (MQTT)  ->  mqtt_bridge  ->  Celery  ->  TimescaleDB
                                                       |
                                          check_spoilage_thresholds
                                                       |
                                            SMS alert (Africa's Talking)

Topic pattern : silo/{silo_id}/telemetry
Payload       : {"temperature_c": float, "humidity_percent": float}
Broker port   : 1883  (username/password, no TLS — dev default)
             or 8883  (mTLS — set MQTT_USE_TLS=true)

Usage:
    python simulator.py
    python simulator.py --interval 5
    python simulator.py --scenario CRITICAL:SILO-KMS-01
    python simulator.py --scenario WARNING:SILO-SUY-01,SILENT:SILO-TAM-01

Scenario hot-reload:
    Edit  services/silo_simulator/scenarios.json  while the simulator is
    running. Changes take effect on the next publish cycle — no restart needed.
"""

import argparse
import json
import math
import os
import random
import signal
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Optional

import paho.mqtt.client as mqtt
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------
# Resolve .env from the project root (two levels up from services/silo_simulator/)
_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(dotenv_path=_ENV_PATH, override=False)

SCENARIOS_FILE = Path(__file__).parent / "scenarios.json"

# ---------------------------------------------------------------------------
# MQTT Configuration
# ---------------------------------------------------------------------------
MQTT_HOST        = os.getenv("MQTT_HOST", "localhost")
MQTT_PORT        = int(os.getenv("MQTT_PORT", "1883"))
MQTT_USERNAME    = os.getenv("MQTT_USERNAME", "")
MQTT_PASSWORD    = os.getenv("MQTT_PASSWORD", "")
MQTT_USE_TLS     = os.getenv("MQTT_USE_TLS", "false").lower() == "true"
MQTT_CA_CERT     = os.getenv("MQTT_CA_CERT", "")
MQTT_CLIENT_CERT = os.getenv("MQTT_CLIENT_CERT", "")
MQTT_CLIENT_KEY  = os.getenv("MQTT_CLIENT_KEY", "")

PUBLISH_INTERVAL = int(os.getenv("PUBLISH_INTERVAL_SECONDS", "30"))

# Spoilage thresholds — must stay in sync with backend/apps/telemetry/tasks.py
SPOILAGE_TEMP_C = 30.0
SPOILAGE_RH_PCT = 75.0


# ===========================================================================
# STATE MACHINE
# ===========================================================================

class Scenario(Enum):
    NORMAL     = "NORMAL"
    WARNING    = "WARNING"
    CRITICAL   = "CRITICAL"
    RECOVERING = "RECOVERING"
    SILENT     = "SILENT"


SCENARIO_ICONS = {
    Scenario.NORMAL:     "🟢",
    Scenario.WARNING:    "🟡",
    Scenario.CRITICAL:   "🔴",
    Scenario.RECOVERING: "🔵",
    Scenario.SILENT:     "⚫",
}


# ===========================================================================
# SILO DATA MODEL
# ===========================================================================

@dataclass
class Silo:
    """
    Represents one physical sensor node inside a grain silo.

    silo_id     -- Unique ID; becomes the MQTT topic segment.
    warehouse   -- Facility name (display only).
    commodity   -- Stored crop (display only).
    base_temp_c -- Expected internal temperature under healthy conditions.
    base_rh_pct -- Expected relative humidity under healthy conditions.
    temp_offset -- Per-silo structural variation (+/- insulation quality).
    scenario    -- Active simulation mode (hot-reloadable).
    """
    silo_id:     str
    warehouse:   str
    commodity:   str
    base_temp_c: float
    base_rh_pct: float
    temp_offset: float
    scenario:    Scenario = Scenario.NORMAL

    current_temp:   float          = field(init=False)
    current_rh:     float          = field(init=False)
    last_published: Optional[datetime] = field(init=False, default=None)
    alert_count:    int            = field(init=False, default=0)

    def __post_init__(self):
        self.current_temp = self.base_temp_c + self.temp_offset
        self.current_rh   = self.base_rh_pct


# ===========================================================================
# SILO FLEET
# ===========================================================================

FLEET: list[Silo] = [
    Silo(
        silo_id="SILO-KMS-01", warehouse="Kumasi Central Grain Store",
        commodity="Maize (White Dent)",
        base_temp_c=27.0, base_rh_pct=63.0, temp_offset=0.5,
    ),
    Silo(
        silo_id="SILO-KMS-02", warehouse="Kumasi Central Grain Store",
        commodity="Soya Bean",
        base_temp_c=27.0, base_rh_pct=62.0, temp_offset=-0.3,
    ),
    Silo(
        silo_id="SILO-SUY-01", warehouse="Sunyani Aggregation Hub",
        commodity="Cowpea",
        base_temp_c=26.5, base_rh_pct=66.0, temp_offset=1.2,
    ),
    Silo(
        silo_id="SILO-TAM-01", warehouse="Tamale Northern Silo",
        commodity="Paddy Rice",
        base_temp_c=29.0, base_rh_pct=68.0, temp_offset=0.8,
    ),
    Silo(
        silo_id="SILO-TEK-01", warehouse="Techiman Commodity Center",
        commodity="Maize (White Dent)",
        base_temp_c=27.5, base_rh_pct=64.0, temp_offset=-0.5,
    ),
]


# ===========================================================================
# PHYSICS MODEL
# ===========================================================================

def _ambient_temp_c(now: datetime) -> float:
    """
    Sinusoidal daily ambient temperature for Ghana's agricultural belts.

    Midpoint : 28 C
    Amplitude: +/- 6 C  ->  range 22-34 C
    Peak     : 14:00 local time
    Trough   : 04:00 local time

    Phase derivation:
        We want sin(2*pi*(hour - phase)/24) = 1 when hour = 14
        => (14 - phase)/24 = 1/4  =>  phase = 8
    """
    hour  = now.hour + now.minute / 60.0
    angle = 2 * math.pi * (hour - 8.0) / 24.0
    return 28.0 + 6.0 * math.sin(angle)


def _ambient_rh_pct(temp_c: float) -> float:
    """
    Relative humidity inversely correlated with temperature (psychrometric).
    Baseline: 70% RH at 28 C.  Coefficient: -1.5% RH per degree C above 28.
    Clamped to [40%, 95%].
    """
    return max(40.0, min(95.0, 70.0 - 1.5 * (temp_c - 28.0)))


def compute_reading(
    silo: Silo, now: datetime
) -> tuple[Optional[float], Optional[float]]:
    """
    Compute the next (temperature_c, humidity_pct) for a silo and update its
    internal state. Returns (None, None) when the silo is SILENT.

    Algorithm:
      1. Derive the natural ambient cycle value for the current time.
      2. Apply a 3-hour thermal lag (grain mass slows temperature response).
      3. Apply scenario-specific pressure to nudge the target.
      4. Smooth-step the current reading 20% toward the target per tick —
         avoids step changes that look fake on the telemetry dashboard.
      5. Add Gaussian sensor noise (sigma = 0.15 C / 0.30% RH).
    """
    if silo.scenario == Scenario.SILENT:
        return None, None

    # Natural cycle with 3-hour thermal lag
    lag_hour  = (now.hour - 3) % 24
    lagged    = now.replace(hour=lag_hour)
    natural_t = _ambient_temp_c(lagged) + silo.temp_offset
    natural_h = _ambient_rh_pct(natural_t) + (silo.base_rh_pct - 70.0)

    # Scenario target values
    if silo.scenario == Scenario.NORMAL:
        target_t = natural_t
        target_h = natural_h

    elif silo.scenario == Scenario.WARNING:
        # Aeration degrading — drift toward thresholds but stay below
        target_t = max(natural_t, 28.5 + random.uniform(-0.4, 0.4))
        target_h = max(natural_h, 71.5 + random.uniform(-0.8, 0.8))

    elif silo.scenario == Scenario.CRITICAL:
        # Active spoilage risk — sustained breach triggers Celery alert
        target_t = SPOILAGE_TEMP_C + random.uniform(0.5, 4.0)
        target_h = SPOILAGE_RH_PCT + random.uniform(1.0, 9.0)

    else:  # RECOVERING
        # Aeration restored — readings drift slowly back to normal
        target_t = max(natural_t, silo.current_temp - 0.4)
        target_h = max(natural_h, silo.current_rh   - 0.6)

    # Smoothed step (20% convergence) + Gaussian sensor noise
    ALPHA = 0.20
    new_t = silo.current_temp + ALPHA * (target_t - silo.current_temp) + random.gauss(0, 0.15)
    new_h = silo.current_rh   + ALPHA * (target_h - silo.current_rh  ) + random.gauss(0, 0.30)

    # Physical plausibility clamp
    new_t = round(max(18.0, min(45.0, new_t)), 1)
    new_h = round(max(30.0, min(98.0, new_h)), 1)

    silo.current_temp = new_t
    silo.current_rh   = new_h
    return new_t, new_h


# ===========================================================================
# SCENARIO HOT-RELOAD
# ===========================================================================

def load_scenario_overrides(fleet: list[Silo]) -> None:
    """
    Re-read scenarios.json and update fleet scenarios in place.
    Called at the top of every publish cycle.

    File format:
        {
          "SILO-KMS-01": "CRITICAL",
          "SILO-TAM-01": "SILENT"
        }
    """
    if not SCENARIOS_FILE.exists():
        return
    try:
        overrides: dict = json.loads(SCENARIOS_FILE.read_text(encoding="utf-8"))
        silo_map = {s.silo_id: s for s in fleet}
        for silo_id, scenario_str in overrides.items():
            silo = silo_map.get(silo_id.upper())
            if silo:
                try:
                    silo.scenario = Scenario(scenario_str.strip().upper())
                except ValueError:
                    pass
    except (json.JSONDecodeError, OSError):
        pass


# ===========================================================================
# CONSOLE DASHBOARD
# ===========================================================================

_RESET  = "\033[0m"
_BOLD   = "\033[1m"
_DIM    = "\033[2m"
_RED    = "\033[91m"
_YELLOW = "\033[93m"
_GREEN  = "\033[92m"
_CYAN   = "\033[96m"


def _color_temp(v: float) -> str:
    s = f"{v:5.1f} C"
    if v > SPOILAGE_TEMP_C:
        return _RED + _BOLD + s + _RESET
    if v > SPOILAGE_TEMP_C - 2.0:
        return _YELLOW + s + _RESET
    return _GREEN + s + _RESET


def _color_rh(v: float) -> str:
    s = f"{v:5.1f}%"
    if v > SPOILAGE_RH_PCT:
        return _RED + _BOLD + s + _RESET
    if v > SPOILAGE_RH_PCT - 5.0:
        return _YELLOW + s + _RESET
    return _GREEN + s + _RESET


def render_dashboard(fleet: list[Silo], tick: int, interval: int) -> None:
    os.system("cls" if os.name == "nt" else "clear")
    now_str = datetime.now().strftime("%Y-%m-%d  %H:%M:%S")

    print(_BOLD + _CYAN)
    print("  +------------------------------------------------------------------------------+")
    print(f"  |  SmartVault Agri-WMS - Silo Sensor Simulator        {now_str}  |")
    print("  +------------------------------------------------------------------------------+")
    print(_RESET)

    hdr = (
        f"  {'SILO ID':<16}  {'WAREHOUSE':<30}  {'COMMODITY':<22}"
        f"  {'TEMP':>8}  {'RH':>7}  {'SCENARIO':<14}  ALERTS"
    )
    print(_BOLD + hdr + _RESET)
    print("  " + "-" * 112)

    for silo in fleet:
        icon = SCENARIO_ICONS[silo.scenario]
        if silo.scenario == Scenario.SILENT:
            temp_col = _DIM + "    ------" + _RESET
            rh_col   = _DIM + "  ------" + _RESET
        else:
            temp_col = _color_temp(silo.current_temp)
            rh_col   = _color_rh(silo.current_rh)

        alerts         = (f"{_RED}! {silo.alert_count} breach(es){_RESET}" if silo.alert_count else "")
        scenario_label = f"{icon} {silo.scenario.value}"

        print(
            f"  {silo.silo_id:<16}  {silo.warehouse:<30}  {silo.commodity:<22}"
            f"  {temp_col}  {rh_col}  {scenario_label:<14}  {alerts}"
        )

    print()
    print(
        f"  {_DIM}Thresholds: Temp > {SPOILAGE_TEMP_C} C  |  RH > {SPOILAGE_RH_PCT}%  |"
        f"  Tick #{tick}  |  Next in {interval}s  |  Ctrl+C to stop{_RESET}"
    )
    print(
        f"  {_DIM}Hot-reload: edit  services/silo_simulator/scenarios.json{_RESET}"
    )
    print()


# ===========================================================================
# MQTT PUBLISHER
# ===========================================================================

class MQTTPublisher:
    """
    Wraps paho-mqtt with auto-reconnect logic and a simple publish helper.
    Supports plain (port 1883, username/password) and mTLS (port 8883).
    """

    def __init__(self):
        self._connected = False
        self.client = mqtt.Client(
            mqtt.CallbackAPIVersion.VERSION1,
            client_id="smartvault-silo-sim",
            clean_session=True,
        )
        if MQTT_USERNAME:
            self.client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)

        if MQTT_USE_TLS:
            import ssl
            self.client.tls_set(
                ca_certs    = MQTT_CA_CERT     or None,
                certfile    = MQTT_CLIENT_CERT or None,
                keyfile     = MQTT_CLIENT_KEY  or None,
                cert_reqs   = ssl.CERT_REQUIRED,
                tls_version = ssl.PROTOCOL_TLS_CLIENT,
            )

        self.client.on_connect    = self._on_connect
        self.client.on_disconnect = self._on_disconnect

    def connect(self) -> None:
        print(f"\n  Connecting to MQTT broker at {MQTT_HOST}:{MQTT_PORT} ...")
        self.client.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
        self.client.loop_start()
        time.sleep(1.5)  # Allow broker handshake before first publish

    def _on_connect(self, client, userdata, flags, rc):
        self._connected = (rc == 0)
        if rc == 0:
            print(f"  [OK]  MQTT connected  ({MQTT_HOST}:{MQTT_PORT})")
        else:
            print(f"  [ERR] MQTT connection refused  (rc={rc})")
            print(
                "  Hint: check MQTT_HOST, MQTT_PORT, MQTT_USERNAME, MQTT_PASSWORD in .env\n"
                "        or verify Mosquitto is running on port 1883."
            )

    def _on_disconnect(self, client, userdata, rc):
        self._connected = False
        if rc != 0:
            print(f"\n  [WARN] MQTT disconnected unexpectedly (rc={rc}). Reconnecting ...")

    def publish(self, silo_id: str, temperature_c: float, humidity_pct: float) -> bool:
        if not self._connected:
            return False
        topic   = f"silo/{silo_id}/telemetry"
        payload = json.dumps({
            "temperature_c":    temperature_c,
            "humidity_percent": humidity_pct,
        })
        result = self.client.publish(topic, payload, qos=1)
        return result.rc == mqtt.MQTT_ERR_SUCCESS

    def stop(self) -> None:
        self.client.loop_stop()
        self.client.disconnect()


# ===========================================================================
# CLI
# ===========================================================================

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="SmartVault Agri-WMS - Silo Sensor Simulator",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
examples:
  python simulator.py
  python simulator.py --interval 5
  python simulator.py --scenario CRITICAL:SILO-KMS-01
  python simulator.py --scenario WARNING:SILO-SUY-01,SILENT:SILO-TAM-01

scenarios:
  NORMAL     Healthy grain. Readings follow the natural day/night cycle.
  WARNING    Aeration degrading. Readings creep toward alert thresholds.
  CRITICAL   Active spoilage risk. Readings breach thresholds — Celery
             fires check_spoilage_thresholds -> SMS to WAREHOUSE_MANAGER_PHONE.
  RECOVERING Aeration restored. Values drift slowly back to baseline.
  SILENT     Sensor stops publishing. Tests the Celery beat task
             scan_all_silos_for_spoilage (runs every 15 min).
        """,
    )
    parser.add_argument(
        "--interval", "-i", type=int, default=PUBLISH_INTERVAL,
        metavar="SECONDS",
        help=f"Publish interval in seconds (default: {PUBLISH_INTERVAL})",
    )
    parser.add_argument(
        "--scenario", "-s", type=str, default="",
        metavar="SCENARIO:SILO_ID[,...]",
        help="Comma-separated initial scenario overrides, e.g. CRITICAL:SILO-KMS-01",
    )
    return parser.parse_args()


def apply_cli_scenarios(fleet: list[Silo], scenario_arg: str) -> None:
    """Parse --scenario CRITICAL:SILO-KMS-01,WARNING:SILO-SUY-01 and apply."""
    if not scenario_arg.strip():
        return
    silo_map = {s.silo_id: s for s in fleet}
    for part in scenario_arg.split(","):
        part = part.strip()
        if ":" not in part:
            print(f"  [WARN] Skipping malformed scenario override: '{part}'")
            continue
        scenario_str, silo_id = part.split(":", 1)
        silo = silo_map.get(silo_id.strip().upper())
        if not silo:
            print(f"  [WARN] Unknown silo ID '{silo_id}' -- skipping.")
            continue
        try:
            silo.scenario = Scenario(scenario_str.strip().upper())
            print(f"  [OK]  {silo.silo_id} -> {silo.scenario.value}")
        except ValueError:
            print(f"  [WARN] Unknown scenario '{scenario_str}' -- skipping.")


# ===========================================================================
# MAIN LOOP
# ===========================================================================

def main() -> None:
    args     = parse_args()
    interval = args.interval

    print(_BOLD + _CYAN)
    print("  +--------------------------------------------+")
    print("  |  SmartVault Agri-WMS -- Silo Simulator     |")
    print("  +--------------------------------------------+")
    print(_RESET)

    if args.scenario:
        print("  Applying CLI scenario overrides ...")
        apply_cli_scenarios(FLEET, args.scenario)

    publisher = MQTTPublisher()
    publisher.connect()

    def _shutdown(sig, frame):
        print("\n\n  Shutting down simulator ...")
        publisher.stop()
        print("  Done. Goodbye.\n")
        sys.exit(0)

    signal.signal(signal.SIGINT,  _shutdown)
    signal.signal(signal.SIGTERM, _shutdown)

    print(f"\n  Simulating {len(FLEET)} silos | Publish interval: {interval}s")
    print(f"  Scenario file: {SCENARIOS_FILE}")
    print(f"\n  First readings in 2 seconds ...\n")
    time.sleep(2)

    tick = 0
    while True:
        now  = datetime.now()
        tick += 1

        # Hot-reload scenario overrides from scenarios.json
        load_scenario_overrides(FLEET)

        for silo in FLEET:
            temp, rh = compute_reading(silo, now)

            if temp is None:
                # SILENT mode — skip publish, still shown in dashboard
                continue

            ok = publisher.publish(silo.silo_id, temp, rh)

            if ok:
                silo.last_published = now
                if temp > SPOILAGE_TEMP_C or rh > SPOILAGE_RH_PCT:
                    silo.alert_count += 1

        render_dashboard(FLEET, tick, interval)
        time.sleep(interval)


if __name__ == "__main__":
    main()
