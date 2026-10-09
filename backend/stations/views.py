import csv
import datetime
import io
import logging
import math
import os

from django.db import models, transaction
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

from .models import (
    Station, StationStatus, SensorReading, WeatherReading,
    VoltageReading, CurrentReading, BenchmarkReading, BenchmarkDataset, SimCard,
    WeatherMinute
)
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
    BenchmarkDatasetSerializer,
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


def parse_aware_datetime(dt_str):
    """Parse a datetime string and ensure it is timezone-aware in Africa/Kampala (UTC+3)."""
    if not dt_str:
        return None
    dt = parse_datetime(str(dt_str).strip())
    if dt is not None and timezone.is_naive(dt):
        dt = timezone.make_aware(dt, timezone.get_current_timezone())
    return dt


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

        timestamp = parse_aware_datetime(parsed.get('Time', ''))
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

        timestamp = parse_aware_datetime(str(data.get('timestamp', '')))
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
    Expects ?station_ids=AWS-001,AWS-002&hours=24&limit=5000 or ?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
    """
    station_ids_str = request.query_params.get('station_ids', '')
    if not station_ids_str:
        return api_response(error='station_ids is required', status_code=400)
    
    station_ids = [s.strip() for s in station_ids_str.split(',') if s.strip()]
    hours = int(request.query_params.get('hours')) if request.query_params.get('hours') else None
    limit = int(request.query_params.get('limit', 5000))
    start_str = request.query_params.get('start_date') or request.query_params.get('date_from') or request.query_params.get('from')
    end_str   = request.query_params.get('end_date') or request.query_params.get('date_to') or request.query_params.get('to')

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

    qs = SensorReading.objects.filter(query)

    if start_str and end_str:
        try:
            s_d = datetime.date.fromisoformat(start_str[:10])
            s_dt = timezone.make_aware(datetime.datetime.combine(s_d, datetime.time.min)) if timezone.is_naive(datetime.datetime.combine(s_d, datetime.time.min)) else datetime.datetime.combine(s_d, datetime.time.min)
            e_d = datetime.date.fromisoformat(end_str[:10])
            e_dt = timezone.make_aware(datetime.datetime.combine(e_d, datetime.time.max)) if timezone.is_naive(datetime.datetime.combine(e_d, datetime.time.max)) else datetime.datetime.combine(e_d, datetime.time.max)
            qs = qs.filter(timestamp__gte=s_dt, timestamp__lte=e_dt)
        except Exception:
            if hours:
                since = timezone.now() - datetime.timedelta(hours=hours)
                qs = qs.filter(timestamp__gte=since)
    elif hours:
        since = timezone.now() - datetime.timedelta(hours=hours)
        qs = qs.filter(timestamp__gte=since)

    readings = qs.order_by('-timestamp')[:limit]
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
    hours      = int(request.query_params.get('hours')) if request.query_params.get('hours') else None
    limit      = int(request.query_params.get('limit', 5000))
    chart_type = request.query_params.get('type', 'sensor')
    start_str  = request.query_params.get('start_date') or request.query_params.get('date_from') or request.query_params.get('from')
    end_str    = request.query_params.get('end_date') or request.query_params.get('date_to') or request.query_params.get('to')

    # Resolve station_id if numeric ID (e.g. 1 -> "AWS-001")
    code = station_id
    if str(station_id).isdigit():
        st = Station.objects.filter(id=station_id).first()
        if st:
            code = st.station_id

    query = models.Q(station_code=code) | models.Q(station_code=station_id)
    if str(station_id).isdigit():
        query |= models.Q(station__id=int(station_id))

    qs = SensorReading.objects.filter(query)

    if start_str and end_str:
        try:
            s_d = datetime.date.fromisoformat(start_str[:10])
            s_dt = timezone.make_aware(datetime.datetime.combine(s_d, datetime.time.min)) if timezone.is_naive(datetime.datetime.combine(s_d, datetime.time.min)) else datetime.datetime.combine(s_d, datetime.time.min)
            e_d = datetime.date.fromisoformat(end_str[:10])
            e_dt = timezone.make_aware(datetime.datetime.combine(e_d, datetime.time.max)) if timezone.is_naive(datetime.datetime.combine(e_d, datetime.time.max)) else datetime.datetime.combine(e_d, datetime.time.max)
            qs = qs.filter(timestamp__gte=s_dt, timestamp__lte=e_dt)
        except Exception:
            if hours:
                since = timezone.now() - datetime.timedelta(hours=hours)
                qs = qs.filter(timestamp__gte=since)
    elif hours:
        since = timezone.now() - datetime.timedelta(hours=hours)
        qs = qs.filter(timestamp__gte=since)

    readings = qs.order_by('-timestamp')[:limit]

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

def _format_csv_datetime(val):
    """
    Format datetime into a clean, simple representation for CSV exports:
    YYYY-MM-DD HH:MM:SS (e.g. 2026-09-30 08:46:46) in Africa/Kampala local time.
    """
    if not val:
        return ''
    if isinstance(val, (datetime.datetime, datetime.date)):
        dt = val
    else:
        s_val = str(val).strip()
        if len(s_val) == 19 and s_val[10] == ' ' and s_val[4] == '-' and s_val[7] == '-' and s_val[13] == ':' and s_val[16] == ':':
            return s_val
        dt = parse_datetime(s_val)
        if dt is None:
            if 'T' in s_val:
                parts = s_val.split('T')
                if len(parts) == 2:
                    date_part = parts[0]
                    time_part = parts[1].split('+')[0].split('-')[0].rstrip('Z').split('.')[0]
                    return f"{date_part} {time_part}"
            return s_val

    tz = timezone.get_current_timezone()
    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt, tz)
    else:
        dt = dt.astimezone(tz)
    return dt.strftime('%Y-%m-%d %H:%M:%S')


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
        for raw_row in serializer.data:
            row = dict(raw_row)
            for key in ('timestamp', 'received_at'):
                if key in row and row[key]:
                    row[key] = _format_csv_datetime(row[key])
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
    station_id = data.get('station_id') or data.get('station_code', 'AWS-UG-001')
    station    = get_or_none(station_id)

    timestamp = parse_aware_datetime(str(data.get('timestamp', '')))
    if timestamp is None:
        return api_response(error='timestamp is required and must be ISO format', status_code=400)

    wind_pulses = data.get('wind_pulses', [])
    rain_tips   = data.get('rain_tips', [])
    if len(wind_pulses) != len(rain_tips):
        return api_response(error='wind_pulses and rain_tips arrays must be the same length', status_code=400)

    bucket_s   = data.get('bucket_s', 60)
    interval_s = data.get('interval_s')
    
    # Calculate denormalized totals
    wind_pulses_total = sum(wind_pulses) if wind_pulses else None
    rain_tips_total   = sum(rain_tips) if rain_tips else None

    # Server-side conversion formulas from raw counts if payload values are missing
    # Rain (mm): total tips * 0.2 mm
    rain_val = safe_float(data.get('rain'))
    if rain_val is None and rain_tips_total is not None:
        rain_val = round(rain_tips_total * 0.2, 2)

    # Wind Speed (m/s): (total_pulses / total_seconds) * 0.67 m/s
    wind_speed_val = safe_float(data.get('wind_speed'))
    if wind_speed_val is None and wind_pulses_total is not None and interval_s:
        wind_speed_val = round((wind_pulses_total / interval_s) * 0.67, 2)

    # Gust Guard Rule: If gust_count == 0, no 3-second gust window closed. 
    # Store None rather than fallback mean values.
    gust_count   = safe_int(data.get('gust_count'))
    gust_span_ms = safe_int(data.get('gust_span_ms'))
    wind_gust    = safe_float(data.get('wind_gust'))

    if gust_count == 0:
        gust_count   = None
        gust_span_ms = None
        wind_gust    = None

    fields = dict(
        pressure          = safe_float(data.get('pressure')),
        temperature       = safe_float(data.get('temperature')),
        humidity          = safe_float(data.get('humidity')),
        solar_radiation_v = safe_float(data.get('solar_radiation_v')),
        solar_radiation   = safe_float(data.get('solar_radiation')),
        soil_moisture_v   = safe_float(data.get('soil_moisture_v')),
        soil_moisture     = safe_float(data.get('soil_moisture')),
        rain              = rain_val,
        wind_speed        = wind_speed_val,
        wind_direction_v  = safe_float(data.get('wind_direction_v')),
        wind_direction    = safe_int(data.get('wind_direction')),
        interval_s        = safe_int(data.get('interval_s')),
        wind_gust         = wind_gust,
        gust_count        = gust_count,
        gust_span_ms      = gust_span_ms,
        wind_pulses_total = wind_pulses_total,
        rain_tips_total   = rain_tips_total,
    )

    with transaction.atomic():
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

        if wind_pulses and interval_s:
            start = timestamp - datetime.timedelta(seconds=safe_int(interval_s) or 0)
            minute_rows = []
            for i, (w, t) in enumerate(zip(wind_pulses, rain_tips)):
                m_start = start + datetime.timedelta(seconds=i * bucket_s)
                span = bucket_s if i < len(wind_pulses) - 1 else int((timestamp - m_start).total_seconds())
                minute_rows.append(WeatherMinute(
                    weather_reading=weather, sensor_reading=reading,
                    station_code=station_id, minute_start=m_start,
                    span_s=span, wind_pulses=w, rain_tips=t
                ))
            WeatherMinute.objects.bulk_create(minute_rows, ignore_conflicts=True)

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

    timestamp = parse_aware_datetime(str(data.get('timestamp', '')))
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

    timestamp = parse_aware_datetime(str(data.get('timestamp', '')))
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

def _nearest_pairs(aws_points, benchmark_points, max_delta=datetime.timedelta(minutes=35)):
    """
    Matches each benchmark reference reading (e.g. UNMA record) to the single
    closest AWS reading within max_delta. With AWS stations reporting every
    15-20 minutes, a 35-minute window finds the exact matching AWS cycle.
    Returns a list of (aws_value, benchmark_value) pairs.
    """
    pairs = []
    for bench_ts, bench_val in benchmark_points:
        best = None
        best_delta = None
        for aws_ts, aws_val in aws_points:
            delta = abs(aws_ts - bench_ts)
            if delta <= max_delta and (best_delta is None or delta < best_delta):
                best = aws_val
                best_delta = delta
        if best is not None:
            pairs.append((best, bench_val))
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
def benchmark_datasets_list(request):
    """
    Returns all uploaded benchmark reference datasets with metadata and date ranges.
    """
    datasets = BenchmarkDataset.objects.all().order_by('-uploaded_at')
    return api_response(data=BenchmarkDatasetSerializer(datasets, many=True).data)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def benchmark_dataset_detail(request, dataset_id):
    """
    Deletes a BenchmarkDataset, its uploaded CSV file, and all associated readings (CASCADE).
    Admin only.
    """
    if getattr(request.user, 'role', None) != 'admin':
        return api_response(error='Admin access required', status_code=403)

    try:
        dataset = BenchmarkDataset.objects.get(id=dataset_id)
    except BenchmarkDataset.DoesNotExist:
        return api_response(error='Dataset not found', status_code=404)

    if dataset.csv_file:
        try:
            dataset.csv_file.delete(save=False)
        except Exception:
            pass

    dataset.delete()
    return api_response(message='Dataset deleted successfully')


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def benchmark(request):
    """
    Compares AWS station readings against benchmark (e.g. UNMA) reference
    data for a given metric over a selectable benchmarking period.
    """
    station_id = request.query_params.get('station_id')
    if not station_id:
        return api_response(error='station_id is required', status_code=400)

    dataset_id = request.query_params.get('dataset_id')
    location   = request.query_params.get('location')
    source     = request.query_params.get('source')
    metric     = request.query_params.get('metric', 'temperature')

    valid_metrics = {
        'temperature', 'humidity', 'pressure', 'wind_speed',
        'wind_direction', 'rain', 'solar_radiation', 'soil_moisture',
    }
    if metric not in valid_metrics:
        return api_response(error=f'Invalid metric: {metric}', status_code=400)

    date_from_str = request.query_params.get('date_from') or request.query_params.get('start_date') or request.query_params.get('from')
    date_to_str   = request.query_params.get('date_to') or request.query_params.get('end_date') or request.query_params.get('to')
    hours_param   = request.query_params.get('hours')

    kampala_tz = timezone.get_current_timezone()

    start_dt = None
    end_dt   = None
    if date_from_str and date_to_str:
        try:
            s_d = datetime.date.fromisoformat(date_from_str[:10])
            e_d = datetime.date.fromisoformat(date_to_str[:10])
            start_dt = timezone.make_aware(datetime.datetime.combine(s_d, datetime.time.min), kampala_tz)
            end_dt   = timezone.make_aware(datetime.datetime.combine(e_d, datetime.time.max), kampala_tz)
        except Exception:
            start_dt = None
            end_dt   = None

    if start_dt is None or end_dt is None:
        hours = int(hours_param) if hours_param else 168
        start_dt = timezone.now() - datetime.timedelta(hours=hours)
        end_dt   = timezone.now()

    # Resolve station_id if numeric ID (e.g. 1 -> "AWS-001")
    code = station_id
    if str(station_id).isdigit():
        st = Station.objects.filter(id=station_id).first()
        if st:
            code = st.station_id

    aws_qs = SensorReading.objects.filter(
        models.Q(station_code=code) | models.Q(station_code=station_id),
        timestamp__gte=start_dt,
        timestamp__lte=end_dt,
    ).order_by('timestamp').values('timestamp', metric)

    bench_qs = BenchmarkReading.objects.filter(
        timestamp__gte=start_dt,
        timestamp__lte=end_dt,
    ).order_by('timestamp')

    if dataset_id:
        bench_qs = bench_qs.filter(dataset_id=dataset_id)
    elif location:
        bench_qs = bench_qs.filter(location__iexact=location)
    elif source:
        bench_qs = bench_qs.filter(source=source)

    bench_qs = bench_qs.values('timestamp', 'source', 'location', metric)

    aws_readings = [
        {'timestamp': _format_csv_datetime(r['timestamp']), 'value': r[metric], '_dt': r['timestamp']}
        for r in aws_qs if r[metric] is not None
    ]
    benchmark_readings = [
        {'timestamp': _format_csv_datetime(r['timestamp']), 'value': r[metric], 'source': r.get('source'), 'location': r.get('location'), '_dt': r['timestamp']}
        for r in bench_qs if r[metric] is not None
    ]

    aws_values = [r['value'] for r in aws_readings]
    benchmark_values = [r['value'] for r in benchmark_readings]

    aws_points = [(r['_dt'], r['value']) for r in aws_readings]
    bench_points = [(r['_dt'], r['value']) for r in benchmark_readings]
    pairs = _nearest_pairs(aws_points, bench_points, max_delta=datetime.timedelta(hours=2))

    mae = (
        sum(abs(a - b) for a, b in pairs) / len(pairs)
        if pairs else None
    )
    correlation = (
        _pearson_correlation([a for a, _ in pairs], [b for _, b in pairs])
        if len(pairs) >= 2 else None
    )

    aws_avg = round(sum(aws_values) / len(aws_values), 2) if aws_values else None
    bench_avg = round(sum(benchmark_values) / len(benchmark_values), 2) if benchmark_values else None
    bias = round(aws_avg - bench_avg, 2) if (aws_avg is not None and bench_avg is not None) else None

    stats = {
        'aws_avg':             aws_avg,
        'aws_min':             min(aws_values) if aws_values else None,
        'aws_max':             max(aws_values) if aws_values else None,
        'benchmark_avg':       bench_avg,
        'benchmark_min':       min(benchmark_values) if benchmark_values else None,
        'benchmark_max':       max(benchmark_values) if benchmark_values else None,
        'bias':                bias,
        'mean_absolute_error': round(mae, 3) if mae is not None else None,
        'correlation':         round(correlation, 3) if correlation is not None else None,
        'pair_count':          len(pairs),
    }

    # Clean up internal datetime object before returning
    for r in aws_readings:
        r.pop('_dt', None)
    for r in benchmark_readings:
        r.pop('_dt', None)

    return api_response(data={
        'station_id':          station_id,
        'dataset_id':          dataset_id,
        'location':            location,
        'date_from':           _format_csv_datetime(start_dt),
        'date_to':             _format_csv_datetime(end_dt),
        'metric':              metric,
        'aws_readings':        aws_readings,
        'benchmark_readings':  benchmark_readings,
        'stats':               stats,
    })


# ─────────────────────────────────────────────────────────
# API: Benchmark CSV import — admin only
# ─────────────────────────────────────────────────────────

BENCHMARK_CSV_FIELDS = [
    'temperature', 'humidity', 'pressure', 'wind_speed',
    'wind_direction', 'rain', 'solar_radiation', 'soil_moisture',
]


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def benchmark_import(request):
    """
    Imports UNMA (or other) benchmark readings from an uploaded CSV.
    Admin only. Creates a BenchmarkDataset and bulk-creates associated readings.
    """
    if request.user.role != 'admin':
        return api_response(error='Admin access required', status_code=403)

    csv_file = request.FILES.get('file')
    if not csv_file:
        return api_response(error='file is required', status_code=400)

    location = (request.data.get('location') or '').strip()
    if not location:
        return api_response(error='location is required', status_code=400)

    source = (request.data.get('source') or 'UNMA').strip()
    dataset_name = (request.data.get('name') or f"{source} - {location} ({csv_file.name})").strip()

    dataset = BenchmarkDataset.objects.create(
        name=dataset_name,
        location=location,
        source=source,
        csv_file=csv_file,
        uploaded_by=request.user if request.user.is_authenticated else None,
    )

    csv_file.seek(0)
    decoded = io.TextIOWrapper(csv_file.file, encoding='utf-8-sig')
    reader = csv.reader(decoded)

    try:
        header = next(reader)
    except StopIteration:
        dataset.delete()
        return api_response(error='CSV file is empty', status_code=400)

    field_columns = {}
    for idx, col_name in enumerate(header[1:], start=1):
        col_name = col_name.strip().lower()
        if col_name in BENCHMARK_CSV_FIELDS:
            field_columns[col_name] = idx

    readings = []
    skipped = 0
    min_ts = None
    max_ts = None
    kampala_tz = timezone.get_current_timezone()

    for row in reader:
        if not row or not row[0].strip():
            continue

        raw_ts = row[0].strip()
        timestamp = parse_datetime(raw_ts)
        if timestamp is None:
            timestamp = parse_aware_datetime(raw_ts)
        if timestamp is None:
            skipped += 1
            continue

        if timezone.is_naive(timestamp):
            timestamp = timezone.make_aware(timestamp, kampala_tz)
        else:
            timestamp = timestamp.astimezone(kampala_tz)

        if min_ts is None or timestamp < min_ts:
            min_ts = timestamp
        if max_ts is None or timestamp > max_ts:
            max_ts = timestamp

        kwargs = {
            'dataset': dataset,
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

    if readings:
        BenchmarkReading.objects.bulk_create(readings, batch_size=500)
        dataset.start_date = min_ts
        dataset.end_date   = max_ts
        dataset.row_count  = len(readings)
        dataset.save(update_fields=['start_date', 'end_date', 'row_count'])

    return api_response(data={
        'dataset':  BenchmarkDatasetSerializer(dataset).data,
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
