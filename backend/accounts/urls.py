from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

urlpatterns = [
    path('api/login/',         views.login_api,          name='login'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/register/',      views.register_api,       name='register'),
    path('api/logout/',        views.logout_api,         name='logout'),
]
