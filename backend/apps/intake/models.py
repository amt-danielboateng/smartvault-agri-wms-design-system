import hashlib
import json
from django.contrib.gis.db import models


class IntakeTransaction(models.Model):
    farmer_id = models.CharField(max_length=64, db_index=True)
    commodity = models.CharField(max_length=100)
    weight_kg = models.DecimalField(max_digits=10, decimal_places=2)
    moisture_percent = models.DecimalField(max_digits=5, decimal_places=2)
    warehouse = models.ForeignKey("Warehouse", on_delete=models.PROTECT, related_name="transactions")
    timestamp = models.DateTimeField(auto_now_add=True)
    receipt_hash = models.CharField(max_length=64, blank=True, editable=False)

    def save(self, *args, **kwargs):
        payload = json.dumps({
            "farmer_id": self.farmer_id,
            "commodity": self.commodity,
            "weight_kg": str(self.weight_kg),
            "moisture_percent": str(self.moisture_percent),
            "warehouse_id": self.warehouse_id,
        }, sort_keys=True)
        self.receipt_hash = hashlib.sha256(payload.encode()).hexdigest()
        super().save(*args, **kwargs)

    class Meta:
        ordering = ["-timestamp"]


class Warehouse(models.Model):
    name = models.CharField(max_length=200)
    location = models.PointField(srid=4326)
    region = models.CharField(max_length=100)

    def __str__(self):
        return self.name
