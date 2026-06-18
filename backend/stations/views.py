from django.contrib.auth.decorators import login_required
from django.shortcuts import render
from django.views.generic import TemplateView
from django.contrib.auth.mixins import LoginRequiredMixin
from django.utils.dateparse import parse_datetime

from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status

from .models import Station, StationStatus, SensorReading

import math


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


# ─────────────────────────────────────────────────────────
# API: Ingest endpoint — ESP32 posts data here
# ─────────────────────────────────────────────────────────

@api_view(['POST'])
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
                status=status.HTTP_400_BAD_REQUEST
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
            return Response(
                {'error': 'timestamp is required and must be ISO format'},
                status=status.HTTP_400_BAD_REQUEST
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

    # Update StationStatus to FULL if station is registered
    if station:
        StationStatus.objects.update_or_create(
            station=station,
            defaults={
                'status':  StationStatus.Status.FULL,
                'details': {'last_reading_id': reading.id}
            }
        )

    return Response(
        {'status': 'ok', 'id': reading.id},
        status=status.HTTP_201_CREATED
    )


# ─────────────────────────────────────────────────────────
# API: Latest reading per station
# ─────────────────────────────────────────────────────────

@api_view(['GET'])
def latest(request):
    """
    Returns the most recent reading for every station.
    Used by the React dashboard to show current conditions.
    """
    # Get distinct station_ids and their latest reading
    station_codes = SensorReading.objects.values_list(
        'station_code', flat=True
    ).distinct()

    results = []
    for sid in station_codes:
        reading = SensorReading.objects.filter(
            station_code=sid
        ).order_by('-timestamp').first()

        if reading:
            results.append({
                'station_code':   reading.station_code,
                'timestamp':      reading.timestamp,
                'received_at':    reading.received_at,
                'temperature':    reading.temperature,
                'humidity':       reading.humidity,
                'pressure':       reading.pressure,
                'altitude':       reading.altitude,
                'light':          reading.light,
                'soil_moisture':  reading.soil_moisture,
                'rain':           reading.rain,
                'wind_speed':     reading.wind_speed,
                'wind_direction': reading.wind_direction,
                'volt_3v3':       reading.volt_3v3,
                'volt_5v':        reading.volt_5v,
                'volt_batt':      reading.volt_batt,
                'volt_solar':     reading.volt_solar,
                'volt_dc':        reading.volt_dc,
                'curr_batt':      reading.curr_batt,
                'curr_solar':     reading.curr_solar,
            })

    return Response(results)


# ─────────────────────────────────────────────────────────
# API: Historical readings for a station
# ─────────────────────────────────────────────────────────

@api_view(['GET'])
def history(request, station_id):
    """
    Returns historical readings for a specific station.
    Used by React charts.

    Query params:
    ?hours=24       → last 24 hours (default)
    ?hours=168      → last 7 days
    ?limit=100      → max rows returned (default 200)

    Example:
    GET /api/stations/AWS-UG-001/history/?hours=24
    """
    from django.utils import timezone
    from datetime import timedelta

    hours = int(request.query_params.get('hours', 24))
    limit = int(request.query_params.get('limit', 200))
    since = timezone.now() - timedelta(hours=hours)

    readings = SensorReading.objects.filter(
        station_code=station_id,
        timestamp__gte=since
    ).order_by('timestamp')[:limit]

    results = [
        {
            'timestamp':      r.timestamp,
            'temperature':    r.temperature,
            'humidity':       r.humidity,
            'pressure':       r.pressure,
            'light':          r.light,
            'soil_moisture':  r.soil_moisture,
            'rain':           r.rain,
            'wind_speed':     r.wind_speed,
            'wind_direction': r.wind_direction,
            'volt_batt':      r.volt_batt,
            'volt_solar':     r.volt_solar,
            'curr_batt':      r.curr_batt,
            'curr_solar':     r.curr_solar,
        }
        for r in readings
    ]

    return Response(results)