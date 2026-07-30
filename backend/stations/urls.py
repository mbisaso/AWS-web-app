from django.urls import path
from . import views

urlpatterns = [
    # ── API endpoints ─────────────────────────────────────
    path('api/ingest/',                               views.ingest,         name='ingest'),
    path('api/latest/',                               views.latest,         name='latest'),
    path('api/export/',                               views.export,         name='export'),
    path('api/stations/',                             views.stations_list,  name='stations_list'),
    path('api/stations/bulk-history/',                views.bulk_history,   name='bulk_history'),
    path('api/stations/<str:station_id>/',            views.station_detail, name='station_detail'),
    path('api/stations/<str:station_id>/history/',    views.history,        name='history'),
    path('api/ingest/weather/', views.ingest_weather, name='ingest_weather'),
    path('api/ingest/voltage/', views.ingest_voltage, name='ingest_voltage'),
    path('api/ingest/current/', views.ingest_current, name='ingest_current'),
    path('api/sim-alert-email/',                       views.sim_alert_email, name='sim_alert_email'),
    path('api/benchmark/',                             views.benchmark,      name='benchmark'),
    path('api/benchmark/import/',                       views.benchmark_import, name='benchmark_import'),
    path('api/dashboard/overview/',                    views.dashboard_overview, name='dashboard_overview'),
    path('api/sims/management/',                       views.sim_management_data, name='sim_management_data'),
    path('api/sims/<int:sim_id>/',                     views.update_sim_account, name='update_sim_account'),
    path('api/sims/<int:sim_id>/topup/',               views.topup_sim_account, name='topup_sim_account'),
]