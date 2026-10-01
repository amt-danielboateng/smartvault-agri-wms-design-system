from rest_framework import serializers
from rest_framework.viewsets import ReadOnlyModelViewSet
from rest_framework.routers import DefaultRouter
from .models import WarehouseReceipt


class WarehouseReceiptSerializer(serializers.ModelSerializer):
    class Meta:
        model = WarehouseReceipt
        fields = ["id", "transaction", "previous_hash", "block_hash", "issued_at"]


class WarehouseReceiptViewSet(ReadOnlyModelViewSet):
    queryset = WarehouseReceipt.objects.select_related("transaction").all()
    serializer_class = WarehouseReceiptSerializer


router = DefaultRouter()
router.register("", WarehouseReceiptViewSet, basename="receipt")
urlpatterns = router.urls
