from django.contrib.auth.decorators import login_required
from django.shortcuts import render
from django.views.generic import TemplateView
from django.contrib.auth.mixins import LoginRequiredMixin
from django.utils.dateparse import parse_datetime

from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework import status

from .models import Station, StationStatus, SensorReading
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.authentication import JWTAuthentication

from .serializers import (
    SensorReadingSerializer,
    SensorReadingLatestSerializer,
    SensorReadingChartSerializer,
    PowerChartSerializer,
    StationSerializer,
)

import csv
import math
import requests
from django.http import HttpResponse

def api_response(data=None, message=None, error=None, status_code=200):
    """
    Standard response format for all API endpoints.
    React always gets the same structure — easy to handle.

    Success:
    {
        "success": true,
        "message": "optional message",
        "data": { ... }
    }

    Error:
    {
        "success": false,
        "error": "what went wrong"
    }
    """
    if error:
        return Response(
            {'success': False, 'error': error},
            status=status_code
        )
    return Response(
        {'success': True, 'message': message, 'data': data},
        status=status_code
    )

# ─────────────────────────────────────────────────────────
# Existing views (unchanged)
# ─────────────────────────────────────────────────────────

class LandingView(TemplateView):
    """Public landing page — no login required."""
    template_name = "stations/landing.html"


class DashboardView(LoginRequiredMixin, TemplateView):
    """Protected dashboard — redirects to login if not authenticated."""
    template_name = "stations/dashboard.html"
    login_url = '/login/'


@login_required
def dashboard(request):
    stations = Station.objects.select_related("status").all()

    summary = {"full": 0, "partial": 0, "down": 0}
    for s in stations:
        stat = getattr(s, "status", None)
        key  = stat.status if stat else "down"
        summary[key] = summary.get(key, 0) + 1

    return render(request, "stations/dashboard.html", {
        "stations": stations,
        "summary": summary,
    })


# ─────────────────────────────────────────────────────────
# Helpers for parsing ESP32 raw string
# ─────────────────────────────────────────────────────────

def parse_esp32_string(raw):
    """
    Parses the ESP32 comma-separated string into a dict.

    Input:
    "Time:Wednesday, 2026-06-17 15:53:47,Press:nan,Alt:nan,Temp:nan,
     Hum:nan,Light:0.00,SoilM:3.30,Rain:0,WSpd:0.00,WDir:2,
     V33:3.36,V5:4.82,VBatt:11.32,VSol:1.02,VDC:1.02,CBatt:0.43,CSol:0.62"

    Output:
    {
        'Time':  '2026-06-17 15:53:47',
        'Press': 'nan',
        'Temp':  'nan',
        ...
    }

    The tricky part: the timestamp contains a comma after the day name
    e.g. "Wednesday, 2026-06-17" — we strip the day name first.
    """
    # Strip the day name from timestamp to remove its comma
    # "Time:Wednesday, 2026-06-17..." → "Time:2026-06-17..."
    days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday',
            'Friday', 'Saturday', 'Sunday']
    for day in days:
        raw = raw.replace(f'Time:{day}, ', 'Time:')

    parsed = {}
    for part in raw.split(','):
        part = part.strip()
        if ':' not in part:
            continue
        key, _, value = part.partition(':')
        parsed[key.strip()] = value.strip()

    return parsed


def safe_float(value):
    """Convert to float. Returns None for nan or invalid values."""
    try:
        f = float(value)
        return None if math.isnan(f) else f
    except (ValueError, TypeError):
        return None


def safe_int(value):
    """Convert to int. Returns None for invalid values."""
    try:
        return int(float(value))
    except (ValueError, TypeError):
        return None


def get_or_none(station_code):
    """
    Try to find a registered Station by station_id.
    Returns None if not found — reading still saves without a link.
    """
    try:
        return Station.objects.get(station_id=station_code)
    except (Station.DoesNotExist, ValueError, TypeError):
        return None


def call_ml_service(reading, station_code):
    """
    Calls the FastAPI inference service with features derived from the reading.
    Returns the prediction dict on success, None on any failure.
    Ingest always succeeds regardless of what this returns.
    """
    from django.utils import timezone
    from datetime import timedelta

    # All four base fields must be present to form valid features
    if any(v is None for v in [
        reading.temperature, reading.humidity,
        reading.wind_speed,  reading.wind_direction,
    ]):
        return None

    # Dew point for the current reading — Magnus approximation
    dew_point = reading.temperature - ((100 - reading.humidity) / 5)

    # Pull the last 3 hours of readings for this station where all
    # required fields are present, oldest-first for trend computation
    since  = timezone.now() - timedelta(hours=3)
    recent = list(
        SensorReading.objects.filter(
            station_code=station_code,
            timestamp__gte=since,
            temperature__isnull=False,
            humidity__isnull=False,
            wind_speed__isnull=False,
        ).order_by('timestamp').values('temperature', 'humidity', 'wind_speed')
    )

    if not recent:
        return None

    # Compute dew_point for every row in the window
    entries = [
        {
            'temperature': r['temperature'],
            'dew_point':   r['temperature'] - ((100 - r['humidity']) / 5),
            'wind_speed':  r['wind_speed'],
        }
        for r in recent
    ]

    temp_vals = [e['temperature'] for e in entries]
    dp_vals   = [e['dew_point']   for e in entries]
    ws_vals   = [e['wind_speed']  for e in entries]

    n = len(entries)
    temperature_mean_3h  = sum(temp_vals) / n
    dew_point_mean_3h    = sum(dp_vals)   / n
    wind_speed_mean_3h   = sum(ws_vals)   / n

    # Trend = change across the window (oldest → newest)
    temperature_trend_3h = temp_vals[-1] - temp_vals[0]
    dew_point_trend_3h   = dp_vals[-1]   - dp_vals[0]
    wind_speed_trend_3h  = ws_vals[-1]   - ws_vals[0]

    payload = {
        'temperature':          reading.temperature,
        'dew_point':            dew_point,
        'wind_speed':           reading.wind_speed,
        'wind_direction':       reading.wind_direction,
        'temperature_mean_3h':  temperature_mean_3h,
        'temperature_trend_3h': temperature_trend_3h,
        'dew_point_mean_3h':    dew_point_mean_3h,
        'dew_point_trend_3h':   dew_point_trend_3h,
        'wind_speed_mean_3h':   wind_speed_mean_3h,
        'wind_speed_trend_3h':  wind_speed_trend_3h,
        'hour_of_day':          reading.timestamp.hour,
    }

    try:
        resp = requests.post(
            'http://localhost:8001/predict',
            json=payload,
            timeout=2,
        )
        if resp.status_code == 200:
            return resp.json()
        return None
    except Exception:
        return None


# ─────────────────────────────────────────────────────────
# API: Ingest endpoint — ESP32 posts data here
# ─────────────────────────────────────────────────────────

# Ingest — AllowAny so ESP32 can post without login
@api_view(['POST'])
@permission_classes([AllowAny])
def ingest(request):
    """
    Receives sensor data from the ESP32 via GSM POST request.

    Accepts two formats:

    Format 1 — raw ESP32 string (recommended):
    {
        "station_id": "AWS-UG-001",
        "raw": "Time:Wednesday, 2026-06-17 15:53:47,Press:nan,..."
    }

    Format 2 — pre-parsed JSON:
    {
        "station_id": "AWS-UG-001",
        "timestamp": "2026-06-17T15:53:47",
        "temperature": 24.5,
        "humidity": 78.2,
        ...
    }
    """
    data       = request.data
    station_id = data.get('station_id', 'AWS-UG-001')
    station    = get_or_none(station_id)

    # ── Format 1: raw ESP32 string ────────────────────────
    if 'raw' in data:
        parsed = parse_esp32_string(data['raw'])

        timestamp = parse_datetime(parsed.get('Time', ''))
        if timestamp is None:
            return Response(
                {'error': 'Could not parse timestamp from raw string'},
                status=400
            )

        reading = SensorReading(
            station        = station,
            station_code     = station_id,
            timestamp      = timestamp,
            pressure       = safe_float(parsed.get('Press')),
            altitude       = safe_float(parsed.get('Alt')),
            temperature    = safe_float(parsed.get('Temp')),
            humidity       = safe_float(parsed.get('Hum')),
            light          = safe_float(parsed.get('Light')),
            soil_moisture  = safe_float(parsed.get('SoilM')),
            rain           = safe_int(parsed.get('Rain')),
            wind_speed     = safe_float(parsed.get('WSpd')),
            wind_direction = safe_int(parsed.get('WDir')),
            volt_3v3       = safe_float(parsed.get('V33')),
            volt_5v        = safe_float(parsed.get('V5')),
            volt_batt      = safe_float(parsed.get('VBatt')),
            volt_solar     = safe_float(parsed.get('VSol')),
            volt_dc        = safe_float(parsed.get('VDC')),
            curr_batt      = safe_float(parsed.get('CBatt')),
            curr_solar     = safe_float(parsed.get('CSol')),
        )

    # ── Format 2: pre-parsed JSON ─────────────────────────
    else:
        timestamp = parse_datetime(str(data.get('timestamp', '')))
        if timestamp is None:
            return api_response(
                {'error': 'timestamp is required and must be ISO format'},
                status_code=400
            )

        reading = SensorReading(
            station        = station,
            station_code     = station_id,
            timestamp      = timestamp,
            pressure       = safe_float(data.get('pressure')),
            altitude       = safe_float(data.get('altitude')),
            temperature    = safe_float(data.get('temperature')),
            humidity       = safe_float(data.get('humidity')),
            light          = safe_float(data.get('light')),
            soil_moisture  = safe_float(data.get('soil_moisture')),
            rain           = safe_int(data.get('rain')),
            wind_speed     = safe_float(data.get('wind_speed')),
            wind_direction = safe_int(data.get('wind_direction')),
            volt_3v3       = safe_float(data.get('volt_3v3')),
            volt_5v        = safe_float(data.get('volt_5v')),
            volt_batt      = safe_float(data.get('volt_batt')),
            volt_solar     = safe_float(data.get('volt_solar')),
            volt_dc        = safe_float(data.get('volt_dc')),
            curr_batt      = safe_float(data.get('curr_batt')),
            curr_solar     = safe_float(data.get('curr_solar')),
        )

    reading.save()

    # Update StationStatus — ML prediction if available, rule-based fallback
    if station:
        prediction = call_ml_service(reading, station_id)

        if prediction:
            ml_status = (
                StationStatus.Status.FULL
                if prediction['prediction'] == 'healthy'
                else StationStatus.Status.PARTIAL
            )
            StationStatus.objects.update_or_create(
                station=station,
                defaults={
                    'status':      ml_status,
                    'computed_by': 'ml_model',
                    'details': {
                        'last_reading_id': reading.id,
                        'prediction':      prediction['prediction'],
                        'at_risk_proba':   prediction['at_risk_proba'],
                        'threshold_used':  prediction['threshold_used'],
                    }
                }
            )
        else:
            StationStatus.objects.update_or_create(
                station=station,
                defaults={
                    'status':      StationStatus.Status.FULL,
                    'computed_by': 'rule_based',
                    'details':     {'last_reading_id': reading.id}
                }
            )

    return api_response(
        {'status': 'ok', 'id': reading.id},
        status_code=201
    )


# ─────────────────────────────────────────────────────────
# API: Latest reading per station
# ─────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def stations_list(request):
    """
    Returns all registered stations with their current status.
    Used by React sidebar/station selector.
    """
    stations = Station.objects.select_related('status').all()
    serializer = StationSerializer(stations, many=True)
    return api_response(data=serializer.data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def latest(request):
    station_codes = SensorReading.objects.values_list(
        'station_code', flat=True
    ).distinct()

    results = []
    for code in station_codes:
        reading = SensorReading.objects.filter(
            station_code=code
        ).order_by('-timestamp').first()
        if reading:
            results.append(SensorReadingLatestSerializer(reading).data)

    return api_response(data=results)
# ─────────────────────────────────────────────────────────
# API: Historical readings for a station
# ─────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def history(request, station_id):
    from django.utils import timezone
    from datetime import timedelta

    hours      = int(request.query_params.get('hours', 24))
    limit      = int(request.query_params.get('limit', 200))
    chart_type = request.query_params.get('type', 'sensor')
    since      = timezone.now() - timedelta(hours=hours)

    readings = SensorReading.objects.filter(
        station_code=station_id,
        timestamp__gte=since
    ).order_by('timestamp')[:limit]

    if chart_type == 'power':
        serializer = PowerChartSerializer(readings, many=True)
    else:
        serializer = SensorReadingChartSerializer(readings, many=True)

    return api_response(data={
        'station_id': station_id,
        'hours':      hours,
        'count':      readings.count(),
        'readings':   serializer.data,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def station_detail(request, station_id):
    try:
        station = Station.objects.select_related('status').get(
            station_id=station_id
        )
    except Station.DoesNotExist:
        return api_response(
            error=f'Station {station_id} not found',
            status_code=404
        )

    latest_reading = SensorReading.objects.filter(
        station_code=station_id
    ).order_by('-timestamp').first()

    return api_response(data={
        'station':        StationSerializer(station).data,
        'latest_reading': SensorReadingLatestSerializer(
                            latest_reading
                          ).data if latest_reading else None,
    })


# ─────────────────────────────────────────────────────────
# API: Export endpoint — ML training data download
# ─────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export(request):
    from django.utils import timezone
    from datetime import timedelta

    station_id = request.query_params.get('station_id')
    hours      = int(request.query_params.get('hours', 168))
    fmt        = request.query_params.get('output', 'json')
    fields     = request.query_params.get('fields', 'all')

    since    = timezone.now() - timedelta(hours=hours)
    readings = SensorReading.objects.filter(
        timestamp__gte=since
    ).order_by('timestamp')

    if station_id:
        readings = readings.filter(station_code=station_id)

    if fields == 'sensor':
        serializer = SensorReadingChartSerializer(readings, many=True)
    elif fields == 'power':
        serializer = PowerChartSerializer(readings, many=True)
    else:
        serializer = SensorReadingSerializer(readings, many=True)

    if fmt == 'csv':
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="aws_export.csv"'
        fieldnames = list(serializer.child.fields.keys())
        writer = csv.DictWriter(response, fieldnames=fieldnames)
        writer.writeheader()
        for row in serializer.data:
            writer.writerow(row)
        return response

    return Response({
        'success': True,
        'count':   len(serializer.data),
        'data':    serializer.data,
    })