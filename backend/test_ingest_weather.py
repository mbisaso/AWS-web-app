"""
Healthy Weather Ingestion Test Script
Sends realistic weather data using Uganda elevation pressure (~890 hPa) and solar voltage (~0.00005 V)
to demonstrate all 3 stations achieving 100% HEALTHY (FULL) status from the ML model.
"""

import os
import sys
import datetime
import json

# Setup Django environment
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aws_dashboard.settings')

import django
django.setup()

from django.conf import settings
if 'testserver' not in settings.ALLOWED_HOSTS:
    settings.ALLOWED_HOSTS.append('testserver')

from django.utils import timezone
from rest_framework.test import APIClient
from stations.models import Station, StationStatus, WeatherReading, SensorReading

STATIONS_TO_TEST = [
    {"code": "AWS-001", "name": "Makerere Station"},
    {"code": "AWS-002", "name": "KYA Station"},
    {"code": "AWS-003", "name": "Masaka Station"},
]

def run_healthy_station_test():
    print("=" * 75)
    print("TESTING PERFECT HEALTHY WEATHER DATA INGESTION (Target Status: FULL)")
    print("=" * 75)

    client = APIClient()
    now = timezone.now()

    # Weather series calibrated for Uganda AWS stations:
    # Elevation pressure: ~890.5 hPa (Kampala/Kyambogo/Masaka elevation ~1,200m)
    # Solar voltage proxy: ~0.00003 - 0.00008 V
    healthy_series = [
        {"temp": 22.1, "hum": 80.0, "press": 890.1, "w_spd": 0.45, "w_dir": 190, "light": 0.00003, "soil": 5.8, "rain": 0},
        {"temp": 22.4, "hum": 79.2, "press": 890.3, "w_spd": 0.48, "w_dir": 192, "light": 0.00004, "soil": 5.75, "rain": 0},
        {"temp": 22.8, "hum": 78.5, "press": 890.5, "w_spd": 0.52, "w_dir": 195, "light": 0.00005, "soil": 5.70, "rain": 0},
        {"temp": 23.3, "hum": 77.1, "press": 890.7, "w_spd": 0.55, "w_dir": 198, "light": 0.00006, "soil": 5.65, "rain": 0},
        {"temp": 23.9, "hum": 76.8, "press": 890.9, "w_spd": 0.58, "w_dir": 202, "light": 0.00007, "soil": 5.60, "rain": 0},
        {"temp": 24.5, "hum": 75.0, "press": 891.1, "w_spd": 0.62, "w_dir": 205, "light": 0.00008, "soil": 5.55, "rain": 0},
    ]

    for s_info in STATIONS_TO_TEST:
        code = s_info["code"]
        name = s_info["name"]

        print("\n" + "=" * 70)
        print(f"SENDING HEALTHY WEATHER SERIES TO: {name} ({code})")
        print("=" * 70)

        # Clear old readings for clean evaluation
        WeatherReading.objects.filter(station_code=code).delete()
        SensorReading.objects.filter(station_code=code).delete()
        
        station, _ = Station.objects.get_or_create(
            station_id=code,
            defaults={'name': name, 'location': 'Uganda'}
        )

        # Post the series of readings spaced 15 minutes apart
        for idx, item in enumerate(healthy_series):
            t = now - datetime.timedelta(minutes=(len(healthy_series) - idx) * 15)
            payload = {
                "station_id": code,
                "timestamp": t.isoformat(),
                "temperature": item["temp"],
                "humidity": item["hum"],
                "pressure": item["press"],
                "wind_speed": item["w_spd"],
                "wind_direction": item["w_dir"],
                "light": item["light"],
                "soil_moisture": item["soil"],
                "rain": item["rain"]
            }
            client.post('/api/ingest/weather/', data=json.dumps(payload), content_type='application/json')

    # Summary Table of Results
    print("\n" + "=" * 75)
    print("FINAL DATABASE SUMMARY: HEALTHY WEATHER INGESTION TEST")
    print("=" * 75)
    print(f"{'STATION NAME':<22} | {'CODE':<10} | {'STATUS':<10} | {'FAULTY SENSORS':<30}")
    print("-" * 75)

    for s_info in STATIONS_TO_TEST:
        code = s_info["code"]
        name = s_info["name"]
        st = Station.objects.filter(station_id=code).first()
        st_status = StationStatus.objects.filter(station=st).first() if st else None

        if st_status:
            status_str = st_status.status.upper()
            faults = st_status.details.get('faulty_sensors', [])
            faults_str = ", ".join(faults) if faults else "None (100% HEALTHY)"
        else:
            status_str = "UNKNOWN"
            faults_str = "N/A"

        print(f"{name:<22} | {code:<10} | {status_str:<10} | {faults_str:<30}")

    print("=" * 75 + "\n")

if __name__ == "__main__":
    run_healthy_station_test()
