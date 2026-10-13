import logging

from django.db.models import Avg, Count, Max, Min, Q

from .models import SensorReading, Station

logger = logging.getLogger(__name__)

SENSOR_FIELDS = (
    "temperature",
    "humidity",
    "pressure",
    "wind_speed",
    "wind_direction",
    "solar_radiation",
    "soil_moisture",
    "rain",
)


def build_performance_report_data(station: Station, period_start, period_end) -> dict:
    """Calculate report metrics for a station in a half-open time window."""
    total_period_minutes = max(
        0.0,
        (period_end - period_start).total_seconds() / 60,
    )
    expected_interval_minutes = station.expected_interval_minutes or 15
    if expected_interval_minutes <= 0:
        expected_interval_minutes = 15

    station_code = station.station_id
    readings = SensorReading.objects.filter(
        Q(station=station) | Q(station_code=station_code),
        timestamp__gte=period_start,
        timestamp__lt=period_end,
    )
    actual_readings = readings.count()
    expected_readings = int(total_period_minutes / expected_interval_minutes)
    availability_pct = (
        round(min(100.0, actual_readings / expected_readings * 100), 2)
        if expected_readings > 0
        else 0.0
    )

    records = list(readings.order_by("timestamp").values_list("timestamp", "received_at"))
    timestamps = [timestamp for timestamp, _ in records if timestamp is not None]
    gap_threshold_minutes = 1.5 * expected_interval_minutes
    gaps = []
    for previous, current in zip(timestamps, timestamps[1:]):
        duration_minutes = (current - previous).total_seconds() / 60
        if duration_minutes > gap_threshold_minutes:
            gaps.append(
                {
                    "start": previous.isoformat(),
                    "end": current.isoformat(),
                    "duration_minutes": round(duration_minutes, 2),
                    "missed_readings": max(
                        1,
                        int(round(duration_minutes / expected_interval_minutes)) - 1,
                    ),
                }
            )

    total_gaps = len(gaps)
    longest_gap_minutes = round(
        max((gap["duration_minutes"] for gap in gaps), default=0.0), 2
    )
    total_missing_minutes = round(
        sum(gap["duration_minutes"] for gap in gaps), 2
    )
    received_count = sum(1 for _, received_at in records if received_at is not None)
    transmission_success_pct = (
        round(min(100.0, received_count / expected_readings * 100), 2)
        if expected_readings > 0
        else 0.0
    )
    latencies = [
        (received_at - timestamp).total_seconds()
        for timestamp, received_at in records
        if received_at is not None and timestamp is not None
    ]
    avg_latency_seconds = round(sum(latencies) / len(latencies), 2) if latencies else 0.0

    power_stats = readings.aggregate(
        volt_batt_min=Min("volt_batt"),
        volt_batt_max=Max("volt_batt"),
        volt_batt_avg=Avg("volt_batt"),
        volt_solar_min=Min("volt_solar"),
        volt_solar_max=Max("volt_solar"),
        volt_solar_avg=Avg("volt_solar"),
        low_battery_events=Count("id", filter=Q(volt_batt__lt=11.5)),
    )
    power = {
        key: round(value, 2) if value is not None else None
        for key, value in power_stats.items()
        if key != "low_battery_events"
    }
    low_battery_events = power_stats["low_battery_events"] or 0
    power["low_battery_events"] = low_battery_events

    downtime_gaps = [gap for gap in gaps if gap["duration_minutes"] > 60]
    total_downtime_minutes = round(
        sum(gap["duration_minutes"] for gap in downtime_gaps), 2
    )
    downtime_incidents = len(downtime_gaps)
    if actual_readings == 0:
        total_downtime_minutes = round(total_period_minutes, 2)
        downtime_incidents = 1
        uptime_pct = 0.0
    elif total_period_minutes > 0:
        uptime_pct = round(
            max(
                0.0,
                min(
                    100.0,
                    (total_period_minutes - total_downtime_minutes)
                    / total_period_minutes
                    * 100,
                ),
            ),
            2,
        )
    else:
        uptime_pct = 0.0

    sensor_counts = readings.aggregate(
        **{f"{field}_count": Count(field) for field in SENSOR_FIELDS}
    )
    sensors = {}
    for field in SENSOR_FIELDS:
        not_null_count = sensor_counts.get(f"{field}_count") or 0
        sensors[field] = {
            "total_readings": actual_readings,
            "null_readings": actual_readings - not_null_count,
            "completeness_pct": (
                round(not_null_count / actual_readings * 100, 2)
                if actual_readings > 0
                else 0.0
            ),
        }

    active_faults = []
    try:
        status = station.status
        details = status.details
        if isinstance(details, dict):
            faults = details.get("faulty_sensors")
            if not isinstance(faults, list):
                faults = details.get("active_faults")
            if not isinstance(faults, list):
                faults = details.get("faults")
            if isinstance(faults, list):
                active_faults = [str(fault) for fault in faults]
    except Exception as error:
        logger.warning("Error reading status details for %s: %s", station_code, error)

    data_availability = {
        "pct": availability_pct,
        "data_availability_pct": availability_pct,
        "expected_readings": expected_readings,
        "actual_readings": actual_readings,
    }
    missing_data = {
        "total_gaps": total_gaps,
        "longest_gap_minutes": longest_gap_minutes,
        "total_missing_minutes": total_missing_minutes,
        "gaps": gaps,
    }
    transmission = {
        "success_pct": transmission_success_pct,
        "transmission_success_pct": transmission_success_pct,
        "avg_latency_seconds": avg_latency_seconds,
    }
    uptime = {
        "pct": uptime_pct,
        "uptime_pct": uptime_pct,
        "total_downtime_minutes": total_downtime_minutes,
        "downtime_incidents": downtime_incidents,
    }
    sensor_health = {"sensors": sensors, "active_faults": active_faults}
    now = period_end

    return {
        "station_name": station.name,
        "station_code": station_code,
        "period_start": period_start.isoformat(),
        "period_end": period_end.isoformat(),
        "generated_at": now.isoformat(),
        "data_availability": data_availability,
        "missing_data": missing_data,
        "missing_data_gaps": missing_data,
        "transmission": transmission,
        "power": power,
        "power_performance": power,
        "uptime": uptime,
        "system_uptime": uptime,
        "sensor_health": sensor_health,
        "sensor_faults": sensor_health,
        "data_availability_pct": availability_pct,
        "expected_readings": expected_readings,
        "actual_readings": actual_readings,
        "total_gaps": total_gaps,
        "longest_gap_minutes": longest_gap_minutes,
        "total_missing_minutes": total_missing_minutes,
        "gaps": gaps,
        "transmission_success_pct": transmission_success_pct,
        "avg_latency_seconds": avg_latency_seconds,
        **power,
        "uptime_pct": uptime_pct,
        "total_downtime_minutes": total_downtime_minutes,
        "downtime_incidents": downtime_incidents,
        "sensors": sensors,
        "active_faults": active_faults,
    }
