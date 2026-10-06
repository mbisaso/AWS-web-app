from django.contrib import admin
from django.urls import path, include
from django.contrib.auth import views as auth_views
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from accounts.views import CustomTokenObtainPairView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('login/', auth_views.LoginView.as_view(
        template_name='registration/login.html'), name='login'),
    path('logout/', auth_views.LogoutView.as_view(
        next_page='/'), name='logout'),
    path('', include('accounts.urls')),      # adds /register/
    path('', include('stations.urls')),      # adds /dashboard/ etc.

    # ── JWT endpoints ───────────────────────────
    path('api/token/',         CustomTokenObtainPairView.as_view(),  name='token_obtain'),
    path('api/login/',         CustomTokenObtainPairView.as_view(),  name='token_login_backup'),
    path('api/token/refresh/', TokenRefreshView.as_view(),     name='token_refresh'),
]
