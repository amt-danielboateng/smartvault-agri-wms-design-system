import hashlib
from django.db import models


class WarehouseReceipt(models.Model):
    class LienStatus(models.TextChoices):
        ISSUED   = "ISSUED",   "Issued"
        PLEDGED  = "PLEDGED",  "Pledged"
        RELEASED = "RELEASED", "Released"
        VOID     = "VOID",     "Void"

    transaction = models.OneToOneField(
        "intake.IntakeTransaction", on_delete=models.PROTECT, related_name="receipt"
    )
    previous_hash = models.CharField(max_length=64, blank=True)
    block_hash    = models.CharField(max_length=64, editable=False)
    issued_at     = models.DateTimeField(auto_now_add=True)
    lien_status   = models.CharField(
        max_length=16,
        choices=LienStatus.choices,
        default=LienStatus.ISSUED,
        db_index=True,
    )
    lien_holder   = models.CharField(max_length=200, blank=True)
    lien_officer  = models.CharField(max_length=200, blank=True)
    lien_date     = models.DateField(null=True, blank=True)

    def save(self, *args, **kwargs):
        chain_input = f"{self.previous_hash}{self.transaction.receipt_hash}".encode()
        self.block_hash = hashlib.sha256(chain_input).hexdigest()
        super().save(*args, **kwargs)

    class Meta:
        ordering = ["-issued_at"]
