from rest_framework import serializers
from .models import IntakeTransaction, Warehouse


class WarehouseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Warehouse
        fields = ["id", "name", "region"]


class IntakeTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = IntakeTransaction
        fields = ["id", "farmer_id", "commodity", "weight_kg", "moisture_percent", "warehouse", "timestamp", "receipt_hash"]
        read_only_fields = ["receipt_hash", "timestamp"]
