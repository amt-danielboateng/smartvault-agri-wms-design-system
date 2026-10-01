from celery import shared_task
from django.conf import settings


@shared_task(bind=True, max_retries=3)
def send_sms_receipt(self, phone_number: str, message: str):
    try:
        import africastalking
        africastalking.initialize(settings.AFRICASTALKING_USERNAME, settings.AFRICASTALKING_API_KEY)
        sms = africastalking.SMS
        sms.send(message, [phone_number])
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60)
