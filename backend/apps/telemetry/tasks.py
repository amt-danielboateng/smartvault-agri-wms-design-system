from celery import shared_task
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)

SPOILAGE_TEMP_C  = 30.0   # °C — grain core threshold
SPOILAGE_RH_PCT  = 75.0   # % — relative humidity threshold


@shared_task(name="apps.telemetry.tasks.persist_reading", bind=True, max_retries=3)
def persist_reading(self, payload: dict):
    """Write an MQTT sensor payload to TimescaleDB and trigger spoilage check."""
    try:
        from .models import SiloSensorReading
        reading = SiloSensorReading.objects.create(
            silo_id=payload["silo_id"],
            temperature_c=float(payload["temperature_c"]),
            humidity_percent=float(payload["humidity_percent"]),
        )
        check_spoilage_thresholds.delay(
            silo_id=reading.silo_id,
            temperature_c=reading.temperature_c,
            humidity_percent=reading.humidity_percent,
        )
    except Exception as exc:
        logger.error("persist_reading failed: %s", exc)
        raise self.retry(exc=exc, countdown=10)


@shared_task(name="apps.telemetry.tasks.check_spoilage_thresholds")
def check_spoilage_thresholds(silo_id: str, temperature_c: float, humidity_percent: float):
    """Send SMS alert to warehouse manager when a reading breaches spoilage thresholds."""
    breaches = []
    if temperature_c > SPOILAGE_TEMP_C:
        breaches.append(f"Temp {temperature_c}°C > {SPOILAGE_TEMP_C}°C limit")
    if humidity_percent > SPOILAGE_RH_PCT:
        breaches.append(f"RH {humidity_percent}% > {SPOILAGE_RH_PCT}% limit")

    if not breaches:
        return

    from django.conf import settings
    from apps.notifications.tasks import send_sms_receipt

    manager_phone = getattr(settings, "WAREHOUSE_MANAGER_PHONE", None)
    if not manager_phone:
        logger.warning("WAREHOUSE_MANAGER_PHONE not set — spoilage alert suppressed for %s", silo_id)
        return

    message = (
        f"[SmartVault ALERT] Silo {silo_id} spoilage risk: "
        + "; ".join(breaches)
        + ". Inspect immediately and activate aeration."
    )
    send_sms_receipt.delay(manager_phone, message)
    logger.warning("Spoilage alert dispatched for silo %s: %s", silo_id, breaches)
