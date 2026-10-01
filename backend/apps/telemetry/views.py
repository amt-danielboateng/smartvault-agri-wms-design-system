from rest_framework import serializers
from rest_framework.viewsets import ReadOnlyModelViewSet
from .models import SiloSensorReading


class SiloSensorReadingSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiloSensorReading
        fields = ["id", "time", "silo_id", "temperature_c", "humidity_percent"]


class SiloSensorReadingViewSet(ReadOnlyModelViewSet):
    serializer_class = SiloSensorReadingSerializer

    def get_queryset(self):
        qs = SiloSensorReading.objects.all()
        silo_id = self.request.query_params.get("silo_id")
        if silo_id:
            qs = qs.filter(silo_id=silo_id)
        return qs
