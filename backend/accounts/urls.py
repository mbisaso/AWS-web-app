from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import CustomTokenObtainPairView, password_reset_request_api, password_reset_confirm_api

from . import views

urlpatterns = [
    path('api/login/', CustomTokenObtainPairView.as_view(), name='login'),
    
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/register/',      views.register_api,       name='register'),
    path('api/logout/',        views.logout_api,         name='logout'),
    path('api/password-reset/', password_reset_request_api, name='password_reset_request'),
    path('api/password-reset-confirm/', password_reset_confirm_api, name='password_reset_confirm'),
]
