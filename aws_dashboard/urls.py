from django.contrib import admin
from django.urls import path, include
from django.contrib.auth import views as auth_views
from stations.views import LandingView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', LandingView.as_view(), name='home'),
    path('login/', auth_views.LoginView.as_view(
        template_name='registration/login.html'), name='login'),
    path('logout/', auth_views.LogoutView.as_view(
        next_page='/'), name='logout'),
    path('', include('accounts.urls')),      # adds /register/
    path('', include('stations.urls')),      # adds /dashboard/ etc.
]