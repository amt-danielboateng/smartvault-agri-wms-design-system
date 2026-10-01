from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender="intake.IntakeTransaction")
def auto_issue_receipt(sender, instance, created, **kwargs):
    if not created:
        return
    # Avoid circular import
    from apps.receipts.models import WarehouseReceipt

    if hasattr(instance, "receipt"):
        return  # already issued (e.g. fixture load)

    last = WarehouseReceipt.objects.order_by("-issued_at").first()
    previous_hash = last.block_hash if last else ""

    WarehouseReceipt.objects.create(
        transaction=instance,
        previous_hash=previous_hash,
    )
