from rest_framework.viewsets import ModelViewSet
from .models import IntakeTransaction, Warehouse
from .serializers import IntakeTransactionSerializer, WarehouseSerializer


class WarehouseViewSet(ModelViewSet):
    queryset = Warehouse.objects.all()
    serializer_class = WarehouseSerializer


class IntakeTransactionViewSet(ModelViewSet):
    queryset = IntakeTransaction.objects.select_related("warehouse").all()
    serializer_class = IntakeTransactionSerializer
