from rest_framework import serializers
from .models import Station, StationStatus, SensorReading, BenchmarkReading


# ─────────────────────────────────────────────────────────
# Station Serializers
# ─────────────────────────────────────────────────────────

class StationStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model  = StationStatus
        fields = ['status', 'last_updated', 'computed_by', 'details']


class StationSerializer(serializers.ModelSerializer):
    """
    Full station info including its current status.
    Used by React dashboard station list.
    """
    status = StationStatusSerializer(read_only=True)

    class Meta:
        model  = Station
        fields = [
            'id',
            'station_id',
            'name',
            'location',
            'latitude',
            'longitude',
            'expected_interval_minutes',
            'status',
        ]


# ─────────────────────────────────────────────────────────
# SensorReading Serializers
# ─────────────────────────────────────────────────────────

class SensorReadingSerializer(serializers.ModelSerializer):
    """
    Full reading — all fields.
    Used for history charts and detailed views.
    """
    class Meta:
        model  = SensorReading
        fields = [
            'id',
            'station_code',
            'timestamp',
            'received_at',
            # Atmospheric
            'pressure',
            'altitude',
            'temperature',
            'humidity',
            # Environment
            'light',
            'soil_moisture',
            'rain',
            # Wind
            'wind_speed',
            'wind_direction',
            # Power
            'volt_3v3',
            'volt_5v',
            'volt_batt',
            'volt_solar',
            'volt_dc',
            'curr_batt',
            'curr_solar',
        ]


class SensorReadingLatestSerializer(serializers.ModelSerializer):
    """
    Compact reading — only what the dashboard current conditions
    panel needs. Keeps the API response small and fast.
    """
    class Meta:
        model  = SensorReading
        fields = [
            'station_code',
            'timestamp',
            'received_at',
            'temperature',
            'humidity',
            'pressure',
            'wind_speed',
            'wind_direction',
            'rain',
            'light',
            'soil_moisture',
            'volt_batt',
            'volt_solar',
            'curr_batt',
            'curr_solar',
        ]


class SensorReadingChartSerializer(serializers.ModelSerializer):
    """
    Chart-optimized reading — timestamp + sensor values only.
    No power rails, no metadata. Used for time-series charts in React.
    """
    class Meta:
        model  = SensorReading
        fields = [
            'timestamp',
            'temperature',
            'humidity',
            'pressure',
            'wind_speed',
            'wind_direction',
            'rain',
            'light',
            'soil_moisture',
        ]


class PowerChartSerializer(serializers.ModelSerializer):
    """
    Power monitoring chart data only.
    Separate from sensor chart to keep payloads small.
    """
    class Meta:
        model  = SensorReading
        fields = [
            'timestamp',
            'volt_3v3',
            'volt_5v',
            'volt_batt',
            'volt_solar',
            'volt_dc',
            'curr_batt',
            'curr_solar',
        ]


# ─────────────────────────────────────────────────────────
# BenchmarkReading Serializers
# ─────────────────────────────────────────────────────────

class BenchmarkReadingSerializer(serializers.ModelSerializer):
    class Meta:
        model = BenchmarkReading
        fields = ['timestamp', 'source', 'location', 'temperature', 'humidity',
                  'pressure', 'wind_speed', 'wind_direction', 'rain', 'light', 'soil_moisture']