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

from . import report_charts
from .models import Station
from .performance_reports import (
    CHARGING_CURRENT_AMPS,
    LOW_BATTERY_VOLTS,
    SENSOR_FIELDS,
    STUCK_MIN_HOURS,
    build_performance_report_data,
)

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
    return build_report_pdf({
        "title": "Station Performance Report",
        "period_start": report_data["period_start"],
        "period_end": report_data["period_end"],
        "report_date": datetime.fromisoformat(report_data["period_end"]).date(),
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

    intervals = {report.get("expected_interval_minutes") for report in reports}
    return {
        "station_count": len(reports),
        "interval_minutes": intervals.pop() if len(intervals) == 1 else None,
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
    formulas = _formulas(summary.get("interval_minutes"))
    ink, muted, pale, line = INK.hexval()[2:], MUTED.hexval()[2:], PALE.hexval()[2:], LINE.hexval()[2:]
    tiles = (
        ("Data availability", f'{summary["data_availability_pct"]}%', formulas["availability"]),
        ("System uptime", f'{summary["uptime_pct"]}%', formulas["uptime"]),
        ("Transmission", f'{summary["transmission_success_pct"]}%', formulas["transmission"]),
        ("Missing-data gaps", str(summary["total_gaps"]), formulas["gaps"]),
        ("Comms interruptions", str(summary["communication_interruptions"]), formulas["comms"]),
        ("Sensor faults", str(summary["sensor_fault_events"]), formulas["faults"]),
        ("Low-battery events", str(summary["low_battery_events"]), formulas["low_battery"]),
        ("Maintenance entries", str(summary["maintenance_count"]), formulas["maintenance"]),
    )

    def tile(label, value, formula):
        return (
            f"<td style='width:25%;padding:12px;border:1px solid #{line};background:#{pale};"
            "vertical-align:top;text-align:center'>"
            f"<div style='font:bold 12px Arial;color:#{muted}'>{html.escape(label)}</div>"
            f"<div style='font:10px Arial;color:#{muted};margin-top:2px'>({html.escape(formula)})</div>"
            f"<div style='font:bold 22px Arial;color:#{ink};margin-top:8px'>{html.escape(value)}</div></td>"
        )

    tile_rows = "".join(
        "<tr>" + "".join(tile(*item) for item in tiles[start:start + 4]) + "</tr>"
        for start in range(0, len(tiles), 4)
    )
    cell = f"padding:8px;border-bottom:1px solid #{line}"
    rows = "".join(
        "<tr>"
        f"<td style='{cell}'>{html.escape(item['station_name'])} ({html.escape(item['station_code'])})</td>"
        f"<td style='{cell}'>{item['data_availability_pct']}%</td>"
        f"<td style='{cell}'>{item['uptime_pct']}%</td>"
        f"<td style='{cell}'>{item['transmission_success_pct']}%</td>"
        f"<td style='{cell}'>{item['total_gaps']}</td>"
        f"<td style='{cell}'>{item['communication_interruptions']}</td>"
        f"<td style='{cell}'>{item['sensor_fault_events']}</td>"
        f"<td style='{cell}'>{item['low_battery_events']}</td>"
        "</tr>"
        for item in report["stations"]
    )

    def header(label, formula=None):
        note = f"<br><span style='font-weight:normal;font-size:10px;color:#{muted}'>({html.escape(formula)})</span>" if formula else ""
        return f"<th style='padding:8px;text-align:left;vertical-align:bottom'>{html.escape(label)}{note}</th>"

    sensor_rows = "".join(
        "<tr>"
        f"<td style='{cell}'>{html.escape(sensor.replace('_', ' ').title())}</td>"
        f"<td style='{cell}'>{stats['completeness_pct']}%</td>"
        f"<td style='{cell}'>{stats['null_readings']}</td>"
        f"<td style='{cell}'>{stats['fault_events']}</td>"
        "</tr>"
        for sensor, stats in summary["sensors"].items()
    )
    battery = summary["power"]
    return (
        "<!doctype html><html><body style='margin:0;padding:24px;background:#f5f8fa;'>"
        f"<main style='max-width:900px;margin:auto;font-family:Arial,sans-serif;color:#{ink};'>"
        "<h1 style='font-size:24px;margin-bottom:4px'>Daily Performance Report</h1>"
        f"<p style='color:#{ink};margin-top:0;font-size:15px'>Period: <strong>{html.escape(_period_label(report))}</strong></p>"
        f"<table role='presentation' style='width:100%;border-collapse:collapse'>{tile_rows}</table>"
        "<h2 style='font-size:18px;margin-top:28px'>Station overview</h2>"
        "<table style='width:100%;border-collapse:collapse;background:#fff'>"
        f"<thead><tr style='background:#{pale}'>"
        + header("Station") + header("Availability") + header("Uptime") + header("Transmission")
        + header("Gaps") + header("Comms interruptions") + header("Sensor faults") + header("Low battery")
        + "</tr></thead>"
        f"<tbody>{rows or '<tr><td colspan=8 style=padding:8px>No stations are registered.</td></tr>'}</tbody>"
        "</table>"
        "<h2 style='font-size:18px;margin-top:28px'>Overall sensor health</h2>"
        "<table style='width:100%;border-collapse:collapse;background:#fff'>"
        f"<thead><tr style='background:#{pale}'>"
        + header("Sensor") + header("Completeness", formulas["completeness"])
        + header("Missing readings", formulas["missing"]) + header("Fault events", formulas["fault_count"])
        + "</tr></thead>"
        f"<tbody>{sensor_rows}</tbody></table>"
        f"<p style='color:#{muted};margin-top:24px'>"
        f"Average transmission delay: {_fmt_duration(summary['avg_latency_seconds'] / 60)}. "
        f"Battery voltage: {_fmt(battery['volt_batt_min'])} / {_fmt(battery['volt_batt_avg'])} / "
        f"{_fmt(battery['volt_batt_max'])} V (min / avg / max). "
        f"Battery charging for {battery['charging_hours']} h ({battery['charging_pct']}% of measured time); "
        f"{battery['power_outages']} power-related outage(s). "
        f"Communication interruptions: {summary['communication_interruptions']} "
        f"({_fmt_duration(summary['communication_interruption_minutes'])}). "
        f"Maintenance entries logged: {summary['maintenance_count']}.</p>"
        f"<p style='color:#{muted}'>The attached PDF has the full details for each station, "
        "including charts of data received, battery and solar voltage, and every sensor.</p>"
        "</main></body></html>"
    )


def build_email_text(report: dict) -> str:
    summary = report["summary"]
    formulas = _formulas(summary.get("interval_minutes"))
    lines = [
        "Daily Performance Report",
        f"Period: {_period_label(report)}",
        f"Stations: {summary['station_count']}",
        "",
        f"Data availability: {summary['data_availability_pct']}% ({formulas['availability']})",
        f"System uptime: {summary['uptime_pct']}% ({formulas['uptime']})",
        f"Transmission success: {summary['transmission_success_pct']}% ({formulas['transmission']})",
        f"Missing-data gaps: {summary['total_gaps']} ({formulas['gaps']})",
        f"Communication interruptions: {summary['communication_interruptions']} ({formulas['comms']})",
        f"Sensor fault events: {summary['sensor_fault_events']} ({formulas['faults']})",
        f"Low-battery events: {summary['low_battery_events']} ({formulas['low_battery']})",
        f"Maintenance entries: {summary['maintenance_count']} ({formulas['maintenance']})",
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
    lines += ["", "The attached PDF has the full details and charts for each station."]
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
        name="Period",
        parent=styles["BodyText"],
        fontSize=10,
        leading=13,
        textColor=INK,
    ))
    styles.add(ParagraphStyle(
        name="SubHeading",
        parent=styles["BodyText"],
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=13,
        textColor=INK,
        spaceBefore=4 * mm,
        spaceAfter=1.5 * mm,
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
    styles.add(ParagraphStyle(
        name="RowLabel",
        parent=styles["Cell"],
        leading=9.5,
    ))

    summary = report["summary"]
    formulas = _formulas(summary.get("interval_minutes"))
    single_station = len(report["stations"]) == 1
    theme = {"ink": INK, "muted": MUTED}
    content_width = landscape(A4)[0] - 28 * mm

    kpis = [
        ("Data availability", f'{summary["data_availability_pct"]}%', formulas["availability"]),
        ("System uptime", f'{summary["uptime_pct"]}%', formulas["uptime"]),
        ("Transmission", f'{summary["transmission_success_pct"]}%', formulas["transmission"]),
        ("Missing-data gaps", str(summary["total_gaps"]), formulas["gaps"]),
        ("Comms interruptions", str(summary["communication_interruptions"]), formulas["comms"]),
        ("Sensor faults", str(summary["sensor_fault_events"]), formulas["faults"]),
        ("Low-battery events", str(summary["low_battery_events"]), formulas["low_battery"]),
        ("Maintenance entries", str(summary["maintenance_count"]), formulas["maintenance"]),
    ]
    stations_text = "1 station" if single_station else f"{summary['station_count']} stations"
    story = [
        Paragraph(escape(report.get("title", "Daily Performance Report")), styles["ReportTitle"]),
        Paragraph(
            f"Period: <b>{escape(_period_label(report))}</b>"
            f"  |  {stations_text}"
            f"  |  {summary['actual_readings']} of {summary['expected_readings']} expected readings",
            styles["Period"],
        ),
        Spacer(1, 4 * mm),
    ]
    kpi_rows = []
    for start in range(0, len(kpis), 4):
        row = kpis[start:start + 4]
        kpi_rows.append([_heading_cell(label, formula, styles["KpiLabel"]) for label, _, formula in row])
        kpi_rows.append([Paragraph(escape(value), styles["KpiValue"]) for _, value, _ in row])
    kpi_table = Table(
        kpi_rows,
        colWidths=[content_width / 4] * 4,
        rowHeights=[12 * mm, 11 * mm] * (len(kpi_rows) // 2),
    )
    kpi_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PALE),
        ("BOX", (0, 0), (-1, -1), 0.6, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.6, LINE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    story.append(kpi_table)

    # With several stations, compare them and show fleet totals. With one
    # station these would repeat the station's own section, so they are left out.
    if not single_station:
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
                _fmt_duration(item["total_downtime_minutes"]),
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
        story.extend([Paragraph("Station overview", styles["SectionHeading"]), overview])
        story.extend([
            Paragraph("Overall power performance", styles["SectionHeading"]),
            _detail_table(_power_rows(summary["power"], formulas, styles), [62 * mm, 32 * mm, 32 * mm, 32 * mm]),
            Paragraph("Overall sensor health", styles["SectionHeading"]),
            _detail_table(_sensor_rows(summary["sensors"], formulas, styles), [34 * mm, 34 * mm, 26 * mm, 26 * mm, 30 * mm]),
            Paragraph(
                f"Logger errors: {summary['clock_ahead_readings']} reading(s) timestamped ahead "
                f"of the server clock, {summary['duplicate_readings']} duplicate reading(s).",
                styles["SmallMuted"],
            ),
        ])

    for item in report["stations"]:
        item_formulas = _formulas(item.get("expected_interval_minutes"))
        interval = item.get("expected_interval_minutes")
        interval_label = f"{interval:g}-minute period" if interval else "reporting interval"
        story.append(Paragraph(
            f"{escape(item['station_name'])} "
            f"<font color='{TEAL.hexval()}'>{escape(item['station_code'])}</font>",
            styles["SectionHeading"],
        ))
        has_charts = "chart_data" in item
        if has_charts:
            story.append(report_charts.timeline_chart(item, content_width, theme, interval_label))

        if item["actual_readings"] == 0:
            story.append(Paragraph("No readings were received from this station in this period.", styles["SmallMuted"]))
        else:
            if has_charts:
                story.extend([Spacer(1, 3 * mm), report_charts.power_chart(item, content_width, theme)])
            details = Table(
                [[
                    _detail_table(_power_rows(item["power"], item_formulas, styles), [52 * mm, 26 * mm, 26 * mm, 26 * mm]),
                    _detail_table(_sensor_rows(item["sensors"], item_formulas, styles), [27 * mm, 31 * mm, 22 * mm, 22 * mm, 25 * mm]),
                ]],
                colWidths=[136 * mm, 133 * mm],
            )
            details.setStyle(TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]))
            story.extend([Spacer(1, 3 * mm), details])

            if has_charts:
                chart_width = content_width / 3
                charts = report_charts.sensor_charts(item, chart_width - 6, theme)
                grid = Table(
                    [charts[start:start + 3] for start in range(0, len(charts), 3)],
                    colWidths=[chart_width] * 3,
                )
                grid.setStyle(TableStyle([
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 2),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]))
                story.extend([
                    Paragraph("Sensor readings", styles["SubHeading"]),
                    grid,
                ])
                if len(item["chart_data"]["daily_uptime"]) >= 7:
                    story.append(report_charts.daily_uptime_chart(item, content_width, theme))

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
            story, styles, "Maintenance and interventions", item_formulas["maintenance"],
            item["maintenance_events"],
            lambda entry: (
                f"{entry['activity_label']}"
                + (f" by {entry['performed_by']}" if entry["performed_by"] else "")
                + f" - {entry['description']}"
            ),
        )
        _append_events(
            story, styles, "Missing-data gaps", item_formulas["gaps"], item["gaps"],
            lambda gap: (
                f"{_fmt_duration(gap['duration_minutes'])} ({gap['missed_readings']} expected readings missed)"
                + ("; battery was low before the outage" if gap.get("cause") == "low_battery" else "")
                + ("; during logged maintenance" if gap.get("during_maintenance") else "")
            ),
        )
        _append_events(
            story, styles, "Communication interruptions, longest first", item_formulas["comms"],
            sorted(item["communication_events"], key=lambda event: -event["duration_minutes"]),
            lambda event: (
                f"{_fmt_duration(event['duration_minutes'])} "
                f"({event['delayed_readings']} reading(s) logged but delivered late)"
            ),
        )
        _append_events(
            story, styles, "Sensor fault events, longest first", item_formulas["faults"],
            sorted(item["fault_events"], key=lambda event: -event["duration_minutes"]),
            lambda event: (
                f"{event['sensor'].replace('_', ' ').title()} {FAULT_LABELS[event['type']]}: "
                f"{_fmt_duration(event['duration_minutes'])} ({event['readings']} reading(s))"
            ),
        )

    document.build(story, onFirstPage=_draw_page_footer, onLaterPages=_draw_page_footer)
    return output.getvalue()


def _fmt(value) -> str:
    return "N/A" if value is None else f"{value:.2f}"


def _fmt_time(value: str) -> str:
    return f"{timezone.localtime(datetime.fromisoformat(value)):%d %b %Y, %H:%M}"


def _fmt_duration(minutes: float) -> str:
    """Readable length of time, e.g. 1 d 17 h 40 min."""
    total = round(minutes)
    if total < 60:
        return f"{total} min"
    days, rest = divmod(total, 1440)
    hours, mins = divmod(rest, 60)
    parts = [f"{days} d"] if days else []
    parts += [f"{hours} h"] if hours else []
    parts += [f"{mins} min"] if mins else []
    return " ".join(parts)


def _power_rows(power: dict, formulas: dict, styles) -> list:
    def label(text, formula=None):
        if not formula:
            return text
        return Paragraph(
            f"{escape(text)}<br/><font size='6.5' color='{MUTED.hexval()}'>({escape(formula)})</font>",
            styles["RowLabel"],
        )

    header = [Paragraph(f"<b>{text}</b>", styles["HeaderCell"]) for text in ("Power metric", "Minimum", "Average", "Maximum")]
    return [
        header,
        ["Battery voltage (V)", _fmt(power["volt_batt_min"]), _fmt(power["volt_batt_avg"]), _fmt(power["volt_batt_max"])],
        ["Solar voltage (V)", _fmt(power["volt_solar_min"]), _fmt(power["volt_solar_avg"]), _fmt(power["volt_solar_max"])],
        ["Battery temperature (°C)", _fmt(power["battery_temp_min"]), _fmt(power["battery_temp_avg"]), _fmt(power["battery_temp_max"])],
        [label("Charging time", formulas["charging"]), f"{power['charging_hours']} h ({power['charging_pct']}%)", "", ""],
        [label("Discharging time", formulas["discharging"]), f"{power['discharging_hours']} h", "", ""],
        [label("Low-battery readings", formulas["low_battery"]), str(power["low_battery_events"]), "", ""],
        [label("Power-related outages", formulas["power_outages"]), f"{power['power_outages']} ({_fmt_duration(power['power_outage_minutes'])})" if power["power_outages"] else "0", "", ""],
    ]


def _sensor_rows(sensors: dict, formulas: dict, styles) -> list:
    header = [Paragraph("<b>Sensor</b>", styles["HeaderCell"])] + [
        _heading_cell(text, formulas[key], styles["HeaderCell"])
        for text, key in (
            ("Completeness", "completeness"),
            ("Missing", "missing"),
            ("Faults", "fault_count"),
            ("Fault time", "fault_time"),
        )
    ]
    rows = [header]
    for sensor in SENSOR_FIELDS:
        stats = sensors[sensor]
        rows.append([
            sensor.replace("_", " ").title(),
            f"{stats['completeness_pct']}%",
            str(stats["null_readings"]),
            str(stats["fault_events"]),
            _fmt_duration(stats["fault_minutes"]) if stats["fault_minutes"] else "-",
        ])
    return rows


def _append_events(story, styles, title, formula, events, describe, limit=10):
    if not events:
        return
    story.append(Paragraph(
        f"{escape(title)} <font size='8' color='{MUTED.hexval()}'>({escape(formula)})</font>",
        styles["SubHeading"],
    ))
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


def _formulas(interval_minutes) -> dict:
    """How each figure is calculated, worded for the station's reporting interval.

    interval_minutes is None when the report covers stations with different
    intervals, in which case the wording stays general.
    """
    if interval_minutes:
        periods = f"{interval_minutes:g}-min periods"
        on_time = f"{interval_minutes:g} min"
        gap = f"{interval_minutes * 1.5:g} min"
    else:
        periods = "reporting intervals"
        on_time = "one reporting interval"
        gap = "1.5 reporting intervals"
    return {
        "availability": "readings received ÷ readings expected × 100",
        "uptime": f"{periods} with data ÷ all {periods} × 100",
        "transmission": f"{periods} with a reading received within {on_time} ÷ all {periods} × 100",
        "gaps": f"times with no data for more than {gap}",
        "comms": f"runs of readings that arrived more than {on_time} late",
        "faults": f"runs of sensor values that were missing, out of range, or unchanged for {STUCK_MIN_HOURS} h or more",
        "low_battery": f"readings with battery below {LOW_BATTERY_VOLTS:g} V",
        "maintenance": "visits and resets recorded in the maintenance log",
        "completeness": "readings with a value ÷ all readings × 100",
        "missing": "readings with no value",
        "fault_count": "runs of bad values",
        "fault_time": "total length of those runs",
        "charging": f"time with battery current below -{CHARGING_CURRENT_AMPS:g} A",
        "discharging": f"time with battery current above {CHARGING_CURRENT_AMPS:g} A",
        "power_outages": "gaps that began right after a low-battery reading",
    }


def _period_label(report: dict) -> str:
    start = report["period_start"]
    end = report["period_end"]
    start = timezone.localtime(datetime.fromisoformat(start) if isinstance(start, str) else start)
    end = timezone.localtime(datetime.fromisoformat(end) if isinstance(end, str) else end)
    hours = (end - start).total_seconds() / 3600
    length = f"{hours:g} hours" if hours < 72 else f"{hours / 24:g} days"
    return f"{start:%d %b %Y, %H:%M} to {end:%d %b %Y, %H:%M} ({length})"


def _heading_cell(label: str, formula: str, style) -> Paragraph:
    return Paragraph(
        f"<b>{escape(label)}</b><br/><font size='6.5'>({escape(formula)})</font>",
        style,
    )


def _detail_table(rows: list, col_widths: list) -> Table:
    table = Table(rows, colWidths=col_widths)
    table.setStyle(_detail_table_style())
    return table


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
    canvas.drawString(14 * mm, 6 * mm, f"AWS Monitor | {document.title}")
    canvas.drawRightString(landscape(A4)[0] - 14 * mm, 6 * mm, f"Page {document.page}")
    canvas.restoreState()
