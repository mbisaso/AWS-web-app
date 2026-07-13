from django.urls import path
from . import views

urlpatterns = [
    # ── API endpoints ─────────────────────────────────────
    path('api/ingest/',                               views.ingest,         name='ingest'),
    path('api/latest/',                               views.latest,         name='latest'),
    path('api/export/',                               views.export,         name='export'),
    path('api/stations/',                             views.stations_list,  name='stations_list'),
    path('api/stations/<str:station_id>/',            views.station_detail, name='station_detail'),
    path('api/stations/<str:station_id>/history/',    views.history,        name='history'),
    path('api/ingest/weather/', views.ingest_weather, name='ingest_weather'),
    path('api/ingest/voltage/', views.ingest_voltage, name='ingest_voltage'),
    path('api/ingest/current/', views.ingest_current, name='ingest_current'),
]