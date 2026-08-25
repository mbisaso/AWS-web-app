import csv
import datetime
import io
import logging
import math
import os

from django.db import models
from django.db.models import Q
from django.contrib.auth.decorators import login_required
from django.core.mail import send_mail
from django.http import HttpResponse, JsonResponse
from django.shortcuts import render
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.views.decorators.csrf import csrf_exempt
from django.views.generic import TemplateView
from django.contrib.auth.mixins import LoginRequiredMixin
from django.conf import settings

from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.authentication import JWTAuthentication

logger = logging.getLogger(__name__)

from .models import Station, StationStatus, SensorReading, WeatherReading, VoltageReading, CurrentReading, BenchmarkReading, SimCard
from .ml_service import predict_station_window
from .serializers import (
    SensorReadingSerializer,
    SensorReadingLatestSerializer,
    SensorReadingChartSerializer,
    PowerChartSerializer,
    StationSerializer,
    WeatherReadingSerializer,
    VoltageReadingSerializer,
    CurrentReadingSerializer,
    BenchmarkReadingSerializer,
)


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
    Executes in-memory sensor-fault detection via the embedded ML model.
    Scores a ~6-hour window of recent readings for this station.

    Returns the per-sensor result dict on success, None on failure. Ingest always
    succeeds regardless of what this returns.
    """
    return predict_station_window(station_code, reading)


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
    station_id = data.get('station_id') or data.get('station_code')

    # ── Format 1: raw ESP32 string ────────────────────────
    if 'raw' in data:
        parsed = parse_esp32_string(data['raw'])
        if not station_id:
            station_id = parsed.get('ID') or parsed.get('Station') or parsed.get('station_id') or parsed.get('station_code')

        station_id = station_id or 'AWS-UG-001'
        station    = get_or_none(station_id)

        timestamp = parse_datetime(parsed.get('Time', ''))
        if timestamp is None:
            return Response(
                {'error': 'Could not parse timestamp from raw string'},
                status=400
            )

        reading = SensorReading(
            station          = station,
            station_code     = station_id,
            timestamp        = timestamp,
            pressure         = safe_float(parsed.get('Press')),
            temperature      = safe_float(parsed.get('Temp')),
            humidity         = safe_float(parsed.get('Hum')),
            solar_radiation_v= safe_float(parsed.get('SolRadV') or parsed.get('RadV')),
            solar_radiation  = safe_float(parsed.get('SolRad') or parsed.get('Light') or parsed.get('Rad')),
            soil_moisture_v  = safe_float(parsed.get('SoilMV') or parsed.get('SoilM')),
            soil_moisture    = safe_float(parsed.get('SoilPct') or parsed.get('Soil')),
            rain             = safe_float(parsed.get('Rain')),
            wind_speed       = safe_float(parsed.get('WSpd')),
            wind_direction_v = safe_float(parsed.get('WDirV')),
            wind_direction   = safe_int(parsed.get('WDir')),
            volt_batt        = safe_float(parsed.get('VBatt')),
            volt_solar       = safe_float(parsed.get('VSol')),
            curr_batt        = safe_float(parsed.get('CBatt')),
            curr_solar       = safe_float(parsed.get('CSol')),
        )

    # ── Format 2: pre-parsed JSON ─────────────────────────
    else:
        station_id = station_id or 'AWS-UG-001'
        station    = get_or_none(station_id)

        timestamp = parse_datetime(str(data.get('timestamp', '')))
        if timestamp is None:
            return api_response(
                {'error': 'timestamp is required and must be ISO format'},
                status_code=400
            )

        reading = SensorReading(
            station          = station,
            station_code     = station_id,
            timestamp        = timestamp,
            pressure         = safe_float(data.get('pressure')),
            temperature      = safe_float(data.get('temperature')),
            humidity         = safe_float(data.get('humidity')),
            solar_radiation_v= safe_float(data.get('solar_radiation_v')),
            solar_radiation  = safe_float(data.get('solar_radiation') if data.get('solar_radiation') is not None else data.get('light')),
            soil_moisture_v  = safe_float(data.get('soil_moisture_v')),
            soil_moisture    = safe_float(data.get('soil_moisture')),
            rain             = safe_float(data.get('rain')),
            wind_speed       = safe_float(data.get('wind_speed')),
            wind_direction_v = safe_float(data.get('wind_direction_v')),
            wind_direction   = safe_int(data.get('wind_direction')),
            volt_batt        = safe_float(data.get('volt_batt')),
            volt_solar       = safe_float(data.get('volt_solar')),
            battery_temp     = safe_float(data.get('battery_temp')),
            curr_batt        = safe_float(data.get('curr_batt')),
            curr_solar       = safe_float(data.get('curr_solar')),
        )

    reading.save()

    # Update StationStatus — per-sensor fault detection if available, else fallback.
    if station:
        prediction = call_ml_service(reading, station_id)

        if prediction and 'sensors' in prediction:
            # PARTIAL if any sensor is flagged faulty, otherwise FULL. The specific
            # faulty sensors and their reasons are kept in details for the dashboard.
            faulty = prediction.get('faulty_sensors', [])
            ml_status = (
                StationStatus.Status.PARTIAL if faulty
                else StationStatus.Status.FULL
            )
            StationStatus.objects.update_or_create(
                station=station,
                defaults={
                    'status':      ml_status,
                    'computed_by': 'ml_sensor_fault',
                    'details': {
                        'last_reading_id': reading.id,
                        'as_of':           prediction.get('as_of'),
                        'faulty_sensors':  faulty,
                        'sensors':         prediction.get('sensors', {}),
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

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def stations_list(request):
    """
    GET: Returns all registered stations with their current status.
    POST: Creates a new station.
    """
    if request.method == 'POST':
        serializer = StationSerializer(data=request.data)
        if serializer.is_valid():
            station = serializer.save()
            return api_response(data=StationSerializer(station).data, status_code=201)
        return api_response(error=serializer.errors, status_code=400)

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
# API: Dashboard Overview
# ─────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_overview(request):
    stations = Station.objects.select_related('status').all()
    
    # ── SIM Summary ──
    sims = SimCard.objects.all()
    total_sims = sims.count()
    expired_count = 0
    expiring_soon_count = 0
    total_remaining_mb = 0
    
    today = timezone.now().date()
    soon_threshold = today + datetime.timedelta(days=7)
    
    for sim in sims:
        if sim.expiry_date:
            if sim.expiry_date < today:
                expired_count += 1
            elif sim.expiry_date <= soon_threshold:
                expiring_soon_count += 1
        rem = sim.data_limit_mb - sim.data_used_mb
        if rem > 0:
            total_remaining_mb += rem

    sim_summary = {
        'total_active': total_sims,
        'expired_count': expired_count,
        'expiring_soon_count': expiring_soon_count,
        'total_remaining_mb': total_remaining_mb,
    }

    # ── Stations & Sensor Data ──
    dashboard_stations = []
    
    for s in stations:
        latest = WeatherReading.objects.filter(station=s).order_by('-timestamp').first()
        stat = getattr(s, "status", None)
        db_status = stat.status if stat else "full"
        if db_status == "full":
            status_val = "online"
        elif db_status == "down":
            status_val = "offline"
        else:
            status_val = "partial"
        
        st = {
            'id': s.id,
            'name': s.name,
            'station_code': s.station_id,
            'location': s.location,
            'latitude': s.latitude or 0.0,
            'longitude': s.longitude or 0.0,
            'status': status_val,
            'temperature': None,
            'humidity': None,
            'rainfall': None,
            'wind_speed': None,
            'pressure': None,
            'last_seen': latest.timestamp.isoformat() if latest else s.created_at.isoformat(),
            'expected_interval_minutes': s.expected_interval_minutes,
            'is_stale': False
        }
        
        if latest:
            if latest.temperature is not None:
                st['temperature'] = {'value': latest.temperature, 'unit': '°C'}
            if latest.humidity is not None:
                st['humidity'] = {'value': latest.humidity, 'unit': '%'}
            if latest.rain is not None:
                st['rainfall'] = {'value': latest.rain, 'unit': 'mm'}
            if latest.wind_speed is not None:
                st['wind_speed'] = {'value': latest.wind_speed, 'unit': 'm/s'}
            if latest.pressure is not None:
                st['pressure'] = {'value': latest.pressure, 'unit': 'hPa'}
                
        dashboard_stations.append(st)

    alerts = [] # Alerts to be implemented later
    
    online = sum(1 for s in dashboard_stations if s['status'] in ('online', 'full'))
    offline = sum(1 for s in dashboard_stations if s['status'] in ('offline', 'down'))
    total_st = len(dashboard_stations)
    
    summary = {
        'total_stations': total_st,
        'online_stations': online,
        'online_percentage': round((online / total_st) * 100) if total_st else 0,
        'offline_stations': offline,
        'offline_percentage': round((offline / total_st) * 100) if total_st else 0,
        'active_alerts': 0,
        'critical_alerts': 0,
        'warning_alerts': 0,
        'info_alerts': 0,
    }

    return api_response(data={
        'summary': summary,
        'stations': dashboard_stations,
        'alerts': alerts,
        'sim_summary': sim_summary
    })

# ─────────────────────────────────────────────────────────
# API: Historical readings for a station
# ─────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def bulk_history(request):
    """
    Fetch history for multiple stations at once.
    Expects ?station_ids=AWS-001,AWS-002&hours=24&limit=5000
    """
    station_ids_str = request.query_params.get('station_ids', '')
    if not station_ids_str:
        return api_response(error='station_ids is required', status_code=400)
    
    station_ids = [s.strip() for s in station_ids_str.split(',') if s.strip()]
    hours = int(request.query_params.get('hours', 24))
    limit = int(request.query_params.get('limit', 5000))
    since = timezone.now() - datetime.timedelta(hours=hours)

    codes = set(station_ids)
    numeric_ids = []
    for sid in station_ids:
        if str(sid).isdigit():
            numeric_ids.append(int(sid))
            st = Station.objects.filter(id=sid).first()
            if st:
                codes.add(st.station_id)

    query = models.Q(station_code__in=codes)
    if numeric_ids:
        query |= models.Q(station__id__in=numeric_ids)

    readings = SensorReading.objects.filter(
        query,
        timestamp__gte=since
    ).order_by('-timestamp')[:limit]

    if not readings.exists() and hours > 0:
        readings = SensorReading.objects.filter(query).order_by('-timestamp')[:limit]

    # Reverse to chronological
    readings = list(readings)[::-1]

    serializer = SensorReadingSerializer(readings, many=True)
    
    return api_response(data={
        'hours': hours,
        'count': len(readings),
        'readings': serializer.data,
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def history(request, station_id):
    hours      = int(request.query_params.get('hours', 24))
    limit      = int(request.query_params.get('limit', 200))
    chart_type = request.query_params.get('type', 'sensor')
    since      = timezone.now() - datetime.timedelta(hours=hours)

    # Resolve station_id if numeric ID (e.g. 1 -> "AWS-001")
    code = station_id
    if str(station_id).isdigit():
        st = Station.objects.filter(id=station_id).first()
        if st:
            code = st.station_id

    query = models.Q(station_code=code) | models.Q(station_code=station_id)
    if str(station_id).isdigit():
        query |= models.Q(station__id=int(station_id))

    readings = SensorReading.objects.filter(
        query,
        timestamp__gte=since
    ).order_by('-timestamp')[:limit]

    # Fallback: if no readings found in timeframe, fetch most recent readings for this station
    if not readings.exists() and hours > 0:
        readings = SensorReading.objects.filter(query).order_by('-timestamp')[:limit]

    # Reverse them back to chronological order for the charts
    readings = list(readings)[::-1]

    if chart_type == 'power':
        serializer = PowerChartSerializer(readings, many=True)
    else:
        serializer = SensorReadingChartSerializer(readings, many=True)

    return api_response(data={
        'station_id': station_id,
        'hours':      hours,
        'count':      len(readings),
        'readings':   serializer.data,
    })


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def station_detail(request, station_id):
    try:
        if str(station_id).isdigit():
            station = Station.objects.select_related('status').get(id=station_id)
        else:
            station = Station.objects.select_related('status').get(station_id=station_id)
    except Station.DoesNotExist:
        return api_response(error=f'Station {station_id} not found', status_code=404)

    if request.method == 'PUT':
        serializer = StationSerializer(station, data=request.data, partial=True)
        if serializer.is_valid():
            updated = serializer.save()
            return api_response(data=StationSerializer(updated).data)
        return api_response(error=serializer.errors, status_code=400)

    if request.method == 'DELETE':
        station.delete()
        return api_response(message="Station deleted", status_code=200)

    latest_reading = SensorReading.objects.filter(
        station_code=station.station_id
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
    station_id = request.query_params.get('station_id')
    hours      = int(request.query_params.get('hours', 168))
    fmt        = request.query_params.get('output', 'json')
    fields     = request.query_params.get('fields', 'all')

    since    = timezone.now() - datetime.timedelta(hours=hours)
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


# ─────────────────────────────────────────────────────────
# API: Split ingest endpoints — mirror the 3 ThingSpeak channels
# ─────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([AllowAny])
def ingest_weather(request):
    """
    Channel 1 equivalent. Expects pre-parsed JSON:
    { "station_id": "AWS-UG-001", "timestamp": "...", "pressure": .., ... }
    """
    data       = request.data
    station_id = data.get('station_id') or data.get('station_code') or 'AWS-UG-001'
    station    = get_or_none(station_id)

    timestamp = parse_datetime(str(data.get('timestamp', '')))
    if timestamp is None:
        return api_response(error='timestamp is required and must be ISO format', status_code=400)

    fields = dict(
        pressure          = safe_float(data.get('pressure')),
        temperature       = safe_float(data.get('temperature')),
        humidity          = safe_float(data.get('humidity')),
        solar_radiation_v = safe_float(data.get('solar_radiation_v')),
        solar_radiation   = safe_float(data.get('solar_radiation') if data.get('solar_radiation') is not None else data.get('light')),
        soil_moisture_v   = safe_float(data.get('soil_moisture_v')),
        soil_moisture     = safe_float(data.get('soil_moisture')),
        rain              = safe_float(data.get('rain')),
        wind_speed        = safe_float(data.get('wind_speed')),
        wind_direction_v  = safe_float(data.get('wind_direction_v')),
        wind_direction    = safe_int(data.get('wind_direction')),
    )

    weather = WeatherReading.objects.create(
        station=station, station_code=station_id, timestamp=timestamp, **fields
    )

    # Dual-write: keep SensorReading in sync for existing dashboard/history/export
    reading, _ = SensorReading.objects.get_or_create(
        station_code=station_id, timestamp=timestamp,
        defaults={'station': station}
    )
    for k, v in fields.items():
        setattr(reading, k, v)
    reading.save()

    # Update StationStatus — per-sensor fault detection if available, else fallback.
    if station:
        prediction = call_ml_service(reading, station_id)

        if prediction and 'sensors' in prediction:
            # PARTIAL if any sensor is flagged faulty, otherwise FULL. The specific
            # faulty sensors and their reasons are kept in details for the dashboard.
            faulty = prediction.get('faulty_sensors', [])
            ml_status = (
                StationStatus.Status.PARTIAL if faulty
                else StationStatus.Status.FULL
            )
            StationStatus.objects.update_or_create(
                station=station,
                defaults={
                    'status':      ml_status,
                    'computed_by': 'ml_sensor_fault',
                    'details': {
                        'last_reading_id': reading.id,
                        'as_of':           prediction.get('as_of'),
                        'faulty_sensors':  faulty,
                        'sensors':         prediction.get('sensors', {}),
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

    return api_response({'status': 'ok', 'id': weather.id}, status_code=201)


@api_view(['POST'])
@permission_classes([AllowAny])
def ingest_voltage(request):
    """Channel 2 equivalent."""
    data       = request.data
    station_id = data.get('station_id') or data.get('station_code') or 'AWS-UG-001'
    station    = get_or_none(station_id)

    timestamp = parse_datetime(str(data.get('timestamp', '')))
    if timestamp is None:
        return api_response(error='timestamp is required and must be ISO format', status_code=400)

    fields = dict(
        volt_batt    = safe_float(data.get('volt_batt')),
        volt_solar   = safe_float(data.get('volt_solar')),
        battery_temp = safe_float(data.get('battery_temp')),
    )

    voltage = VoltageReading.objects.create(
        station=station, station_code=station_id, timestamp=timestamp, **fields
    )

    reading, _ = SensorReading.objects.get_or_create(
        station_code=station_id, timestamp=timestamp,
        defaults={'station': station}
    )
    for k, v in fields.items():
        setattr(reading, k, v)
    reading.save()

    return api_response({'status': 'ok', 'id': voltage.id}, status_code=201)


@api_view(['POST'])
@permission_classes([AllowAny])
def ingest_current(request):
    """Channel 3 equivalent."""
    data       = request.data
    station_id = data.get('station_id') or data.get('station_code') or 'AWS-UG-001'
    station    = get_or_none(station_id)

    timestamp = parse_datetime(str(data.get('timestamp', '')))
    if timestamp is None:
        return api_response(error='timestamp is required and must be ISO format', status_code=400)

    fields = dict(
        curr_batt  = safe_float(data.get('curr_batt')),
        curr_solar = safe_float(data.get('curr_solar')),
    )

    current = CurrentReading.objects.create(
        station=station, station_code=station_id, timestamp=timestamp, **fields
    )

    reading, _ = SensorReading.objects.get_or_create(
        station_code=station_id, timestamp=timestamp,
        defaults={'station': station}
    )
    for k, v in fields.items():
        setattr(reading, k, v)
    reading.save()

    return api_response({'status': 'ok', 'id': current.id}, status_code=201)

@csrf_exempt
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def sim_alert_email(request):
    """Send an email notification for a SIM alert (low data or expiring)."""
    import json
    try:
        body = json.loads(request.body) if isinstance(request.body, bytes) else request.data
    except (ValueError, AttributeError):
        body = request.data

    alert_type = body.get('type', 'unknown')
    station_name = body.get('station_name', 'Unknown Station')
    message = body.get('message', '')
    explanation = body.get('explanation', '')

    subject = f'[AWS Monitor] SIM Alert — {station_name}'
    email_message = (
        f'Station: {station_name}\n'
        f'Alert Type: {alert_type}\n'
        f'Message: {message}\n'
        f'Details: {explanation}\n\n'
        f'Please log in to the dashboard at {request.build_absolute_uri("/")}dashboard/sim-management '
        f'to take action.'
    )

    try:
        sent = send_mail(
            subject=subject,
            message=email_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[settings.NOTIFICATION_EMAIL],
            fail_silently=False,
        )
        logger.info(f'SIM alert email sent to {settings.NOTIFICATION_EMAIL}: {sent} email(s)')
        return JsonResponse({'success': True, 'sent': sent, 'to': settings.NOTIFICATION_EMAIL})
    except Exception as e:
        logger.error(f'Failed to send SIM alert email: {e}')
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


# ─────────────────────────────────────────────────────────
# API: Benchmark endpoint — AWS vs UNMA reference data
# ─────────────────────────────────────────────────────────

def _nearest_pairs(aws_points, benchmark_points, max_delta=datetime.timedelta(minutes=30)):
    """
    Matches each AWS (timestamp, value) point to the closest benchmark
    point within max_delta. Returns a list of (aws_value, benchmark_value)
    pairs. Benchmark points assumed small enough for a linear scan.
    """
    pairs = []
    for aws_ts, aws_val in aws_points:
        best = None
        best_delta = None
        for bench_ts, bench_val in benchmark_points:
            delta = abs(aws_ts - bench_ts)
            if delta <= max_delta and (best_delta is None or delta < best_delta):
                best = bench_val
                best_delta = delta
        if best is not None:
            pairs.append((aws_val, best))
    return pairs


def _pearson_correlation(xs, ys):
    """Pearson correlation coefficient for two equal-length lists. None if undefined."""
    n = len(xs)
    if n < 2:
        return None

    mean_x = sum(xs) / n
    mean_y = sum(ys) / n

    cov = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys))
    var_x = sum((x - mean_x) ** 2 for x in xs)
    var_y = sum((y - mean_y) ** 2 for y in ys)

    denom = math.sqrt(var_x * var_y)
    return (cov / denom) if denom else None


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def benchmark(request):
    """
    Compares AWS station readings against benchmark (e.g. UNMA) reference
    data for a given metric over a time window.
    """
    station_id = request.query_params.get('station_id')
    if not station_id:
        return api_response(error='station_id is required', status_code=400)

    hours  = int(request.query_params.get('hours', 168))
    metric = request.query_params.get('metric', 'temperature')
    source = request.query_params.get('source')

    valid_metrics = {
        'temperature', 'humidity', 'pressure', 'wind_speed',
        'wind_direction', 'rain', 'solar_radiation', 'soil_moisture',
    }
    if metric not in valid_metrics:
        return api_response(error=f'Invalid metric: {metric}', status_code=400)

    since = timezone.now() - datetime.timedelta(hours=hours)

    aws_qs = SensorReading.objects.filter(
        station_code=station_id,
        timestamp__gte=since,
    ).order_by('timestamp').values('timestamp', metric)

    bench_qs = BenchmarkReading.objects.filter(
        timestamp__gte=since,
    ).order_by('timestamp')
    if source:
        bench_qs = bench_qs.filter(source=source)
    bench_qs = bench_qs.values('timestamp', 'source', metric)

    aws_readings = [
        {'timestamp': r['timestamp'], 'value': r[metric]}
        for r in aws_qs if r[metric] is not None
    ]
    benchmark_readings = [
        {'timestamp': r['timestamp'], 'value': r[metric], 'source': r['source']}
        for r in bench_qs if r[metric] is not None
    ]

    aws_values = [r['value'] for r in aws_readings]
    benchmark_values = [r['value'] for r in benchmark_readings]

    aws_points = [(r['timestamp'], r['value']) for r in aws_readings]
    bench_points = [(r['timestamp'], r['value']) for r in benchmark_readings]
    pairs = _nearest_pairs(aws_points, bench_points)

    mae = (
        sum(abs(a - b) for a, b in pairs) / len(pairs)
        if pairs else None
    )
    correlation = (
        _pearson_correlation([a for a, _ in pairs], [b for _, b in pairs])
        if len(pairs) >= 2 else None
    )

    stats = {
        'aws_avg':             (sum(aws_values) / len(aws_values)) if aws_values else None,
        'aws_min':             min(aws_values) if aws_values else None,
        'aws_max':             max(aws_values) if aws_values else None,
        'benchmark_avg':       (sum(benchmark_values) / len(benchmark_values)) if benchmark_values else None,
        'benchmark_min':       min(benchmark_values) if benchmark_values else None,
        'benchmark_max':       max(benchmark_values) if benchmark_values else None,
        'mean_absolute_error': mae,
        'correlation':         correlation,
    }

    return api_response(data={
        'station_id':          station_id,
        'hours':               hours,
        'metric':              metric,
        'aws_readings':        aws_readings,
        'benchmark_readings':  benchmark_readings,
        'stats':               stats,
    })


# ─────────────────────────────────────────────────────────
# API: Benchmark CSV import — admin only
# ─────────────────────────────────────────────────────────

# CSV columns (besides the first "time" column) that map directly
# onto BenchmarkReading fields. Same as BenchmarkReadingAdmin.import_csv.
BENCHMARK_CSV_FIELDS = [
    'temperature', 'humidity', 'pressure', 'wind_speed',
    'wind_direction', 'rain', 'solar_radiation', 'soil_moisture',
]


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def benchmark_import(request):
    """
    Imports UNMA (or other) benchmark readings from an uploaded CSV.
    Admin only. Mirrors the parsing logic in BenchmarkReadingAdmin.import_csv
    so the Django admin and React upload flow behave identically.
    """
    if request.user.role != 'admin':
        return api_response(error='Admin access required', status_code=403)

    csv_file = request.FILES.get('file')
    if not csv_file:
        return api_response(error='file is required', status_code=400)

    source = request.data.get('source') or 'UNMA'
    location = request.data.get('location', '')

    decoded = io.TextIOWrapper(csv_file.file, encoding='utf-8-sig')
    reader = csv.reader(decoded)

    try:
        header = next(reader)
    except StopIteration:
        return api_response(error='CSV file is empty', status_code=400)

    # First column is the timestamp; remaining columns are matched by
    # name against BENCHMARK_CSV_FIELDS. Unknown columns are ignored;
    # known fields not present are skipped.
    field_columns = {}
    for idx, col_name in enumerate(header[1:], start=1):
        col_name = col_name.strip().lower()
        if col_name in BENCHMARK_CSV_FIELDS:
            field_columns[col_name] = idx

    readings = []
    skipped = 0
    for row in reader:
        if not row or not row[0].strip():
            continue

        timestamp = parse_datetime(row[0].strip())
        if timestamp is None:
            skipped += 1
            continue

        kwargs = {
            'source': source,
            'location': location,
            'timestamp': timestamp,
        }
        for field_name, col_idx in field_columns.items():
            if col_idx >= len(row):
                continue
            raw_value = row[col_idx].strip()
            if not raw_value:
                continue
            try:
                kwargs[field_name] = float(raw_value)
            except ValueError:
                pass

        readings.append(BenchmarkReading(**kwargs))

    BenchmarkReading.objects.bulk_create(readings, batch_size=500)

    return api_response(data={
        'imported': len(readings),
        'skipped':  skipped,
    })
# ── SIM Management APIs ──

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def sim_management_data(request):
    sims = SimCard.objects.select_related('station').all()
    
    total_active = 0
    expired_count = 0
    expiring_soon_count = 0
    total_remaining_mb = 0
    
    today = timezone.now().date()
    soon_threshold = today + datetime.timedelta(days=30)
    
    sims_data = []
    
    for sim in sims:
        is_expired = sim.expiry_date and sim.expiry_date < today
        is_active = not is_expired
        
        if is_active:
            total_active += 1
        else:
            expired_count += 1
            
        if sim.expiry_date and today <= sim.expiry_date <= soon_threshold:
            expiring_soon_count += 1
            
        usage = sim.data_used_mb or 0
        bundle = sim.data_limit_mb or 1024.0
        rem = max(0, bundle - usage)
        if is_active:
            total_remaining_mb += rem
            
        est_days = None
        if sim.expiry_date:
            diff = (sim.expiry_date - today).days
            est_days = max(0, diff)
            
        sims_data.append({
            'sim': {
                'id': sim.id,
                'iccid': sim.iccid or '',
                'carrier': 'MTN',
                'phone_number': sim.phone_number,
                'bundle_size_mb': bundle,
                'usage_mb': usage,
                'date_loaded': sim.date_loaded.isoformat() if sim.date_loaded else None,
                'expiry_date': sim.expiry_date.isoformat() if sim.expiry_date else None,
                'status': 'active' if is_active else 'inactive'
            },
            'station_name': sim.station.name if sim.station else 'Unknown',
            'station_id': sim.station.id if sim.station else None,
            'estimated_days_remaining': est_days,
            'projected_expiry_date': sim.expiry_date.isoformat() if sim.expiry_date else None,
            'forecast_confidence_note': 'Based on linear projection.' if est_days else 'Not enough data for projection.',
            'daily_usage': [],
            'top_up_history': []
        })
        
    return Response({
        'status': 'success',
        'data': {
            'sims': sims_data,
            'summary': {
                'total_active': total_active,
                'expired_count': expired_count,
                'expiring_soon_count': expiring_soon_count,
                'total_remaining_mb': total_remaining_mb,
                'expiring_soon_threshold_days': 30
            }
        }
    })

@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_sim_account(request, sim_id):
    from django.shortcuts import get_object_or_404
    sim = get_object_or_404(SimCard, id=sim_id)
    
    if 'date_loaded' in request.data:
        d = request.data['date_loaded']
        sim.date_loaded = d if d else None
    if 'expiry_date' in request.data:
        e = request.data['expiry_date']
        sim.expiry_date = e if e else None
        
    sim.save()
    
    is_expired = sim.expiry_date and sim.expiry_date < timezone.now().date()
    is_active = not is_expired
    
    return Response({
        'status': 'success',
        'data': {
            'id': sim.id,
            'iccid': sim.iccid or '',
            'carrier': 'MTN',
            'phone_number': sim.phone_number,
            'bundle_size_mb': sim.data_limit_mb or 1024.0,
            'usage_mb': sim.data_used_mb or 0,
            'date_loaded': sim.date_loaded.isoformat() if sim.date_loaded else None,
            'expiry_date': sim.expiry_date.isoformat() if sim.expiry_date else None,
            'status': 'active' if is_active else 'inactive'
        }
    })

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def topup_sim_account(request, sim_id):
    from django.shortcuts import get_object_or_404
    sim = get_object_or_404(SimCard, id=sim_id)
    amount_mb = request.data.get('amount_mb', 0)
    
    sim.data_limit_mb += float(amount_mb)
    sim.save()
    
    is_expired = sim.expiry_date and sim.expiry_date < timezone.now().date()
    is_active = not is_expired
    
    return Response({
        'status': 'success',
        'data': {
            'id': sim.id,
            'iccid': sim.iccid or '',
            'carrier': 'MTN',
            'phone_number': sim.phone_number,
            'bundle_size_mb': sim.data_limit_mb or 1024.0,
            'usage_mb': sim.data_used_mb or 0,
            'date_loaded': sim.date_loaded.isoformat() if sim.date_loaded else None,
            'expiry_date': sim.expiry_date.isoformat() if sim.expiry_date else None,
            'status': 'active' if is_active else 'inactive'
        }
    })
