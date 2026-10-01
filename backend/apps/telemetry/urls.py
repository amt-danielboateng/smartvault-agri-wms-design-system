from rest_framework.routers import DefaultRouter
from .views import SiloSensorReadingViewSet

router = DefaultRouter()
router.register("readings", SiloSensorReadingViewSet, basename="sensor-reading")

urlpatterns = router.urls
