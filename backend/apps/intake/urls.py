from rest_framework.routers import DefaultRouter
from .views import IntakeTransactionViewSet, WarehouseViewSet

router = DefaultRouter()
router.register("transactions", IntakeTransactionViewSet)
router.register("warehouses", WarehouseViewSet)

urlpatterns = router.urls
