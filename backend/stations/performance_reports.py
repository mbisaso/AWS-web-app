from datetime import datetime, timedelta

from django.db.models import Avg, Count, Max, Min, Q
from django.utils import timezone

from .models import MaintenanceLog, SensorReading, Station

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

# Plausible physical ranges; readings outside them are logged as sensor faults.
SENSOR_RANGES = {
    "temperature": (-40.0, 60.0),
    "humidity": (0.0, 100.0),
    "pressure": (500.0, 1100.0),
    "wind_speed": (0.0, 200.0),
    "wind_direction": (0.0, 360.0),
    "solar_radiation": (0.0, 1500.0),
    "soil_moisture": (0.0, 100.0),
    "rain": (0.0, None),
}
# Sensors whose value should change over a few hours. Rain, wind speed and solar
# radiation legitimately sit at zero for long stretches, so they are not checked.
STUCK_CHECK_FIELDS = ("temperature", "humidity", "pressure", "wind_direction", "soil_moisture")
STUCK_MIN_HOURS = 6
# A wind vane legitimately holds one direction in calm air, so wind direction
# only counts as stuck if the wind blew faster than this during the run.
CALM_WIND_KMH = 2.0

LOW_BATTERY_VOLTS = 11.5
# curr_batt is negative while the battery charges and positive while it
# discharges; currents smaller than this are treated as idle noise.
CHARGING_CURRENT_AMPS = 0.01


def build_performance_report_data(station: Station, period_start, period_end) -> dict:
    """Calculate report metrics for a station in a half-open time window."""
    total_period_minutes = max(
        0.0,
        (period_end - period_start).total_seconds() / 60,
    )
    expected_interval_minutes = station.expected_interval_minutes or 15
    if expected_interval_minutes <= 0:
        expected_interval_minutes = 15
    interval = timedelta(minutes=expected_interval_minutes)
    gap_threshold = interval * 1.5

    station_code = station.station_id
    readings = SensorReading.objects.filter(
        Q(station=station) | Q(station_code=station_code),
        timestamp__gte=period_start,
        timestamp__lt=period_end,
    )

    # Retransmitted batches can store the same reading more than once, so each
    # timestamp counts once and keeps its earliest arrival. Values missing from
    # that copy are filled in from later copies.
    rows = list(
        readings.order_by("timestamp", "received_at").values(
            "timestamp",
            "received_at",
            "volt_batt",
            "curr_batt",
            *SENSOR_FIELDS,
        )
    )
    unique = {}
    for row in rows:
        kept = unique.setdefault(row["timestamp"], row)
        if kept is not row:
            for key, value in row.items():
                if kept[key] is None:
                    kept[key] = value
    records = list(unique.values())
    timestamps = [record["timestamp"] for record in records]
    duplicate_readings = len(rows) - len(records)

    actual_readings = len(records)
    expected_readings = int(total_period_minutes / expected_interval_minutes)
    availability_pct = (
        round(min(100.0, actual_readings / expected_readings * 100), 2)
        if expected_readings > 0
        else 0.0
    )

    def interval_index(timestamp):
        return int((timestamp - period_start) / interval)

    def make_gap(start, end, missed_readings, before=None):
        battery = before["volt_batt"] if before else None
        return {
            "start": _local_iso(start),
            "end": _local_iso(end),
            "duration_minutes": _minutes(end - start),
            "missed_readings": missed_readings,
            "cause": (
                "low_battery"
                if battery is not None and battery < LOW_BATTERY_VOLTS
                else "unknown"
            ),
        }

    gaps = []
    if not records:
        if expected_readings > 0:
            gaps.append(make_gap(period_start, period_end, expected_readings))
    else:
        # Before the first and after the last reading, a gap means at least one
        # whole reporting interval without a reading, matching the uptime rule.
        leading_missed = interval_index(timestamps[0])
        if leading_missed > 0:
            gaps.append(make_gap(period_start, timestamps[0], leading_missed))
        for previous, current in zip(records, records[1:]):
            duration = current["timestamp"] - previous["timestamp"]
            if duration > gap_threshold:
                gaps.append(make_gap(
                    previous["timestamp"],
                    current["timestamp"],
                    max(1, int(round(duration / interval)) - 1),
                    before=previous,
                ))
        trailing_missed = expected_readings - interval_index(timestamps[-1]) - 1
        if trailing_missed > 0:
            gaps.append(make_gap(timestamps[-1], period_end, trailing_missed, before=records[-1]))

    maintenance_entries = list(
        MaintenanceLog.objects.filter(station=station, started_at__lt=period_end)
        .filter(
            Q(ended_at__gte=period_start)
            | Q(ended_at__isnull=True, started_at__gte=period_start)
        )
        .order_by("started_at")
    )
    # An entry without an end time covers one reporting interval.
    maintenance_windows = [
        (entry.started_at, entry.ended_at or entry.started_at + interval)
        for entry in maintenance_entries
    ]
    for gap in gaps:
        gap_start = datetime.fromisoformat(gap["start"])
        gap_end = datetime.fromisoformat(gap["end"])
        gap["during_maintenance"] = any(
            start <= gap_end and end >= gap_start for start, end in maintenance_windows
        )
    maintenance_events = [
        {
            "id": entry.id,
            "activity_type": entry.activity_type,
            "activity_label": entry.get_activity_type_display(),
            "start": _local_iso(entry.started_at),
            "end": _local_iso(entry.ended_at) if entry.ended_at else None,
            "description": entry.description,
            "performed_by": entry.performed_by,
        }
        for entry in maintenance_entries
    ]

    total_gaps = len(gaps)
    longest_gap_minutes = round(
        max((gap["duration_minutes"] for gap in gaps), default=0.0), 2
    )
    total_missing_minutes = round(
        sum(gap["duration_minutes"] for gap in gaps), 2
    )

    # Transmission success is the share of scheduled reporting intervals whose
    # reading reached the server within one interval of being taken, so extra
    # readings in one interval cannot make up for another. A negative latency
    # means the station clock runs ahead of the server, so it is left out of the
    # average latency and reported as a logger error.
    latencies = [
        (record["received_at"] - record["timestamp"]).total_seconds()
        if record["received_at"] is not None
        else None
        for record in records
    ]
    valid_latencies = [latency for latency in latencies if latency is not None and latency >= 0]
    clock_ahead_readings = sum(1 for latency in latencies if latency is not None and latency < 0)
    on_time_indexes = [
        interval_index(record["timestamp"])
        for record, latency in zip(records, latencies)
        if latency is not None and latency <= interval.total_seconds()
    ]
    on_time_readings = len(on_time_indexes)
    on_time_intervals = len({index for index in on_time_indexes if index < expected_readings})
    transmission_success_pct = (
        round(on_time_intervals / expected_readings * 100, 2)
        if expected_readings > 0
        else 0.0
    )
    avg_latency_seconds = (
        round(sum(valid_latencies) / len(valid_latencies), 2) if valid_latencies else 0.0
    )

    # A communication interruption is a run of readings that the station logged
    # on schedule but that reached the server late, i.e. the logger kept
    # working while the network was down. It ends when the backlog arrives, or
    # one interval after the last delayed reading if the station then stopped
    # logging, since that outage is already reported as a missing-data gap.
    position = {timestamp: index for index, timestamp in enumerate(timestamps)}
    delayed = [
        "delayed" if latency is not None and latency > interval.total_seconds() else None
        for latency in latencies
    ]
    communication_events = []
    for _, run in _runs(records, delayed, gap_threshold):
        start = run[0]["timestamp"]
        last = run[-1]["timestamp"]
        end = min(period_end, max(last, min(record["received_at"] for record in run)))
        following = position[last] + 1
        next_time = timestamps[following] if following < len(timestamps) else period_end
        if next_time - last > gap_threshold:
            end = min(end, last + interval)
        communication_events.append({
            "start": _local_iso(start),
            "end": _local_iso(end),
            "duration_minutes": _minutes(end - start),
            "delayed_readings": len(run),
        })
    communication = {
        "interruptions": len(communication_events),
        "total_minutes": round(sum(event["duration_minutes"] for event in communication_events), 2),
        "longest_minutes": round(
            max((event["duration_minutes"] for event in communication_events), default=0.0), 2
        ),
        "events": communication_events,
    }

    power_stats = readings.aggregate(
        volt_batt_min=Min("volt_batt"),
        volt_batt_max=Max("volt_batt"),
        volt_batt_avg=Avg("volt_batt"),
        volt_solar_min=Min("volt_solar"),
        volt_solar_max=Max("volt_solar"),
        volt_solar_avg=Avg("volt_solar"),
        battery_temp_min=Min("battery_temp"),
        battery_temp_max=Max("battery_temp"),
        battery_temp_avg=Avg("battery_temp"),
        low_battery_events=Count(
            "timestamp", distinct=True, filter=Q(volt_batt__lt=LOW_BATTERY_VOLTS)
        ),
    )
    power = {
        key: round(value, 2) if value is not None else None
        for key, value in power_stats.items()
        if key != "low_battery_events"
    }
    low_battery_events = power_stats["low_battery_events"] or 0
    power["low_battery_events"] = low_battery_events

    # Each reading stands for the time until the next one, capped at one
    # interval so that outages are not counted as charging or discharging.
    charging_seconds = discharging_seconds = current_seconds = 0.0
    for record, next_time in zip(records, [*timestamps[1:], period_end]):
        current = record["curr_batt"]
        if current is None:
            continue
        seconds = min(next_time - record["timestamp"], interval).total_seconds()
        current_seconds += seconds
        if current < -CHARGING_CURRENT_AMPS:
            charging_seconds += seconds
        elif current > CHARGING_CURRENT_AMPS:
            discharging_seconds += seconds
    power_gaps = [gap for gap in gaps if gap["cause"] == "low_battery"]
    power.update({
        "charging_hours": round(charging_seconds / 3600, 2),
        "discharging_hours": round(discharging_seconds / 3600, 2),
        "measured_hours": round(current_seconds / 3600, 2),
        "charging_pct": (
            round(charging_seconds / current_seconds * 100, 2) if current_seconds else 0.0
        ),
        "power_outages": len(power_gaps),
        "power_outage_minutes": round(sum(gap["duration_minutes"] for gap in power_gaps), 2),
    })

    # The period is split into reporting intervals. An interval is up when at
    # least one reading was taken inside it, even if not exactly on schedule.
    # Each run of consecutive empty intervals is one downtime incident.
    covered = [False] * expected_readings
    for timestamp in timestamps:
        index = interval_index(timestamp)
        if index < expected_readings:
            covered[index] = True
    covered_intervals = sum(covered)
    total_downtime_minutes = round(
        min(
            total_period_minutes,
            (expected_readings - covered_intervals) * expected_interval_minutes,
        ),
        2,
    )
    downtime_incidents = sum(
        1
        for index, is_up in enumerate(covered)
        if not is_up and (index == 0 or covered[index - 1])
    )
    uptime_pct = (
        round(covered_intervals / expected_readings * 100, 2)
        if expected_readings > 0
        else 0.0
    )

    sensors = {}
    fault_events = []
    for field in SENSOR_FIELDS:
        not_null_count = sum(1 for record in records if record[field] is not None)
        events = []
        states = _sensor_states(records, field, gap_threshold)
        for fault_type, run in _runs(records, states, gap_threshold):
            start = run[0]["timestamp"]
            end = min(period_end, run[-1]["timestamp"] + interval)
            events.append({
                "sensor": field,
                "type": fault_type,
                "start": _local_iso(start),
                "end": _local_iso(end),
                "duration_minutes": _minutes(end - start),
                "readings": len(run),
            })
        fault_events.extend(events)
        sensors[field] = {
            "total_readings": actual_readings,
            "null_readings": actual_readings - not_null_count,
            "completeness_pct": (
                round(not_null_count / actual_readings * 100, 2)
                if actual_readings > 0
                else 0.0
            ),
            "fault_events": len(events),
            "fault_minutes": round(sum(event["duration_minutes"] for event in events), 2),
            "faults_by_type": {
                fault_type: sum(1 for event in events if event["type"] == fault_type)
                for fault_type in ("missing", "out_of_range", "stuck")
            },
        }
    fault_events.sort(key=lambda event: (event["start"], event["sensor"]))

    active_faults = []
    status = getattr(station, "status", None)
    details = status.details if status is not None else None
    if isinstance(details, dict):
        faults = details.get("faulty_sensors")
        if not isinstance(faults, list):
            faults = details.get("active_faults")
        if not isinstance(faults, list):
            faults = details.get("faults")
        if isinstance(faults, list):
            active_faults = [str(fault) for fault in faults]

    maintenance = {"count": len(maintenance_events), "events": maintenance_events}

    logger_errors = {
        "clock_ahead_readings": clock_ahead_readings,
        "duplicate_readings": duplicate_readings,
    }

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
        "on_time_readings": on_time_readings,
        "on_time_intervals": on_time_intervals,
        "clock_ahead_readings": clock_ahead_readings,
    }
    uptime = {
        "pct": uptime_pct,
        "uptime_pct": uptime_pct,
        "total_downtime_minutes": total_downtime_minutes,
        "downtime_incidents": downtime_incidents,
        "covered_intervals": covered_intervals,
    }
    sensor_health = {
        "sensors": sensors,
        "active_faults": active_faults,
        "fault_events": fault_events,
        "total_fault_events": len(fault_events),
        "logger_errors": logger_errors,
    }

    return {
        "station_name": station.name,
        "station_code": station_code,
        "period_start": period_start.isoformat(),
        "period_end": period_end.isoformat(),
        "generated_at": timezone.now().isoformat(),
        "data_availability": data_availability,
        "missing_data": missing_data,
        "missing_data_gaps": missing_data,
        "transmission": transmission,
        "communication": communication,
        "maintenance": maintenance,
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
        "on_time_readings": on_time_readings,
        "on_time_intervals": on_time_intervals,
        "clock_ahead_readings": clock_ahead_readings,
        "duplicate_readings": duplicate_readings,
        "communication_interruptions": communication["interruptions"],
        "communication_interruption_minutes": communication["total_minutes"],
        "communication_events": communication_events,
        **power,
        "uptime_pct": uptime_pct,
        "total_downtime_minutes": total_downtime_minutes,
        "downtime_incidents": downtime_incidents,
        "covered_intervals": covered_intervals,
        "sensors": sensors,
        "active_faults": active_faults,
        "maintenance_count": len(maintenance_events),
        "maintenance_events": maintenance_events,
        "sensor_fault_events": len(fault_events),
        "fault_events": fault_events,
    }


def _sensor_states(records, field, max_step):
    """Label each reading's value for a sensor: None when healthy, else a fault type."""
    low, high = SENSOR_RANGES[field]
    states = []
    for record in records:
        value = record[field]
        if value is None:
            states.append("missing")
        elif value < low or (high is not None and value > high):
            states.append("out_of_range")
        else:
            states.append(None)

    if field in STUCK_CHECK_FIELDS:
        run_start = 0
        for index in range(1, len(records) + 1):
            if (
                index < len(records)
                and states[index] is None
                and states[run_start] is None
                and records[index][field] == records[run_start][field]
                and records[index]["timestamp"] - records[index - 1]["timestamp"] <= max_step
            ):
                continue
            span = records[index - 1]["timestamp"] - records[run_start]["timestamp"]
            windy = field != "wind_direction" or any(
                (record["wind_speed"] or 0) > CALM_WIND_KMH
                for record in records[run_start:index]
            )
            if states[run_start] is None and windy and span >= timedelta(hours=STUCK_MIN_HOURS):
                for stuck_index in range(run_start, index):
                    states[stuck_index] = "stuck"
            run_start = index

    return states


def _runs(records, states, max_step):
    """Yield (state, records) for each run of consecutive records sharing a non-None state.

    A run also ends when two readings are further apart than max_step, so an
    outage splits it in two.
    """
    run = []
    run_state = None
    for record, state in zip(records, states):
        if run and (
            state != run_state
            or record["timestamp"] - run[-1]["timestamp"] > max_step
        ):
            yield run_state, run
            run = []
        if state is not None:
            run.append(record)
            run_state = state
    if run:
        yield run_state, run


def _local_iso(value):
    return timezone.localtime(value).isoformat()


def _minutes(duration):
    return round(duration.total_seconds() / 60, 2)
