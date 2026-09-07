from rest_framework import serializers
from .models import (
    Station, StationStatus, SensorReading, WeatherReading,
    VoltageReading, CurrentReading, BenchmarkReading, WeatherMinute
)


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
            'phone_number',
            'sensors',
            'notes',
            'created_at',
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
            # Atmospheric & Environmental
            'pressure',
            'temperature',
            'humidity',
            'solar_radiation_v',
            'solar_radiation',
            'soil_moisture_v',
            'soil_moisture',
            'rain',
            # Wind
            'wind_speed',
            'wind_direction_v',
            'wind_direction',
            # Power
            'volt_batt',
            'volt_solar',
            'battery_temp',
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
            'solar_radiation',
            'soil_moisture',
            'volt_batt',
            'volt_solar',
            'curr_batt',
            'curr_solar',
        ]


class WeatherMinuteSerializer(serializers.ModelSerializer):
    class Meta:
        model = WeatherMinute
        fields = ['minute_start', 'span_s', 'wind_pulses', 'rain_tips']


class SensorReadingChartSerializer(serializers.ModelSerializer):
    """
    Chart-optimized reading — timestamp + sensor values only.
    No power rails, no metadata. Used for time-series charts in React.
    """
    rain_tips = serializers.IntegerField(source='rain_tips_total', read_only=True)
    wind_speed_knots = serializers.SerializerMethodField()

    class Meta:
        model  = SensorReading
        fields = [
            'timestamp',
            'temperature',
            'humidity',
            'pressure',
            'wind_speed',
            'wind_speed_knots',
            'wind_pulses_total',
            'wind_direction',
            'rain',
            'rain_tips',
            'rain_tips_total',
            'solar_radiation',
            'soil_moisture',
        ]

    def get_wind_speed_knots(self, obj):
        if obj.wind_speed is not None:
            return round(obj.wind_speed * 1.943844, 4)
        return None


class PowerChartSerializer(serializers.ModelSerializer):
    """
    Power monitoring chart data only.
    Separate from sensor chart to keep payloads small.
    """
    class Meta:
        model  = SensorReading
        fields = [
            'timestamp',
            'volt_batt',
            'volt_solar',
            'battery_temp',
            'curr_batt',
            'curr_solar',
        ]
        
# ─────────────────────────────────────────────────────────
# WeatherReading Serializers
# ─────────────────────────────────────────────────────────


class WeatherReadingSerializer(serializers.ModelSerializer):
    class Meta:
        model  = WeatherReading
        fields = [
            'id',
            'station_code',
            'timestamp',
            'received_at',
            'interval_s',
            'pressure',
            'temperature',
            'humidity',
            'solar_radiation_v',
            'solar_radiation',
            'soil_moisture_v',
            'soil_moisture',
            'rain',
            'wind_speed',
            'wind_gust',
            'gust_count',
            'gust_span_ms',
            'wind_pulses_total',
            'rain_tips_total',
            'wind_direction_v',
            'wind_direction',
        ]
        read_only_fields = ['id', 'received_at']

# ─────────────────────────────────────────────────────────
# VoltageReading Serializers
# ─────────────────────────────────────────────────────────

class VoltageReadingSerializer(serializers.ModelSerializer):
    class Meta:
        model  = VoltageReading
        fields = [
            'id',
            'station_code',
            'timestamp',
            'received_at',
            'volt_batt',
            'volt_solar',
            'battery_temp',
        ]
        read_only_fields = ['id', 'received_at']


# ─────────────────────────────────────────────────────────
# CurrentReading Serializers
# ─────────────────────────────────────────────────────────

class CurrentReadingSerializer(serializers.ModelSerializer):
    class Meta:
        model  = CurrentReading
        fields = [
            'id',
            'station_code',
            'timestamp',
            'received_at',
            'curr_batt',
            'curr_solar',
        ]
        read_only_fields = ['id', 'received_at']


# ─────────────────────────────────────────────────────────
# BenchmarkReading Serializers
# ─────────────────────────────────────────────────────────

class BenchmarkReadingSerializer(serializers.ModelSerializer):
    class Meta:
        model = BenchmarkReading
        fields = ['timestamp', 'source', 'location', 'temperature', 'humidity',
                  'pressure', 'wind_speed', 'wind_direction', 'rain', 'solar_radiation', 'soil_moisture']
        
