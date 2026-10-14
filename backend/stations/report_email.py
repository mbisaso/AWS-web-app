import html
from datetime import date, datetime, time, timedelta
from io import BytesIO
from xml.sax.saxutils import escape

from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from .models import Station
from .performance_reports import SENSOR_FIELDS, build_performance_report_data

INK = colors.HexColor("#0047AB")
TEAL = colors.HexColor("#1E6FD9")
PALE = colors.HexColor("#E6F0FA")
LINE = colors.HexColor("#a5c5d2")
MUTED = colors.HexColor("#4A6A8A")

FAULT_LABELS = {
    "missing": "missing",
    "out_of_range": "out of range",
    "stuck": "stuck on one value",
}


def build_daily_report(report_date: date) -> dict:
    """Build reports for the previous local calendar day, for every station."""
    local_timezone = timezone.get_current_timezone()
    period_start = timezone.make_aware(
        datetime.combine(report_date, time.min),
        timezone=local_timezone,
    )
    period_end = period_start + timedelta(days=1)
    stations = Station.objects.select_related("status").order_by("name", "station_id")
    station_reports = [
        build_performance_report_data(station, period_start, period_end)
        for station in stations
    ]
    return {
        "report_date": report_date,
        "period_start": period_start,
        "period_end": period_end,
        "stations": station_reports,
        "summary": summarize_reports(station_reports),
    }


def build_station_report_pdf(report_data: dict) -> bytes:
    period_start = datetime.fromisoformat(report_data["period_start"])
    period_end = datetime.fromisoformat(report_data["period_end"])
    return build_report_pdf({
        "title": "Station Performance Report",
        "period_label": f"Period: {period_start:%Y-%m-%d %H:%M} to {period_end:%Y-%m-%d %H:%M}",
        "report_date": period_end.date(),
        "summary": summarize_reports([report_data]),
        "stations": [report_data],
    })


def summarize_reports(reports: list[dict]) -> dict:
    def total(key):
        return sum(report[key] for report in reports)

    expected = total("expected_readings")
    actual = total("actual_readings")
    latency_weights = [
        report["actual_readings"] - report["clock_ahead_readings"] for report in reports
    ]
    latency_total = sum(
        report["avg_latency_seconds"] * weight
        for report, weight in zip(reports, latency_weights)
    )
    latency_weight = sum(latency_weights)
    sensor_totals = {}
    for sensor in SENSOR_FIELDS:
        stats = [report["sensors"][sensor] for report in reports]
        readings = sum(item["total_readings"] for item in stats)
        missing = sum(item["null_readings"] for item in stats)
        sensor_totals[sensor] = {
            "total_readings": readings,
            "null_readings": missing,
            "completeness_pct": round((readings - missing) / readings * 100, 2) if readings else 0.0,
            "fault_events": sum(item["fault_events"] for item in stats),
            "fault_minutes": round(sum(item["fault_minutes"] for item in stats), 2),
        }

    power = {}
    for metric in ("volt_batt", "volt_solar", "battery_temp"):
        minimums = [report["power"][f"{metric}_min"] for report in reports]
        maximums = [report["power"][f"{metric}_max"] for report in reports]
        weighted_averages = [
            (report["power"][f"{metric}_avg"], report["actual_readings"])
            for report in reports
            if report["power"][f"{metric}_avg"] is not None and report["actual_readings"]
        ]
        average_weight = sum(weight for _, weight in weighted_averages)
        power[f"{metric}_min"] = min((value for value in minimums if value is not None), default=None)
        power[f"{metric}_max"] = max((value for value in maximums if value is not None), default=None)
        power[f"{metric}_avg"] = (
            round(sum(value * weight for value, weight in weighted_averages) / average_weight, 2)
            if average_weight
            else None
        )
    for key in ("low_battery_events", "power_outages"):
        power[key] = sum(report["power"][key] for report in reports)
    for key in ("charging_hours", "discharging_hours", "measured_hours", "power_outage_minutes"):
        power[key] = round(sum(report["power"][key] for report in reports), 2)
    power["charging_pct"] = (
        round(power["charging_hours"] / power["measured_hours"] * 100, 2)
        if power["measured_hours"]
        else 0.0
    )

    return {
        "station_count": len(reports),
        "data_availability_pct": round(min(100.0, actual / expected * 100), 2) if expected else 0.0,
        "actual_readings": actual,
        "expected_readings": expected,
        "total_gaps": total("total_gaps"),
        "transmission_success_pct": (
            round(total("on_time_intervals") / expected * 100, 2) if expected else 0.0
        ),
        "avg_latency_seconds": (
            round(latency_total / latency_weight, 2) if latency_weight else 0.0
        ),
        "uptime_pct": round(total("covered_intervals") / expected * 100, 2) if expected else 0.0,
        "total_downtime_minutes": round(total("total_downtime_minutes"), 2),
        "downtime_incidents": total("downtime_incidents"),
        "communication_interruptions": total("communication_interruptions"),
        "communication_interruption_minutes": round(total("communication_interruption_minutes"), 2),
        "low_battery_events": power["low_battery_events"],
        "sensor_fault_events": total("sensor_fault_events"),
        "maintenance_count": total("maintenance_count"),
        "clock_ahead_readings": total("clock_ahead_readings"),
        "duplicate_readings": total("duplicate_readings"),
        "power": power,
        "sensors": sensor_totals,
    }


def build_email_html(report: dict) -> str:
    summary = report["summary"]
    tiles = (
        ("Data availability", f'{summary["data_availability_pct"]}%'),
        ("System uptime", f'{summary["uptime_pct"]}%'),
        ("Transmission", f'{summary["transmission_success_pct"]}%'),
        ("Missing-data gaps", str(summary["total_gaps"])),
        ("Comms interruptions", str(summary["communication_interruptions"])),
        ("Sensor faults", str(summary["sensor_fault_events"])),
        ("Low-battery events", str(summary["low_battery_events"])),
    )
    tile_html = "".join(
        "<td style='padding:12px;border:1px solid #d7e1e5;background:#edf5f4;'>"
        f"<div style='font:12px Arial;color:#627387'>{html.escape(label)}</div>"
        f"<strong style='font:22px Arial;color:#17283f'>{html.escape(value)}</strong></td>"
        for label, value in tiles
    )
    rows = "".join(
        "<tr>"
        f"<td style='padding:8px;border-bottom:1px solid #d7e1e5'>{html.escape(item['station_name'])} "
        f"({html.escape(item['station_code'])})</td>"
        f"<td style='padding:8px;border-bottom:1px solid #d7e1e5'>{item['data_availability_pct']}%</td>"
        f"<td style='padding:8px;border-bottom:1px solid #d7e1e5'>{item['uptime_pct']}%</td>"
        f"<td style='padding:8px;border-bottom:1px solid #d7e1e5'>{item['transmission_success_pct']}%</td>"
        f"<td style='padding:8px;border-bottom:1px solid #d7e1e5'>{item['total_gaps']}</td>"
        f"<td style='padding:8px;border-bottom:1px solid #d7e1e5'>{item['communication_interruptions']}</td>"
        f"<td style='padding:8px;border-bottom:1px solid #d7e1e5'>{item['sensor_fault_events']}</td>"
        f"<td style='padding:8px;border-bottom:1px solid #d7e1e5'>{item['low_battery_events']}</td>"
        "</tr>"
        for item in report["stations"]
    )
    sensor_rows = "".join(
        "<tr>"
        f"<td style='padding:6px;border-bottom:1px solid #d7e1e5'>{html.escape(sensor.replace('_', ' ').title())}</td>"
        f"<td style='padding:6px;border-bottom:1px solid #d7e1e5'>{stats['completeness_pct']}%</td>"
        f"<td style='padding:6px;border-bottom:1px solid #d7e1e5'>{stats['null_readings']}</td>"
        f"<td style='padding:6px;border-bottom:1px solid #d7e1e5'>{stats['fault_events']}</td>"
        "</tr>"
        for sensor, stats in summary["sensors"].items()
    )
    battery = summary["power"]
    return (
        "<!doctype html><html><body style='margin:0;padding:24px;background:#f5f8fa;'>"
        "<main style='max-width:900px;margin:auto;font-family:Arial,sans-serif;color:#17283f;'>"
        "<h1 style='font-size:24px;margin-bottom:4px'>Daily Performance Report</h1>"
        f"<p style='color:#627387;margin-top:0'>Previous calendar day: {report['report_date'].isoformat()}</p>"
        f"<table role='presentation' style='width:100%;border-collapse:collapse'><tr>{tile_html}</tr></table>"
        "<h2 style='font-size:18px;margin-top:28px'>Station overview</h2>"
        "<table style='width:100%;border-collapse:collapse;background:#fff'>"
        "<thead><tr style='text-align:left;background:#edf5f4'>"
        "<th style='padding:8px'>Station</th><th style='padding:8px'>Availability</th>"
        "<th style='padding:8px'>Uptime</th><th style='padding:8px'>Transmission</th>"
        "<th style='padding:8px'>Gaps</th><th style='padding:8px'>Comms interruptions</th>"
        "<th style='padding:8px'>Sensor faults</th><th style='padding:8px'>Low battery</th></tr></thead>"
        f"<tbody>{rows or '<tr><td colspan=8 style=padding:8px>No stations are registered.</td></tr>'}</tbody>"
        "</table>"
        "<h2 style='font-size:18px;margin-top:28px'>Overall sensor health</h2>"
        "<table style='width:100%;border-collapse:collapse;background:#fff'>"
        "<thead><tr style='text-align:left;background:#edf5f4'><th style='padding:6px'>Sensor</th>"
        "<th style='padding:6px'>Completeness</th><th style='padding:6px'>Missing readings</th>"
        "<th style='padding:6px'>Fault events</th></tr></thead>"
        f"<tbody>{sensor_rows}</tbody></table>"
        f"<p style='color:#627387;margin-top:24px'>Average transmission latency: {summary['avg_latency_seconds']} seconds. "
        f"Battery voltage: {_fmt(battery['volt_batt_min'])} / {_fmt(battery['volt_batt_avg'])} / "
        f"{_fmt(battery['volt_batt_max'])} V (min/avg/max). "
        f"Battery charging for {battery['charging_hours']} h ({battery['charging_pct']}% of measured time); "
        f"{battery['power_outages']} power-related outage(s). "
        f"Communication interruptions: {summary['communication_interruptions']} "
        f"({summary['communication_interruption_minutes']} min). "
        f"Maintenance entries logged: {summary['maintenance_count']}. "
        "PDF attached with full station details.</p>"
        "</main></body></html>"
    )


def build_email_text(report: dict) -> str:
    summary = report["summary"]
    lines = [
        f"Daily Performance Report for {report['report_date'].isoformat()}",
        f"Stations: {summary['station_count']}",
        f"Data availability: {summary['data_availability_pct']}%",
        f"System uptime: {summary['uptime_pct']}%",
        f"Transmission success: {summary['transmission_success_pct']}%",
        f"Missing-data gaps: {summary['total_gaps']}",
        f"Communication interruptions: {summary['communication_interruptions']} "
        f"({summary['communication_interruption_minutes']} min)",
        f"Sensor fault events: {summary['sensor_fault_events']}",
        f"Maintenance entries: {summary['maintenance_count']}",
        f"Low-battery events: {summary['low_battery_events']}",
        f"Battery charging time: {summary['power']['charging_hours']} h; "
        f"power-related outages: {summary['power']['power_outages']}",
        "",
        "Station overview:",
    ]
    for item in report["stations"]:
        lines.append(
            f"- {item['station_name']} ({item['station_code']}): "
            f"availability {item['data_availability_pct']}%, uptime {item['uptime_pct']}%, "
            f"transmission {item['transmission_success_pct']}%, gaps {item['total_gaps']}, "
            f"comms interruptions {item['communication_interruptions']}, "
            f"sensor faults {item['sensor_fault_events']}, low battery {item['low_battery_events']}, "
            f"maintenance entries {item['maintenance_count']}"
        )
    return "\n".join(lines)


def build_report_pdf(report: dict) -> bytes:
    output = BytesIO()
    document = SimpleDocTemplate(
        output,
        pagesize=landscape(A4),
        rightMargin=14 * mm,
        leftMargin=14 * mm,
        topMargin=13 * mm,
        bottomMargin=13 * mm,
        title=f"{report.get('title', 'Daily Performance Report')} {report['report_date'].isoformat()}",
        author="AWS Monitor",
    )
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name="ReportTitle",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=21,
        leading=25,
        textColor=INK,
        alignment=TA_LEFT,
        spaceAfter=3 * mm,
    ))
    styles.add(ParagraphStyle(
        name="SectionHeading",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=15,
        textColor=INK,
        spaceBefore=5 * mm,
        spaceAfter=2 * mm,
    ))
    styles.add(ParagraphStyle(
        name="SmallMuted",
        parent=styles["BodyText"],
        fontSize=8,
        leading=10,
        textColor=MUTED,
    ))
    styles.add(ParagraphStyle(
        name="KpiLabel",
        parent=styles["BodyText"],
        fontSize=8,
        leading=10,
        textColor=MUTED,
        alignment=TA_CENTER,
    ))
    styles.add(ParagraphStyle(
        name="KpiValue",
        parent=styles["BodyText"],
        fontName="Helvetica-Bold",
        fontSize=17,
        leading=20,
        textColor=INK,
        alignment=TA_CENTER,
    ))
    styles.add(ParagraphStyle(
        name="Cell",
        parent=styles["BodyText"],
        fontSize=8,
        leading=10,
    ))
    styles.add(ParagraphStyle(
        name="HeaderCell",
        parent=styles["Cell"],
        textColor=colors.white,
    ))

    summary = report["summary"]
    period_label = report.get("period_label") or (
        f"Previous calendar day: {report['report_date'].isoformat()}"
    )
    kpis = [
        ("Data availability", f'{summary["data_availability_pct"]}%'),
        ("System uptime", f'{summary["uptime_pct"]}%'),
        ("Transmission", f'{summary["transmission_success_pct"]}%'),
        ("Missing-data gaps", str(summary["total_gaps"])),
        ("Comms interruptions", str(summary["communication_interruptions"])),
        ("Sensor faults", str(summary["sensor_fault_events"])),
        ("Low-battery events", str(summary["low_battery_events"])),
    ]
    story = [
        Paragraph(escape(report.get("title", "Daily Performance Report")), styles["ReportTitle"]),
        Paragraph(
            f"{escape(period_label)} "
            f"| {summary['station_count']} station(s) "
            f"| {summary['actual_readings']} of {summary['expected_readings']} expected readings",
            styles["SmallMuted"],
        ),
        Spacer(1, 5 * mm),
    ]
    kpi_table = Table(
        [[Paragraph(f"<b>{escape(label)}</b>", styles["KpiLabel"]) for label, _ in kpis],
         [Paragraph(escape(value), styles["KpiValue"]) for _, value in kpis]],
        colWidths=[(266 / len(kpis)) * mm] * len(kpis),
        rowHeights=[9 * mm, 13 * mm],
    )
    kpi_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PALE),
        ("BOX", (0, 0), (-1, -1), 0.6, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.6, LINE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.extend([kpi_table, Paragraph("Station overview", styles["SectionHeading"])])

    header = [
        "Station", "Availability", "Uptime", "Transmission", "Gaps", "Downtime",
        "Comms interruptions", "Sensor faults", "Low battery", "Latency",
    ]
    overview_rows = [[Paragraph(f"<b>{label}</b>", styles["HeaderCell"]) for label in header]]
    for item in report["stations"]:
        overview_rows.append([
            Paragraph(escape(f"{item['station_name']} ({item['station_code']})"), styles["Cell"]),
            f"{item['data_availability_pct']}%",
            f"{item['uptime_pct']}%",
            f"{item['transmission_success_pct']}%",
            str(item["total_gaps"]),
            f"{item['total_downtime_minutes']} min",
            str(item["communication_interruptions"]),
            str(item["sensor_fault_events"]),
            str(item["low_battery_events"]),
            f"{item['avg_latency_seconds']} s",
        ])
    overview = Table(
        overview_rows,
        repeatRows=1,
        colWidths=[
            58 * mm, 22 * mm, 17 * mm, 24 * mm, 13 * mm, 24 * mm,
            26 * mm, 18 * mm, 20 * mm, 22 * mm,
        ],
        hAlign="LEFT",
    )
    overview.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), INK),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PALE]),
        ("GRID", (0, 0), (-1, -1), 0.4, LINE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (1, 1), (-1, -1), "CENTER"),
        ("FONTSIZE", (1, 1), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(overview)

    overall_power_table = Table(
        _power_rows(summary["power"]),
        colWidths=[55 * mm, 35 * mm, 35 * mm, 35 * mm],
    )
    overall_power_table.setStyle(_detail_table_style())
    overall_sensor_table = Table(
        _sensor_rows(summary["sensors"]),
        colWidths=[38 * mm, 26 * mm, 26 * mm, 20 * mm, 24 * mm],
    )
    overall_sensor_table.setStyle(_detail_table_style())
    story.extend([
        Paragraph("Overall power performance", styles["SectionHeading"]),
        overall_power_table,
        Paragraph("Overall sensor health", styles["SectionHeading"]),
        overall_sensor_table,
        Paragraph(
            f"Logger errors: {summary['clock_ahead_readings']} reading(s) timestamped ahead "
            f"of the server clock, {summary['duplicate_readings']} duplicate reading(s).",
            styles["SmallMuted"],
        ),
    ])

    for item in report["stations"]:
        story.append(Paragraph(
            f"{escape(item['station_name'])} "
            f"<font color='{TEAL.hexval()}'>{escape(item['station_code'])}</font>",
            styles["SectionHeading"],
        ))
        story.append(Paragraph(
            f"Availability {item['data_availability_pct']}% "
            f"({item['actual_readings']}/{item['expected_readings']} readings)  |  "
            f"Uptime {item['uptime_pct']}%  |  "
            f"Transmission {item['transmission_success_pct']}%  |  "
            f"Average latency {item['avg_latency_seconds']} seconds  |  "
            f"Comms interruptions {item['communication_interruptions']} "
            f"({item['communication_interruption_minutes']} min)",
            styles["SmallMuted"],
        ))
        power_table = Table(_power_rows(item["power"]), colWidths=[50 * mm, 28 * mm, 28 * mm, 28 * mm])
        power_table.setStyle(_detail_table_style())
        sensor_table = Table(
            _sensor_rows(item["sensors"]),
            colWidths=[30 * mm, 22 * mm, 20 * mm, 16 * mm, 20 * mm],
        )
        sensor_table.setStyle(_detail_table_style())
        details = Table([[power_table, sensor_table]], colWidths=[145 * mm, 110 * mm])
        details.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]))
        story.append(details)
        if item["active_faults"]:
            story.append(Paragraph(
                f"Active sensor faults: {escape(', '.join(item['active_faults']))}",
                styles["SmallMuted"],
            ))
        if item["clock_ahead_readings"] or item["duplicate_readings"]:
            story.append(Paragraph(
                f"Logger errors: {item['clock_ahead_readings']} reading(s) timestamped ahead of "
                f"the server clock, {item['duplicate_readings']} duplicate reading(s).",
                styles["SmallMuted"],
            ))
        _append_events(
            story, styles, "Maintenance and interventions", item["maintenance_events"],
            lambda entry: (
                f"{entry['activity_label']}"
                + (f" by {entry['performed_by']}" if entry["performed_by"] else "")
                + f" - {entry['description']}"
            ),
        )
        _append_events(
            story, styles, "Missing-data gaps", item["gaps"],
            lambda gap: (
                f"{gap['duration_minutes']} minutes ({gap['missed_readings']} expected readings missed)"
                + ("; battery was low before the outage" if gap.get("cause") == "low_battery" else "")
                + ("; during logged maintenance" if gap.get("during_maintenance") else "")
            ),
        )
        _append_events(
            story, styles, "Communication interruptions (longest first)",
            sorted(item["communication_events"], key=lambda event: -event["duration_minutes"]),
            lambda event: (
                f"{event['duration_minutes']} minutes "
                f"({event['delayed_readings']} reading(s) logged but delivered late)"
            ),
        )
        _append_events(
            story, styles, "Sensor fault events (longest first)",
            sorted(item["fault_events"], key=lambda event: -event["duration_minutes"]),
            lambda event: (
                f"{event['sensor'].replace('_', ' ').title()} {FAULT_LABELS[event['type']]}: "
                f"{event['duration_minutes']} minutes ({event['readings']} reading(s))"
            ),
        )

    document.build(story, onFirstPage=_draw_page_footer, onLaterPages=_draw_page_footer)
    return output.getvalue()


def _fmt(value) -> str:
    return "N/A" if value is None else f"{value:.2f}"


def _fmt_time(value: str) -> str:
    return f"{datetime.fromisoformat(value):%Y-%m-%d %H:%M}"


def _power_rows(power: dict) -> list:
    return [
        ["Power metric", "Minimum", "Average", "Maximum"],
        ["Battery voltage (V)", _fmt(power["volt_batt_min"]), _fmt(power["volt_batt_avg"]), _fmt(power["volt_batt_max"])],
        ["Solar voltage (V)", _fmt(power["volt_solar_min"]), _fmt(power["volt_solar_avg"]), _fmt(power["volt_solar_max"])],
        ["Battery temperature (C)", _fmt(power["battery_temp_min"]), _fmt(power["battery_temp_avg"]), _fmt(power["battery_temp_max"])],
        ["Charging time", f"{power['charging_hours']} h ({power['charging_pct']}%)", "", ""],
        ["Discharging time", f"{power['discharging_hours']} h", "", ""],
        ["Low-battery readings", str(power["low_battery_events"]), "", ""],
        ["Power-related outages", f"{power['power_outages']} ({power['power_outage_minutes']} min)", "", ""],
    ]


def _sensor_rows(sensors: dict) -> list:
    rows = [["Sensor", "Completeness", "Missing", "Faults", "Fault time"]]
    for sensor in SENSOR_FIELDS:
        stats = sensors[sensor]
        rows.append([
            sensor.replace("_", " ").title(),
            f"{stats['completeness_pct']}%",
            str(stats["null_readings"]),
            str(stats["fault_events"]),
            f"{stats['fault_minutes']} min",
        ])
    return rows


def _append_events(story, styles, title, events, describe, limit=10):
    if not events:
        return
    story.append(Paragraph(title, styles["Heading3"]))
    for event in events[:limit]:
        when = _fmt_time(event["start"])
        if event.get("end"):
            when += f" to {_fmt_time(event['end'])}"
        story.append(Paragraph(
            escape(f"{when}: {describe(event)}"),
            styles["SmallMuted"],
        ))
    if len(events) > limit:
        story.append(Paragraph(f"Showing {limit} of {len(events)}.", styles["SmallMuted"]))


def _detail_table_style() -> TableStyle:
    return TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), INK),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PALE]),
        ("GRID", (0, 0), (-1, -1), 0.4, LINE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ])


def _draw_page_footer(canvas, document):
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.line(14 * mm, 10 * mm, landscape(A4)[0] - 14 * mm, 10 * mm)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(14 * mm, 6 * mm, "AWS Monitor | Daily station performance")
    canvas.drawRightString(landscape(A4)[0] - 14 * mm, 6 * mm, f"Page {document.page}")
    canvas.restoreState()
