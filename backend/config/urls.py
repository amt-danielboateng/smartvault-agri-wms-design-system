from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/auth/token/",         TokenObtainPairView.as_view(),  name="token_obtain_pair"),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(),     name="token_refresh"),
    path("api/intake/",        include("apps.intake.urls")),
    path("api/telemetry/",     include("apps.telemetry.urls")),
    path("api/receipts/",      include("apps.receipts.urls")),
    path("api/notifications/", include("apps.notifications.urls")),
    path("",                   include("django_prometheus.urls")),
]
