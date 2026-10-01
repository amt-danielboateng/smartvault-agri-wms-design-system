from django.urls import path
from .views import USSDWebhookView

urlpatterns = [
    path("ussd/", USSDWebhookView.as_view(), name="ussd-webhook"),
]
