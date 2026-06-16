from django.contrib import admin
from .models import Station, SensorParameter, Reading, StationStatus

admin.site.register(Station)
admin.site.register(SensorParameter)
admin.site.register(Reading)
admin.site.register(StationStatus)