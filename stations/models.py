from django.db import models

class Station(models.Model):
    name = models.CharField(max_length=100)
    station_id = models.CharField(max_length=50, unique=True)
    location = models.CharField(max_length=100, blank=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    expected_interval_minutes = models.IntegerField(default=15)

    def __str__(self):
        return self.name


class SensorParameter(models.Model):
    station = models.ForeignKey(Station, related_name="parameters", on_delete=models.CASCADE)
    name = models.CharField(max_length=50)
    unit = models.CharField(max_length=20, blank=True)

    def __str__(self):
        return f"{self.station.name} - {self.name}"


class Reading(models.Model):
    parameter = models.ForeignKey(SensorParameter, related_name="readings", on_delete=models.CASCADE)
    value = models.FloatField()
    timestamp = models.DateTimeField(db_index=True)

    class Meta:
        ordering = ["-timestamp"]


class StationStatus(models.Model):
    class Status(models.TextChoices):
        FULL = "full", "Perfectly Transmitting"
        PARTIAL = "partial", "Partially Transmitting"
        DOWN = "down", "Down"

    station = models.OneToOneField(Station, related_name="status", on_delete=models.CASCADE)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.DOWN)
    last_updated = models.DateTimeField(auto_now=True)
    details = models.JSONField(default=dict, blank=True)
    computed_by = models.CharField(max_length=50, default="rule_based")