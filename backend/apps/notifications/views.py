from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from apps.receipts.models import WarehouseReceipt


def _receipt_menu(receipt: WarehouseReceipt) -> str:
    tx = receipt.transaction
    return (
        f"CON SmartVault Receipt\n"
        f"ID: MRS-{receipt.id:04d}\n"
        f"{tx.commodity} {tx.weight_kg} kg\n"
        f"Status: {receipt.lien_status}\n\n"
        f"1. Check balance\n"
        f"2. Lien details\n"
        f"3. Exit"
    )


@method_decorator(csrf_exempt, name="dispatch")
class USSDWebhookView(APIView):
    """
    Africa's Talking USSD callback.
    Session flow:
      Level 0 → ask for receipt ID
      Level 1 → show receipt summary + menu
      Level 2 → handle menu choice
    """
    permission_classes = [AllowAny]  # AT signs requests; add HMAC validation in production

    def post(self, request):
        session_id   = request.data.get("sessionId", "")
        phone_number = request.data.get("phoneNumber", "")
        text         = request.data.get("text", "").strip()

        parts = [p.strip() for p in text.split("*") if p.strip()]
        level = len(parts)

        # Level 0 — entry point
        if level == 0:
            response = "CON Welcome to SmartVault Agri-WMS\nEnter your Receipt ID (e.g. 891):"
            return HttpResponse(response, content_type="text/plain")

        receipt_input = parts[0]

        # Resolve receipt
        try:
            receipt_id = int(receipt_input)
            receipt = WarehouseReceipt.objects.select_related("transaction").get(pk=receipt_id)
        except (ValueError, WarehouseReceipt.DoesNotExist):
            return HttpResponse(
                "END Receipt not found. Please check your ID and try again.",
                content_type="text/plain",
            )

        # Level 1 — show menu
        if level == 1:
            return HttpResponse(_receipt_menu(receipt), content_type="text/plain")

        # Level 2 — handle menu choice
        choice = parts[1] if len(parts) > 1 else ""
        tx = receipt.transaction

        if choice == "1":
            ghs = float(tx.weight_kg) * 7.95  # approximate GHS/kg rate
            response = (
                f"END Receipt MRS-{receipt.id:04d}\n"
                f"Commodity: {tx.commodity}\n"
                f"Net weight: {tx.weight_kg} kg\n"
                f"Est. value: GHS {ghs:,.0f}\n"
                f"Status: {receipt.lien_status}"
            )
        elif choice == "2":
            if receipt.lien_holder:
                response = (
                    f"END Lien Details\n"
                    f"Bank: {receipt.lien_holder}\n"
                    f"Officer: {receipt.lien_officer}\n"
                    f"Date: {receipt.lien_date or 'N/A'}\n"
                    f"Status: {receipt.lien_status}"
                )
            else:
                response = f"END No lien placed on receipt MRS-{receipt.id:04d}."
        elif choice == "3":
            response = "END Thank you for using SmartVault Agri-WMS."
        else:
            response = "END Invalid option. Please try again."

        return HttpResponse(response, content_type="text/plain")
