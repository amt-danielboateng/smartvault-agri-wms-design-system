from rest_framework import serializers
from .models import CommodityType, IntakeTransaction, Warehouse


class CommodityTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model  = CommodityType
        fields = [
            "id", "name", "code",
            "max_moisture_grade1", "max_moisture_grade2",
            "max_foreign_matter_pct", "max_broken_grains_pct",
        ]


class WarehouseSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Warehouse
        fields = ["id", "name", "region"]


class IntakeTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model  = IntakeTransaction
        fields = [
            "id", "farmer_id", "commodity", "weight_kg",
            "moisture_percent", "warehouse", "timestamp", "receipt_hash",
        ]
        read_only_fields = ["receipt_hash", "timestamp"]
