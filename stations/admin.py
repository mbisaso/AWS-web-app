from django.contrib import admin
from .models import Station, StationStatus, SensorReading


@admin.register(Station)
class StationAdmin(admin.ModelAdmin):
    list_display  = ['station_id', 'name', 'location', 'expected_interval_minutes']
    search_fields = ['station_id', 'name']


@admin.register(StationStatus)
class StationStatusAdmin(admin.ModelAdmin):
    list_display = ['station', 'status', 'last_updated', 'computed_by']
    list_filter  = ['status']


@admin.register(SensorReading)
class SensorReadingAdmin(admin.ModelAdmin):
    list_display  = ['station_id', 'timestamp', 'temperature',
                     'humidity', 'wind_speed', 'volt_batt', 'received_at']
    list_filter   = ['station_id']
    search_fields = ['station_id']
    ordering      = ['-timestamp']