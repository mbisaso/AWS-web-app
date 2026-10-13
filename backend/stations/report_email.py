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

INK = colors.HexColor("#17283f")
TEAL = colors.HexColor("#087e83")
PALE = colors.HexColor("#edf5f4")
LINE = colors.HexColor("#d7e1e5")
MUTED = colors.HexColor("#627387")


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
    sensors = report_data["sensor_health"]["sensors"]
    summary = {
        "station_count": 1,
        "data_availability_pct": report_data["data_availability"]["pct"],
        "actual_readings": report_data["data_availability"]["actual_readings"],
        "expected_readings": report_data["data_availability"]["expected_readings"],
        "total_gaps": report_data["missing_data"]["total_gaps"],
        "transmission_success_pct": report_data["transmission"]["success_pct"],
        "avg_latency_seconds": report_data["transmission"]["avg_latency_seconds"],
        "uptime_pct": report_data["uptime"]["pct"],
        "total_downtime_minutes": report_data["uptime"]["total_downtime_minutes"],
        "downtime_incidents": report_data["uptime"]["downtime_incidents"],
        "low_battery_events": report_data["power"]["low_battery_events"],
        "power": report_data["power"],
        "sensors": sensors,
    }
    station_report = {
        **report_data,
        "sensors": sensors,
        "total_downtime_minutes": report_data["uptime"]["total_downtime_minutes"],
        "downtime_incidents": report_data["uptime"]["downtime_incidents"],
        "total_gaps": report_data["missing_data"]["total_gaps"],
        "transmission_success_pct": report_data["transmission"]["success_pct"],
        "avg_latency_seconds": report_data["transmission"]["avg_latency_seconds"],
        "uptime_pct": report_data["uptime"]["pct"],
        "gaps": report_data["missing_data"]["gaps"],
        "active_faults": report_data["sensor_health"]["active_faults"],
    }
    return build_report_pdf({
        "title": "Station Performance Report",
        "period_label": f"Period: {period_start:%Y-%m-%d %H:%M} to {period_end:%Y-%m-%d %H:%M}",
        "report_date": period_end.date(),
        "summary": summary,
        "stations": [station_report],
    })


def summarize_reports(reports: list[dict]) -> dict:
    expected = sum(report["expected_readings"] for report in reports)
    actual = sum(report["actual_readings"] for report in reports)
    period_minutes = sum(
        (datetime.fromisoformat(report["period_end"])
         - datetime.fromisoformat(report["period_start"])).total_seconds() / 60
        for report in reports
    )
    downtime = sum(report["total_downtime_minutes"] for report in reports)
    successful_transmissions = sum(
        round(report["transmission_success_pct"] * report["expected_readings"] / 100)
        for report in reports
    )
    latency_total = sum(
        report["avg_latency_seconds"] * report["actual_readings"]
        for report in reports
    )
    sensor_totals = {}
    for sensor in SENSOR_FIELDS:
        total = sum(report["sensors"][sensor]["total_readings"] for report in reports)
        missing = sum(report["sensors"][sensor]["null_readings"] for report in reports)
        sensor_totals[sensor] = {
            "total_readings": total,
            "null_readings": missing,
            "completeness_pct": round((total - missing) / total * 100, 2) if total else 0.0,
        }

    power = {}
    for rail in ("volt_batt", "volt_solar"):
        minimums = [report["power"][f"{rail}_min"] for report in reports]
        maximums = [report["power"][f"{rail}_max"] for report in reports]
        weighted_averages = [
            (report["power"][f"{rail}_avg"], report["actual_readings"])
            for report in reports
            if report["power"][f"{rail}_avg"] is not None and report["actual_readings"]
        ]
        average_weight = sum(weight for _, weight in weighted_averages)
        power[f"{rail}_min"] = min((value for value in minimums if value is not None), default=None)
        power[f"{rail}_max"] = max((value for value in maximums if value is not None), default=None)
        power[f"{rail}_avg"] = (
            round(sum(value * weight for value, weight in weighted_averages) / average_weight, 2)
            if average_weight
            else None
        )
    power["low_battery_events"] = sum(report["low_battery_events"] for report in reports)

    return {
        "station_count": len(reports),
        "data_availability_pct": round(actual / expected * 100, 2) if expected else 0.0,
        "actual_readings": actual,
        "expected_readings": expected,
        "total_gaps": sum(report["total_gaps"] for report in reports),
        "transmission_success_pct": (
            round(successful_transmissions / expected * 100, 2) if expected else 0.0
        ),
        "avg_latency_seconds": round(latency_total / actual, 2) if actual else 0.0,
        "uptime_pct": (
            round(max(0.0, min(100.0, (period_minutes - downtime) / period_minutes * 100)), 2)
            if period_minutes
            else 0.0
        ),
        "total_downtime_minutes": round(downtime, 2),
        "downtime_incidents": sum(report["downtime_incidents"] for report in reports),
        "low_battery_events": sum(report["low_battery_events"] for report in reports),
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
        f"<td style='padding:8px;border-bottom:1px solid #d7e1e5'>{item['total_gaps']}</td>"
        f"<td style='padding:8px;border-bottom:1px solid #d7e1e5'>{item['low_battery_events']}</td>"
        "</tr>"
        for item in report["stations"]
    )
    sensor_rows = "".join(
        "<tr>"
        f"<td style='padding:6px;border-bottom:1px solid #d7e1e5'>{html.escape(sensor.replace('_', ' ').title())}</td>"
        f"<td style='padding:6px;border-bottom:1px solid #d7e1e5'>{stats['completeness_pct']}%</td>"
        f"<td style='padding:6px;border-bottom:1px solid #d7e1e5'>{stats['null_readings']}</td>"
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
        "<th style='padding:8px'>Station</th><th>Availability</th><th>Uptime</th>"
        "<th>Gaps</th><th>Low battery</th></tr></thead>"
        f"<tbody>{rows or '<tr><td colspan=5 style=padding:8px>No stations are registered.</td></tr>'}</tbody>"
        "</table>"
        "<h2 style='font-size:18px;margin-top:28px'>Overall sensor completeness</h2>"
        "<table style='width:100%;border-collapse:collapse;background:#fff'>"
        "<thead><tr style='text-align:left;background:#edf5f4'><th style='padding:6px'>Sensor</th>"
        "<th>Completeness</th><th>Missing readings</th></tr></thead>"
        f"<tbody>{sensor_rows}</tbody></table>"
        f"<p style='color:#627387;margin-top:24px'>Average transmission latency: {summary['avg_latency_seconds']} seconds. "
        f"Battery voltage: {_fmt(battery['volt_batt_min'])} / {_fmt(battery['volt_batt_avg'])} / "
        f"{_fmt(battery['volt_batt_max'])} V (min/avg/max). PDF attached with full station details.</p>"
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
        f"Low-battery events: {summary['low_battery_events']}",
        "",
        "Station overview:",
    ]
    for item in report["stations"]:
        lines.append(
            f"- {item['station_name']} ({item['station_code']}): "
            f"availability {item['data_availability_pct']}%, uptime {item['uptime_pct']}%, "
            f"gaps {item['total_gaps']}, low battery {item['low_battery_events']}"
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

    summary = report["summary"]
    period_label = report.get("period_label") or (
        f"Previous calendar day: {report['report_date'].isoformat()}"
    )
    kpis = [
        ("Data availability", f'{summary["data_availability_pct"]}%'),
        ("System uptime", f'{summary["uptime_pct"]}%'),
        ("Transmission", f'{summary["transmission_success_pct"]}%'),
        ("Missing-data gaps", str(summary["total_gaps"])),
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
        colWidths=[49 * mm] * len(kpis),
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

    header = ["Station", "Availability", "Uptime", "Transmission", "Gaps", "Downtime", "Low battery", "Latency"]
    overview_rows = [[Paragraph(f"<b>{label}</b>", styles["Cell"]) for label in header]]
    for item in report["stations"]:
        overview_rows.append([
            Paragraph(escape(f"{item['station_name']} ({item['station_code']})"), styles["Cell"]),
            f"{item['data_availability_pct']}%",
            f"{item['uptime_pct']}%",
            f"{item['transmission_success_pct']}%",
            str(item["total_gaps"]),
            f"{item['total_downtime_minutes']} min",
            str(item["low_battery_events"]),
            f"{item['avg_latency_seconds']} s",
        ])
    overview = Table(
        overview_rows,
        repeatRows=1,
        colWidths=[65 * mm, 22 * mm, 18 * mm, 25 * mm, 13 * mm, 25 * mm, 24 * mm, 20 * mm],
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

    overall_power = summary["power"]
    overall_power_rows = [
        ["Power metric", "Minimum", "Average", "Maximum"],
        ["Battery voltage (V)", _fmt(overall_power["volt_batt_min"]), _fmt(overall_power["volt_batt_avg"]), _fmt(overall_power["volt_batt_max"])],
        ["Solar voltage (V)", _fmt(overall_power["volt_solar_min"]), _fmt(overall_power["volt_solar_avg"]), _fmt(overall_power["volt_solar_max"])],
    ]
    story.extend([
        Paragraph("Overall power performance", styles["SectionHeading"]),
        Table(overall_power_rows, colWidths=[55 * mm, 35 * mm, 35 * mm, 35 * mm]),
        Paragraph("Overall sensor completeness", styles["SectionHeading"]),
    ])
    story[-2].setStyle(_detail_table_style())
    overall_sensor_rows = [["Sensor", "Completeness", "Missing readings"]]
    for sensor, stats in summary["sensors"].items():
        overall_sensor_rows.append([
            sensor.replace("_", " ").title(),
            f"{stats['completeness_pct']}%",
            str(stats["null_readings"]),
        ])
    overall_sensor_table = Table(
        overall_sensor_rows,
        colWidths=[45 * mm, 40 * mm, 40 * mm],
    )
    overall_sensor_table.setStyle(_detail_table_style())
    story.append(overall_sensor_table)

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
            f"Average latency {item['avg_latency_seconds']} seconds",
            styles["SmallMuted"],
        ))
        power = item["power"]
        power_rows = [
            ["Power metric", "Minimum", "Average", "Maximum"],
            ["Battery voltage (V)", _fmt(power["volt_batt_min"]), _fmt(power["volt_batt_avg"]), _fmt(power["volt_batt_max"])],
            ["Solar voltage (V)", _fmt(power["volt_solar_min"]), _fmt(power["volt_solar_avg"]), _fmt(power["volt_solar_max"])],
            ["Low-battery events", str(power["low_battery_events"]), "", ""],
        ]
        power_table = Table(power_rows, colWidths=[50 * mm, 28 * mm, 28 * mm, 28 * mm])
        power_table.setStyle(_detail_table_style())
        sensor_rows = [["Sensor", "Completeness", "Missing readings"]]
        for sensor in SENSOR_FIELDS:
            stats = item["sensors"][sensor]
            sensor_rows.append([
                sensor.replace("_", " ").title(),
                f"{stats['completeness_pct']}%",
                str(stats["null_readings"]),
            ])
        sensor_table = Table(sensor_rows, colWidths=[42 * mm, 34 * mm, 34 * mm])
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
        gaps = item["gaps"]
        if gaps:
            story.append(Paragraph("Missing-data gaps", styles["Heading3"]))
            for gap in gaps[:10]:
                story.append(Paragraph(
                    f"{escape(gap['start'])} to {escape(gap['end'])}: "
                    f"{gap['duration_minutes']} minutes "
                    f"({gap['missed_readings']} expected readings missed)",
                    styles["SmallMuted"],
                ))
            if len(gaps) > 10:
                story.append(Paragraph(f"Showing 10 of {len(gaps)} gaps.", styles["SmallMuted"]))

    document.build(story, onFirstPage=_draw_page_footer, onLaterPages=_draw_page_footer)
    return output.getvalue()


def _fmt(value) -> str:
    return "N/A" if value is None else f"{value:.2f}"


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
