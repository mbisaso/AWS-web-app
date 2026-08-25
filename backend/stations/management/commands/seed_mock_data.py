import math
import random
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from stations.models import Station, StationStatus, SensorReading

MOCK_STATIONS = [
    {
        "station_id": "AWS-UG-002",
        "name": "Kabale Weather Station",
        "location": "Kabale District, Western Uganda",
        "latitude": -1.2486,
        "longitude": 29.9897,
        "expected_interval_minutes": 15,
    },
    {
        "station_id": "AWS-UG-003",
        "name": "Gulu Weather Station",
        "location": "Gulu District, Northern Uganda",
        "latitude": 2.7747,
        "longitude": 32.2990,
        "expected_interval_minutes": 15,
    },
    {
        "station_id": "AWS-UG-004",
        "name": "Jinja Weather Station",
        "location": "Jinja District, Eastern Uganda",
        "latitude": 0.4244,
        "longitude": 33.2042,
        "expected_interval_minutes": 15,
    },
]

DAYS_OF_HISTORY = 7


class Command(BaseCommand):
    help = "Seeds 3 mock stations with realistic multi-day hourly sensor and power readings."

    def handle(self, *args, **options):
        now = timezone.now()

        for station_def in MOCK_STATIONS:
            station, created = Station.objects.get_or_create(
                station_id=station_def["station_id"],
                defaults={
                    "name": station_def["name"],
                    "location": station_def["location"],
                    "latitude": station_def["latitude"],
                    "longitude": station_def["longitude"],
                    "expected_interval_minutes": station_def["expected_interval_minutes"],
                },
            )
            action = "Created" if created else "Found existing"
            self.stdout.write(f"{action} station: {station.name} ({station.station_id})")

            # Clear out previously seeded mock readings for this station only,
            # so the command is safe to re-run without duplicating data.
            deleted_count, _ = SensorReading.objects.filter(
                station_code=station.station_id
            ).delete()
            if deleted_count:
                self.stdout.write(f"  Cleared {deleted_count} previous mock readings")

            readings = []
            total_hours = DAYS_OF_HISTORY * 24

            # Slowly-varying state across the loop, so battery/soil moisture
            # don't jump randomly between consecutive hours.
            battery_voltage = 12.6
            soil_moisture_v = 2.8

            for hours_ago in range(total_hours, 0, -1):
                ts = now - timedelta(hours=hours_ago)
                hour_of_day = ts.hour + ts.minute / 60

                # Diurnal cycle: peak around 2pm, trough around 4am
                day_phase = math.sin((hour_of_day - 8) / 24 * 2 * math.pi)

                temperature = 22 + 6 * day_phase + random.uniform(-0.8, 0.8)
                humidity = 70 - 25 * day_phase + random.uniform(-3, 3)
                humidity = max(20, min(95, humidity))
                pressure = 1012 + random.uniform(-2, 2)

                # Solar Radiation: zero at night, bell-curve peak at midday (W/m²)
                if 6 <= hour_of_day <= 18:
                    solar_rad = max(0, 950 * math.sin((hour_of_day - 6) / 12 * math.pi))
                else:
                    solar_rad = 0
                solar_rad = max(0, solar_rad + random.uniform(-10, 15))
                solar_radiation_v = round((solar_rad / 1000.0) * 2.5, 3)

                wind_speed = max(0, 4 + 3 * math.sin(hour_of_day / 24 * 4 * math.pi) + random.uniform(-1.5, 1.5))
                wind_direction = random.randint(0, 359)
                wind_direction_v = round((wind_direction / 360.0) * 3.3, 2)

                # Occasional rain events: ~5% chance per hour, more likely afternoon
                rain_chance = 0.08 if 13 <= hour_of_day <= 18 else 0.03
                rain = random.randint(1, 8) if random.random() < rain_chance else 0

                # Soil moisture drifts slowly, rises after rain
                soil_moisture_v += random.uniform(-0.05, 0.05)
                if rain > 0:
                    soil_moisture_v += 0.3
                soil_moisture_v = max(1.5, min(4.0, soil_moisture_v))
                soil_moisture_pct = round(max(5.0, min(95.0, (soil_moisture_v - 1.0) / 3.0 * 100)), 1)

                # Power: solar charges battery during daylight, drains slowly at night
                volt_solar = round(max(0, (solar_rad / 900) * 18.0 + random.uniform(0, 0.5)), 2)
                if solar_rad > 50:
                    battery_voltage += 0.015
                else:
                    battery_voltage -= 0.01
                battery_voltage = max(11.0, min(13.2, battery_voltage))

                curr_solar = round(max(0, (solar_rad / 900) * 1.5 + random.uniform(0, 0.05)), 2)
                curr_batt = round(0.35 + random.uniform(-0.02, 0.05), 2)
                battery_temp = round(temperature + random.uniform(1.0, 4.0), 1)

                readings.append(SensorReading(
                    station=station,
                    station_code=station.station_id,
                    timestamp=ts,
                    pressure=round(pressure, 2),
                    temperature=round(temperature, 2),
                    humidity=round(humidity, 2),
                    solar_radiation_v=solar_radiation_v,
                    solar_radiation=round(solar_rad, 1),
                    soil_moisture_v=round(soil_moisture_v, 2),
                    soil_moisture=soil_moisture_pct,
                    rain=rain,
                    wind_speed=round(wind_speed, 2),
                    wind_direction_v=wind_direction_v,
                    wind_direction=wind_direction,
                    volt_batt=round(battery_voltage, 2),
                    volt_solar=volt_solar,
                    battery_temp=battery_temp,
                    curr_batt=curr_batt,
                    curr_solar=curr_solar,
                ))

            SensorReading.objects.bulk_create(readings)
            self.stdout.write(f"  Inserted {len(readings)} readings ({DAYS_OF_HISTORY} days hourly)")

            StationStatus.objects.update_or_create(
                station=station,
                defaults={
                    "status": StationStatus.Status.FULL,
                    "details": {"seeded": True, "seed_command": "seed_mock_data"},
                    "computed_by": "seed_mock_data",
                },
            )

        self.stdout.write(self.style.SUCCESS("Mock data seeding complete."))