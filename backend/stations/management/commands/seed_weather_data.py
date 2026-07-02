import random
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from stations.models import Station, SensorReading


def _clamp(v, lo, hi):
    return max(lo, min(hi, round(v, 2)))


# Realistic Kampala weather baselines
BASE_TEMP = 24.0       # °C
BASE_HUM = 72.0        # %
BASE_PRESS = 1013.0    # hPa
BASE_WSPD = 8.0        # km/h
BASE_LIGHT = 400.0     # lux (daytime peak)
BASE_SOIL = 2.8        # V


def _reading_value(base, amp, noise=0.15):
    return base + amp * (random.random() - 0.5) + random.gauss(0, noise)


def _sine_offset(hours_index, period=24, amplitude=1.5):
    """diurnal cycle — cooler at night, warmer at day"""
    return amplitude * ((hours_index % period) / period - 0.5) * 2


def generate_reading(station: Station, dt):
    hour = dt.hour
    is_day = 6 <= hour <= 18

    diurnal = _sine_offset(hour, 24, 2.0)

    temp = _clamp(BASE_TEMP + diurnal + random.gauss(0, 0.4), 16, 40)
    hum = _clamp(BASE_HUM - diurnal * 1.5 + random.gauss(0, 1), 30, 100)
    press = _clamp(BASE_PRESS + random.gauss(0, 0.8), 990, 1035)
    wspd = _clamp(BASE_WSPD + random.gauss(0, 1.5), 0, 25)
    wdir = random.randint(0, 360)
    rain = 0
    light = _clamp(BASE_LIGHT * (1 if is_day else 0.02) * random.uniform(0.5, 1.0), 0, 1200) if is_day else 0
    soil = _clamp(BASE_SOIL + random.gauss(0, 0.15), 1.5, 4.0)

    v33 = _clamp(3.36 + random.gauss(0, 0.02), 3.2, 3.5)
    v5 = _clamp(4.82 + random.gauss(0, 0.03), 4.5, 5.2)
    vbatt = _clamp(11.32 + random.gauss(0, 0.2), 10.5, 12.8)
    vsol = _clamp(1.02 + random.gauss(0, 0.1), 0, 5.0)
    vdc = _clamp(1.02 + random.gauss(0, 0.1), 0, 5.0)
    cbatt = _clamp(0.43 + random.gauss(0, 0.05), 0, 1.0)
    csol = _clamp(0.62 + random.gauss(0, 0.08), 0, 1.5)

    return SensorReading(
        station=station,
        station_code=station.station_id,
        timestamp=dt,
        temperature=temp,
        humidity=hum,
        pressure=press,
        wind_speed=wspd,
        wind_direction=wdir,
        rain=rain,
        light=light,
        soil_moisture=soil,
        altitude=None,
        volt_3v3=v33,
        volt_5v=v5,
        volt_batt=vbatt,
        volt_solar=vsol,
        volt_dc=vdc,
        curr_batt=cbatt,
        curr_solar=csol,
    )


class Command(BaseCommand):
    help = 'Seed SensorReading records with realistic weather data for all stations'

    def add_arguments(self, parser):
        parser.add_argument(
            '--days',
            type=int,
            default=3,
            help='Number of days of historical data to generate (default: 3)',
        )
        parser.add_argument(
            '--interval',
            type=int,
            default=60,
            help='Minutes between readings (default: 60)',
        )

    def handle(self, *args, **options):
        days = options['days']
        interval = options['interval']
        stations = list(Station.objects.all())

        if not stations:
            self.stdout.write(self.style.WARNING('No stations found. Run createsu first or add stations via the admin.'))
            return

        now = timezone.now()
        existing = set(
            SensorReading.objects.filter(
                station__in=stations
            ).values_list('station_id', 'timestamp')
        )
        created = 0
        skipped = 0

        for station in stations:
            t = now - timedelta(days=days)
            while t <= now:
                if (station.id, t) in existing:
                    t += timedelta(minutes=interval)
                    skipped += 1
                    continue
                generate_reading(station, t).save()
                created += 1
                t += timedelta(minutes=interval)

        self.stdout.write(self.style.SUCCESS(
            f'Created {created} sensor readings across {len(stations)} stations '
            f'({skipped} already existed).'
        ))
