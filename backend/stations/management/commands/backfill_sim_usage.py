import datetime
from collections import Counter

from django.core.management.base import BaseCommand
from django.utils import timezone

from stations import sim_usage
from stations.models import CurrentReading, SimCard, SimUsageHour, VoltageReading, WeatherReading

# Typical HTTP size (request + response) of each ingest post, for readings
# received before the server started measuring traffic itself.
HTTP_BYTES = {
    WeatherReading: 1200,  # JSON incl. per-minute wind/rain arrays
    VoltageReading: 650,
    CurrentReading: 630,
}


class Command(BaseCommand):
    help = (
        "Estimates SIM usage for hours before live metering, from the readings "
        "already stored. Hours that already have usage recorded are left alone."
    )

    def add_arguments(self, parser):
        parser.add_argument('--days', type=int, default=60, help='How far back to fill when a SIM has no load date')

    def handle(self, *args, days, **options):
        default_start = timezone.now() - datetime.timedelta(days=days)
        for sim in SimCard.objects.select_related('station').exclude(station=None):
            start = sim_usage._cycle_start(sim) or default_start
            existing = set(SimUsageHour.objects.filter(sim=sim, hour__gte=start).values_list('hour', flat=True))

            requests, nbytes = Counter(), Counter()
            for model, http_bytes in HTTP_BYTES.items():
                cost = sim_usage.estimate_request_cost(http_bytes)
                received = model.objects.filter(station=sim.station, received_at__gte=start).values_list('received_at', flat=True)
                for at in received:
                    hour = sim_usage._hour(at)
                    if hour not in existing:
                        requests[hour] += 1
                        nbytes[hour] += cost

            SimUsageHour.objects.bulk_create(
                [SimUsageHour(sim=sim, hour=h, requests=requests[h], bytes=nbytes[h]) for h in requests],
                ignore_conflicts=True,
            )
            total_mb = sum(nbytes.values()) / sim_usage.BYTES_PER_MB
            self.stdout.write(f'{sim.station.station_id}: filled {len(requests)} hours, {total_mb:.1f} MB')
