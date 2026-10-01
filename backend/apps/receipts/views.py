from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet
from rest_framework.routers import DefaultRouter
from .models import WarehouseReceipt


class WarehouseReceiptSerializer(serializers.ModelSerializer):
    farmer_id  = serializers.CharField(source="transaction.farmer_id",  read_only=True)
    commodity  = serializers.CharField(source="transaction.commodity",   read_only=True)
    weight_kg  = serializers.DecimalField(source="transaction.weight_kg", max_digits=10, decimal_places=2, read_only=True)
    moisture   = serializers.DecimalField(source="transaction.moisture_percent", max_digits=5, decimal_places=2, read_only=True)
    warehouse  = serializers.CharField(source="transaction.warehouse.name", read_only=True)

    class Meta:
        model  = WarehouseReceipt
        fields = [
            "id", "transaction", "farmer_id", "commodity", "weight_kg",
            "moisture", "warehouse", "previous_hash", "block_hash",
            "issued_at", "lien_status", "lien_holder", "lien_officer", "lien_date",
        ]
        read_only_fields = ["block_hash", "issued_at"]


class PledgeSerializer(serializers.Serializer):
    lien_holder  = serializers.CharField(max_length=200)
    lien_officer = serializers.CharField(max_length=200)


class WarehouseReceiptViewSet(ModelViewSet):
    queryset           = WarehouseReceipt.objects.select_related("transaction__warehouse").all()
    serializer_class   = WarehouseReceiptSerializer
    filterset_fields   = ["lien_status", "transaction__commodity"]

    def get_queryset(self):
        qs = super().get_queryset()
        farmer = self.request.query_params.get("farmer_id")
        if farmer:
            qs = qs.filter(transaction__farmer_id__icontains=farmer)
        commodity = self.request.query_params.get("commodity")
        if commodity:
            qs = qs.filter(transaction__commodity__icontains=commodity)
        lien = self.request.query_params.get("lien_status")
        if lien:
            qs = qs.filter(lien_status=lien)
        return qs

    @action(detail=True, methods=["patch"], url_path="pledge")
    def pledge(self, request, pk=None):
        receipt = self.get_object()
        if receipt.lien_status not in (WarehouseReceipt.LienStatus.ISSUED,):
            return Response(
                {"detail": f"Cannot pledge a receipt with status '{receipt.lien_status}'."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        ser = PledgeSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        receipt.lien_status  = WarehouseReceipt.LienStatus.PLEDGED
        receipt.lien_holder  = ser.validated_data["lien_holder"]
        receipt.lien_officer = ser.validated_data["lien_officer"]
        receipt.lien_date    = timezone.now().date()
        receipt.save(update_fields=["lien_status", "lien_holder", "lien_officer", "lien_date"])
        return Response(WarehouseReceiptSerializer(receipt).data)

    @action(detail=True, methods=["patch"], url_path="release")
    def release(self, request, pk=None):
        receipt = self.get_object()
        if receipt.lien_status != WarehouseReceipt.LienStatus.PLEDGED:
            return Response(
                {"detail": f"Cannot release a receipt with status '{receipt.lien_status}'."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        receipt.lien_status = WarehouseReceipt.LienStatus.RELEASED
        receipt.save(update_fields=["lien_status"])
        return Response(WarehouseReceiptSerializer(receipt).data)


router = DefaultRouter()
router.register("", WarehouseReceiptViewSet, basename="receipt")
urlpatterns = router.urls
