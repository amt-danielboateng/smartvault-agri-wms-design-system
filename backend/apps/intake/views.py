from rest_framework.viewsets import ModelViewSet
from .models import CommodityType, IntakeTransaction, Warehouse
from .serializers import CommodityTypeSerializer, IntakeTransactionSerializer, WarehouseSerializer


class CommodityTypeViewSet(ModelViewSet):
    queryset         = CommodityType.objects.all()
    serializer_class = CommodityTypeSerializer


class WarehouseViewSet(ModelViewSet):
    queryset         = Warehouse.objects.all()
    serializer_class = WarehouseSerializer


class IntakeTransactionViewSet(ModelViewSet):
    queryset         = IntakeTransaction.objects.select_related("warehouse").all()
    serializer_class = IntakeTransactionSerializer
