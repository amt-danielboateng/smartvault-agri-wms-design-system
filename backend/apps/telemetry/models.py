from django.db import models
from timescale.db.models.models import TimescaleModel


class SiloSensorReading(TimescaleModel):
    """TimescaleDB hypertable partitioned by time."""
    silo_id = models.CharField(max_length=64, db_index=True)
    temperature_c = models.FloatField()
    humidity_percent = models.FloatField()

    class Meta:
        ordering = ["-time"]
