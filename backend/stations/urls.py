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
    path('api/sim-alert-email/',                       views.sim_alert_email, name='sim_alert_email'),
    path('api/benchmark/',                             views.benchmark,      name='benchmark'),
    path('api/benchmark/import/',                       views.benchmark_import, name='benchmark_import'),
]