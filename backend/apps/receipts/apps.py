from django.apps import AppConfig


class ReceiptsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.receipts"

    def ready(self):
        import apps.receipts.signals  # noqa: F401
