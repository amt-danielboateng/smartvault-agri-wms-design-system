from rest_framework.routers import DefaultRouter
from .views import CommodityTypeViewSet, IntakeTransactionViewSet, WarehouseViewSet

router = DefaultRouter()
router.register("transactions", IntakeTransactionViewSet)
router.register("warehouses",   WarehouseViewSet)
router.register("commodities",  CommodityTypeViewSet)

urlpatterns = router.urls
