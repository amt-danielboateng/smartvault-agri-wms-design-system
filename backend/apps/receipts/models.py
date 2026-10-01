import hashlib
from django.db import models


class WarehouseReceipt(models.Model):
    transaction = models.OneToOneField(
        "intake.IntakeTransaction", on_delete=models.PROTECT, related_name="receipt"
    )
    previous_hash = models.CharField(max_length=64, blank=True)
    block_hash = models.CharField(max_length=64, editable=False)
    issued_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        chain_input = f"{self.previous_hash}{self.transaction.receipt_hash}".encode()
        self.block_hash = hashlib.sha256(chain_input).hexdigest()
        super().save(*args, **kwargs)

    class Meta:
        ordering = ["-issued_at"]
