from django.urls import path
from . import views

urlpatterns = [
    # ── Page views ────────────────────────────────────────
    path('',           views.LandingView.as_view(),   name='landing'),
    path('dashboard/', views.DashboardView.as_view(), name='dashboard'),

    # ── API endpoints ─────────────────────────────────────
    path('api/ingest/',                               views.ingest,         name='ingest'),
    path('api/latest/',                               views.latest,         name='latest'),
    path('api/export/',                               views.export,         name='export'),
    path('api/stations/',                             views.stations_list,  name='stations_list'),
    path('api/stations/<str:station_id>/',            views.station_detail, name='station_detail'),
    path('api/stations/<str:station_id>/history/',    views.history,        name='history'),
]