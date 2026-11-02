"""
Server-side estimate of how much data each station's SIM has used.

The station has no room for a usage counter, but nearly every byte its SIM
spends goes to our ingest endpoints. SimUsageMiddleware sizes each ingest
request (plus the connection overhead HTTPS adds) and charges it to the
station's SIM in hourly buckets. Remaining data is then

    anchor balance - calibration_factor * bytes received since the anchor

where the anchor is the last point the balance was known: the bundle load,
a top-up, or a balance the user read from MTN. Each MTN balance entered
also re-tunes calibration_factor, so the estimate converges on what MTN bills.
"""
import datetime
import json
import logging
import math
import re
from collections import defaultdict

from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import F, Min, Sum
from django.utils import timezone

from .models import SimBalanceCheck, SimCard, SimTopUp, SimUsageHour

logger = logging.getLogger(__name__)

INGEST_PATH_PREFIX = '/api/ingest/'
BYTES_PER_MB = 1024 * 1024
# Each post opens a new HTTPS connection, so on top of the HTTP bytes the SIM
# pays for a DNS lookup, the TCP handshake/teardown and a full TLS handshake
# with the server's certificate chain. Calibration corrects this figure.
CONNECTION_OVERHEAD_BYTES = getattr(settings, 'SIM_CONNECTION_OVERHEAD_BYTES', 5500)
# TCP/IP headers and TLS record framing on the HTTP bytes themselves.
FRAMING_OVERHEAD = 1.06
# The station posts weather, voltage and current readings separately each interval.
POSTS_PER_INTERVAL = 3
# Typical HTTP size of one ingest post, used until real traffic has been measured.
DEFAULT_HTTP_BYTES = 900
FACTOR_LIMITS = (0.25, 4.0)
# Below this much measured traffic a balance check is too noisy to calibrate from.
MIN_CALIBRATION_MB = 0.5
RATE_WINDOW = datetime.timedelta(days=7)
DAILY_HISTORY_DAYS = 60


def estimate_request_cost(http_bytes):
    """Bytes the SIM is billed for one ingest post carrying `http_bytes` of HTTP traffic."""
    return round(http_bytes * FRAMING_OVERHEAD) + CONNECTION_OVERHEAD_BYTES


# ── Recording traffic ───────────────────────────────────

class SimUsageMiddleware:
    """Charges every ingest POST, including rejected ones, to the station's SIM."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.method != 'POST' or not request.path.startswith(INGEST_PATH_PREFIX):
            return self.get_response(request)

        try:
            # Reading the body here caches it, so DRF can still parse it in the view.
            request_bytes = _http_request_bytes(request)
        except Exception:
            logger.exception('Could not size ingest request for SIM usage')
            return self.get_response(request)

        response = self.get_response(request)
        try:
            station_code = _station_code(request.body)
            record_ingest(station_code, request_bytes + _http_response_bytes(response))
        except Exception:
            logger.exception('Could not record SIM usage')
        return response


def _http_request_bytes(request):
    size = len(request.method) + len(request.get_full_path()) + 12  # "POST /path HTTP/1.1\r\n"
    for key, value in request.META.items():
        if key.startswith('HTTP_'):
            size += len(key) - 5 + len(str(value)) + 4
    for key in ('CONTENT_TYPE', 'CONTENT_LENGTH'):  # sent as headers but not prefixed in META
        if request.META.get(key):
            size += len(key) + len(str(request.META[key])) + 4
    return size + 2 + len(request.body)


def _http_response_bytes(response):
    size = 17  # "HTTP/1.1 201 Created\r\n"
    size += sum(len(k) + len(str(v)) + 4 for k, v in response.items()) + 2
    if not response.streaming:
        size += len(response.content)
    return size


def _station_code(body):
    try:
        data = json.loads(body or b'{}')
    except ValueError:
        return None
    if not isinstance(data, dict):
        return None
    code = data.get('station_id') or data.get('station_code')
    if not code and isinstance(data.get('raw'), str):
        match = re.search(r'(?:^|,)\s*(?:ID|Station|station_id|station_code):([^,]+)', data['raw'])
        code = match.group(1).strip() if match else None
    # Same fallback the ingest views use for posts that omit the station.
    return code or 'AWS-UG-001'


def record_ingest(station_code, http_bytes, at=None):
    if not station_code:
        return
    sim_id = SimCard.objects.filter(station__station_id=station_code).values_list('id', flat=True).first()
    if sim_id is not None:
        add_usage(sim_id, estimate_request_cost(http_bytes), at=at)


def add_usage(sim_id, nbytes, at=None, requests=1):
    hour = _hour(at or timezone.now())
    bucket = SimUsageHour.objects.filter(sim_id=sim_id, hour=hour)
    increment = {'requests': F('requests') + requests, 'bytes': F('bytes') + nbytes}
    if bucket.update(**increment):
        return
    try:
        with transaction.atomic():
            SimUsageHour.objects.create(sim_id=sim_id, hour=hour, requests=requests, bytes=nbytes)
    except IntegrityError:  # another request created the bucket first
        bucket.update(**increment)


def _hour(value):
    return value.astimezone(datetime.timezone.utc).replace(minute=0, second=0, microsecond=0)


# ── Estimating the balance ──────────────────────────────

def _cycle_start(sim):
    if sim.date_loaded:
        return timezone.make_aware(datetime.datetime.combine(sim.date_loaded, datetime.time.min))
    return None


def _anchor(sim):
    """(when, remaining MB) at the last point the balance was known."""
    if sim.balance_anchor_at and sim.balance_anchor_mb is not None:
        return sim.balance_anchor_at, sim.balance_anchor_mb
    return _cycle_start(sim), sim.data_limit_mb or 0.0


def _bytes_since(sim, since):
    buckets = SimUsageHour.objects.filter(sim=sim)
    if since is None:
        return buckets.aggregate(total=Sum('bytes'))['total'] or 0
    hour = _hour(since)
    total = buckets.filter(hour__gt=hour).aggregate(total=Sum('bytes'))['total'] or 0
    # Only the part of the anchor's hour that came after it.
    first = buckets.filter(hour=hour).values_list('bytes', flat=True).first()
    if first:
        total += first * (1 - (since - hour) / datetime.timedelta(hours=1))
    return total


def remaining_mb(sim):
    anchor_at, anchor_mb = _anchor(sim)
    return max(0.0, anchor_mb - sim.calibration_factor * _bytes_since(sim, anchor_at) / BYTES_PER_MB)


def _daily_usage(sim, today):
    start = _cycle_start(sim) or timezone.now() - datetime.timedelta(days=30)
    start = max(start, timezone.now() - datetime.timedelta(days=DAILY_HISTORY_DAYS))
    per_day = defaultdict(int)
    for hour, nbytes in SimUsageHour.objects.filter(sim=sim, hour__gte=_hour(start)).values_list('hour', 'bytes'):
        per_day[timezone.localtime(hour).date()] += nbytes

    day = timezone.localtime(start).date()
    days = []
    while day <= today:
        days.append({
            'date': day.isoformat(),
            'usage_mb': round(sim.calibration_factor * per_day.get(day, 0) / BYTES_PER_MB, 3),
        })
        day += datetime.timedelta(days=1)
    return days


def _daily_rate_mb(sim, now):
    """Average MB/day over the last week, or the expected rate if too little has been measured."""
    first_hour = SimUsageHour.objects.filter(sim=sim).aggregate(first=Min('hour'))['first']
    if first_hour:
        window_start = max(now - RATE_WINDOW, first_hour)
        elapsed_days = (now - window_start) / datetime.timedelta(days=1)
        if elapsed_days >= 1:
            rate = sim.calibration_factor * _bytes_since(sim, window_start) / BYTES_PER_MB / elapsed_days
            return rate, 'measured', math.floor(elapsed_days)

    totals = SimUsageHour.objects.filter(sim=sim).aggregate(bytes=Sum('bytes'), requests=Sum('requests'))
    per_request = (
        totals['bytes'] / totals['requests'] if totals['requests']
        else estimate_request_cost(DEFAULT_HTTP_BYTES)
    )
    interval = (sim.station.expected_interval_minutes if sim.station else None) or 15
    posts_per_day = 1440 / interval * POSTS_PER_INTERVAL
    return sim.calibration_factor * posts_per_day * per_request / BYTES_PER_MB, 'expected', 0


def sim_usage_summary(sim, now=None):
    """Estimated usage, remaining data and depletion projection for one SIM."""
    now = now or timezone.now()
    today = timezone.localtime(now).date()
    remaining = remaining_mb(sim)
    bundle = sim.data_limit_mb or 0.0
    rate, basis, rate_days = _daily_rate_mb(sim, now)

    days_to_empty = math.floor(remaining / rate) if rate > 0 else None
    days_to_expiry = max(0, (sim.expiry_date - today).days) if sim.expiry_date else None
    candidates = [(d, kind) for d, kind in ((days_to_empty, 'data'), (days_to_expiry, 'expiry')) if d is not None]
    days_left, limited_by = min(candidates) if candidates else (None, None)

    if basis == 'measured':
        note = f'Averaging {rate:.2f} MB/day over the last {rate_days} day{"s" if rate_days != 1 else ""}.'
    else:
        note = f'Not enough traffic measured yet; assuming {rate:.2f} MB/day from the reporting interval.'
    if limited_by == 'data' and sim.expiry_date:
        note += f' Data runs out before the bundle expires on {sim.expiry_date:%d %b %Y}.'
    elif limited_by == 'expiry' and days_to_empty is not None:
        note += f' The bundle expires before the data runs out (about {days_to_empty} days of data left).'

    last_check = sim.balance_checks.first()
    if last_check:
        note += f' Calibrated against the MTN balance on {timezone.localtime(last_check.checked_at):%d %b %Y}.'
    else:
        note += ' Estimated from server traffic; record the MTN balance to calibrate.'

    return {
        'usage_mb': round(max(0.0, bundle - remaining), 3),
        'remaining_mb': round(remaining, 3),
        'avg_daily_usage_mb': round(rate, 3),
        'usage_basis': basis,
        'calibration_factor': round(sim.calibration_factor, 3),
        'estimated_days_remaining': days_left,
        'projected_expiry_date': (today + datetime.timedelta(days=days_left)).isoformat() if days_left is not None else None,
        'limited_by': limited_by,
        'days_to_empty': days_to_empty,
        'forecast_confidence_note': note,
        'daily_usage': _daily_usage(sim, today),
        'last_balance_check': {
            'checked_at': last_check.checked_at.isoformat(),
            'actual_mb': last_check.actual_mb,
            'estimated_mb': last_check.estimated_mb,
        } if last_check else None,
    }


# ── Balance changes ─────────────────────────────────────

def record_balance_check(sim, actual_mb, checked_at=None, user=None):
    """Re-anchors the balance to what MTN reports and re-tunes the calibration factor."""
    checked_at = checked_at or timezone.now()
    anchor_at, anchor_mb = _anchor(sim)
    measured_mb = _bytes_since(sim, anchor_at) / BYTES_PER_MB
    estimated_mb = max(0.0, anchor_mb - sim.calibration_factor * measured_mb)
    billed_mb = anchor_mb - actual_mb
    # Skip calibrating on too little traffic, or when the balance went up
    # (a bundle bought outside this system).
    if measured_mb >= MIN_CALIBRATION_MB and billed_mb > 0:
        low, high = FACTOR_LIMITS
        sim.calibration_factor = min(high, max(low, billed_mb / measured_mb))

    sim.balance_anchor_at = checked_at
    sim.balance_anchor_mb = actual_mb
    sim.data_limit_mb = max(sim.data_limit_mb or 0.0, actual_mb)
    with transaction.atomic():
        sim.save()
        SimBalanceCheck.objects.create(
            sim=sim, checked_at=checked_at, actual_mb=actual_mb, estimated_mb=round(estimated_mb, 3),
            factor_after=sim.calibration_factor, recorded_by=user,
        )


def apply_top_up(sim, amount_mb, expiry_date=None, note='', user=None):
    """
    Adds a bundle. MTN stacks a bundle bought while one is still active; once the
    current bundle has expired or run out, the new one starts a fresh cycle.
    """
    now = timezone.now()
    today = timezone.localtime(now).date()
    remaining = remaining_mb(sim)
    expired = sim.expiry_date is not None and sim.expiry_date < today
    if expired or remaining <= 0:
        sim.data_limit_mb = amount_mb
        sim.date_loaded = today
        sim.balance_anchor_mb = amount_mb
    else:
        sim.data_limit_mb = (sim.data_limit_mb or 0.0) + amount_mb
        sim.balance_anchor_mb = remaining + amount_mb
    sim.balance_anchor_at = now
    if expiry_date:
        sim.expiry_date = expiry_date
    with transaction.atomic():
        sim.save()
        SimTopUp.objects.create(
            sim=sim, amount_mb=amount_mb, new_total_mb=sim.data_limit_mb,
            expiry_date=sim.expiry_date, note=note[:255], added_by=user,
        )


def reset_cycle(sim):
    """After the bundle size or load date is edited, count usage from the load date again."""
    sim.balance_anchor_at = None
    sim.balance_anchor_mb = None
