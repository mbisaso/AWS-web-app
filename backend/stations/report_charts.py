"""Charts for the performance report PDF, drawn with ReportLab graphics."""
import math
from datetime import datetime, timedelta

from django.utils import timezone
from reportlab.graphics.shapes import Circle, Drawing, Line, PolyLine, Rect, String
from reportlab.lib import colors

from .performance_reports import LOW_BATTERY_VOLTS

SERIES_BLUE = colors.HexColor("#2a78d6")
SERIES_ORANGE = colors.HexColor("#eb6834")
STATUS_COLORS = {
    "on_time": colors.HexColor("#0ca30c"),
    "late": colors.HexColor("#fab219"),
    "missing": colors.HexColor("#d03b3b"),
}
STATUS_LABELS = {"on_time": "On time", "late": "Arrived late", "missing": "Missing"}
GRID = colors.HexColor("#e3eaf0")

FONT = "Helvetica"
FONT_BOLD = "Helvetica-Bold"
TICK_SIZE = 6.5
TITLE_SIZE = 8.5

# label, unit, how to draw it
SENSOR_CHARTS = {
    "temperature": ("Temperature", "°C", "line"),
    "humidity": ("Humidity", "%", "line"),
    "pressure": ("Pressure", "hPa", "line"),
    "wind_speed": ("Wind speed", "m/s", "line"),
    "wind_direction": ("Wind direction", "°", "line"),
    "solar_radiation": ("Solar radiation", "W/m²", "line"),
    "soil_moisture": ("Soil moisture", "%", "line"),
    "rain": ("Rain", "mm", "bars"),
}

LEFT, RIGHT, TOP, BOTTOM = 34, 10, 16, 14


class TimeAxis:
    """Maps times in the report period to x positions."""

    def __init__(self, report, x0, width):
        self.start = timezone.localtime(datetime.fromisoformat(report["period_start"]))
        self.end = timezone.localtime(datetime.fromisoformat(report["period_end"]))
        self.total = max(1.0, (self.end - self.start).total_seconds() / 60)
        self.x0 = x0
        self.width = width

    def x(self, minutes):
        return self.x0 + self.width * min(max(minutes, 0), self.total) / self.total

    def anchor(self, x):
        """Labels at either end of the axis align inwards so they stay inside the chart."""
        if x - self.x0 < 24:
            return "start"
        if self.x0 + self.width - x < 24:
            return "end"
        return "middle"

    def ticks(self):
        """Local-time ticks at a spacing that leaves room for each label."""
        max_ticks = max(2, int(self.width // 62))
        hours = self.total / 60
        step_hours = next(
            (step for step in (1, 2, 3, 6, 12, 24, 48, 72, 168, 336) if hours / step <= max_ticks),
            672,
        )
        midnight = self.start.replace(hour=0, minute=0, second=0, microsecond=0)
        tick = midnight
        while tick < self.start:
            tick += timedelta(hours=step_hours)
        label_format = "%d %b %H:%M" if step_hours < 24 else "%d %b"
        result = []
        while tick <= self.end:
            minutes = (tick - self.start).total_seconds() / 60
            result.append((self.x(minutes), tick.strftime(label_format)))
            tick += timedelta(hours=step_hours)
        return result


def _nice_step(span, count=4):
    raw = span / count
    magnitude = 10 ** math.floor(math.log10(raw))
    for factor in (1, 2, 5, 10):
        if raw <= factor * magnitude:
            return factor * magnitude
    return 10 * magnitude


def _value_ticks(low, high):
    if low == high:
        pad = abs(low) * 0.1 or 1
        low, high = low - pad, high + pad
    step = _nice_step(high - low)
    first = math.floor(low / step) * step
    last = math.ceil(high / step) * step
    ticks = []
    value = first
    while value <= last + step / 2:
        ticks.append(round(value, 6))
        value += step
    decimals = 0 if step >= 1 else 1 if step >= 0.1 else 2
    return ticks, decimals


def _frame(drawing, axis, y_ticks, y_of, labels, theme):
    """Draws recessive gridlines, value labels and time labels."""
    for value, label in zip(y_ticks, labels):
        y = y_of(value)
        drawing.add(Line(axis.x0, y, axis.x0 + axis.width, y, strokeColor=GRID, strokeWidth=0.5))
        drawing.add(String(axis.x0 - 4, y - 2, label, fontName=FONT, fontSize=TICK_SIZE,
                           fillColor=theme["muted"], textAnchor="end"))
    for x, label in axis.ticks():
        drawing.add(Line(x, BOTTOM, x, BOTTOM - 2, strokeColor=theme["muted"], strokeWidth=0.5))
        drawing.add(String(x, BOTTOM - 9, label, fontName=FONT, fontSize=TICK_SIZE,
                           fillColor=theme["muted"], textAnchor=axis.anchor(x)))


def _title(drawing, height, text, theme):
    drawing.add(String(LEFT, height - 10, text, fontName=FONT_BOLD, fontSize=TITLE_SIZE, fillColor=theme["ink"]))


def _empty(drawing, width, height, message, theme):
    drawing.add(Rect(LEFT, BOTTOM, width - LEFT - RIGHT, height - TOP - BOTTOM,
                     fillColor=colors.HexColor("#f6f8fa"), strokeColor=GRID, strokeWidth=0.5))
    drawing.add(String(LEFT + (width - LEFT - RIGHT) / 2, BOTTOM + (height - TOP - BOTTOM) / 2 - 3,
                       message, fontName=FONT, fontSize=8, fillColor=theme["muted"], textAnchor="middle"))


def _segments(values, x_of, y_of, wrap=None):
    """Splits a series at missing steps so gaps show as breaks.

    With wrap (e.g. 360 for wind direction), the line also breaks where the
    value crosses north, so 355 to 5 degrees is not drawn as a swing across
    the whole chart.
    """
    segment = []
    previous = None
    for index, value in enumerate(values):
        crosses = wrap is not None and previous is not None and value is not None and abs(value - previous) > wrap / 2
        if value is None or crosses:
            if segment:
                yield segment
            segment = []
        if value is not None:
            segment.append((x_of(index), y_of(value)))
        previous = value
    if segment:
        yield segment


def time_series_chart(report, width, height, title, series, theme, kind="line",
                      fixed_range=None, threshold=None, direction_labels=False, wrap=None):
    """A chart of one or two series over the report period.

    series: list of (label, values, color). Two series share one axis and get
    a legend plus a direct label at the end of each line.
    """
    drawing = Drawing(width, height)
    _title(drawing, height, title, theme)
    data = report["chart_data"]
    step = data["step_minutes"]
    present = [value for _, values, _ in series for value in values if value is not None]
    if not present:
        _empty(drawing, width, height, "No data in this period", theme)
        return drawing

    axis = TimeAxis(report, LEFT, width - LEFT - RIGHT)
    if fixed_range:
        y_ticks = list(fixed_range[2])
        low, high = fixed_range[0], fixed_range[1]
        decimals = 0
    else:
        candidates = present + ([threshold[0]] if threshold else [])
        low = 0 if kind == "bars" else min(candidates)
        high = max(candidates)
        if kind == "bars" and high <= low:
            high = 1
        y_ticks, decimals = _value_ticks(low, high)
        low, high = y_ticks[0], y_ticks[-1]
    plot_height = height - TOP - BOTTOM

    def y_of(value):
        return BOTTOM + plot_height * (value - low) / (high - low)

    def x_of(index):
        return axis.x((index + 0.5) * step)

    labels = (
        ["N", "E", "S", "W", "N"] if direction_labels
        else [f"{value:.{decimals}f}" for value in y_ticks]
    )
    _frame(drawing, axis, y_ticks, y_of, labels, theme)

    for label, values, color in series:
        if kind == "bars":
            bar_width = max(0.6, axis.width * step / axis.total - 1)
            for index, value in enumerate(values):
                if value:
                    drawing.add(Rect(x_of(index) - bar_width / 2, y_of(0), bar_width, y_of(value) - y_of(0),
                                     fillColor=color, strokeColor=None))
            if not any(values):
                drawing.add(String(axis.x0 + axis.width / 2, BOTTOM + plot_height / 2, "No rain recorded",
                                   fontName=FONT, fontSize=8, fillColor=theme["muted"], textAnchor="middle"))
        else:
            for points in _segments(values, x_of, y_of, wrap):
                if len(points) == 1:
                    drawing.add(Circle(points[0][0], points[0][1], 1.2, fillColor=color, strokeColor=None))
                else:
                    drawing.add(PolyLine([coord for point in points for coord in point],
                                         strokeColor=color, strokeWidth=1.4, strokeLineJoin=1))

    if threshold:
        y = y_of(threshold[0])
        drawing.add(Line(axis.x0, y, axis.x0 + axis.width, y, strokeColor=theme["muted"],
                         strokeWidth=0.8, strokeDashArray=[3, 2]))
        drawing.add(String(axis.x0 + axis.width - 2, y + 2.5, threshold[1], fontName=FONT, fontSize=TICK_SIZE,
                           fillColor=theme["muted"], textAnchor="end"))

    if len(series) > 1:
        legend_x = width - RIGHT
        for label, _, color in reversed(series):
            text_width = len(label) * 3.6
            drawing.add(String(legend_x, height - 10, label, fontName=FONT, fontSize=7,
                               fillColor=theme["ink"], textAnchor="end"))
            drawing.add(Line(legend_x - text_width - 12, height - 7.5, legend_x - text_width - 3, height - 7.5,
                             strokeColor=color, strokeWidth=2))
            legend_x -= text_width + 22
        # Direct label beside the last point of each line.
        for label, values, color in series:
            last = next((index for index in range(len(values) - 1, -1, -1) if values[index] is not None), None)
            if last is not None:
                drawing.add(String(min(x_of(last) + 3, axis.x0 + axis.width - 2), y_of(values[last]) + 3,
                                   label, fontName=FONT, fontSize=TICK_SIZE, fillColor=theme["ink"],
                                   textAnchor="end" if x_of(last) + 40 > axis.x0 + axis.width else "start"))
    return drawing


def timeline_chart(report, width, theme, interval_label):
    """One coloured block per reporting interval: on time, late or missing."""
    height = 52
    drawing = Drawing(width, height)
    _title(drawing, height, f"Data received per {interval_label}", theme)
    axis = TimeAxis(report, LEFT, width - LEFT - RIGHT)
    interval = report["chart_data"]["interval_minutes"]
    strip_y, strip_height = BOTTOM + 6, 12
    counts = {status: 0 for status in STATUS_COLORS}
    for first, count, status in report["chart_data"]["timeline"]:
        counts[status] += count
        x_start = axis.x(first * interval)
        x_end = axis.x((first + count) * interval)
        drawing.add(Rect(x_start, strip_y, max(0.4, x_end - x_start - 0.6), strip_height,
                         fillColor=STATUS_COLORS[status], strokeColor=None))
    for x, label in axis.ticks():
        drawing.add(Line(x, strip_y - 1, x, strip_y - 3, strokeColor=theme["muted"], strokeWidth=0.5))
        drawing.add(String(x, strip_y - 10, label, fontName=FONT, fontSize=TICK_SIZE,
                           fillColor=theme["muted"], textAnchor=axis.anchor(x)))

    legend_x = width - RIGHT
    for status in reversed(list(STATUS_COLORS)):
        text = f"{STATUS_LABELS[status]} ({counts[status]})"
        drawing.add(String(legend_x, height - 10, text, fontName=FONT, fontSize=7,
                           fillColor=theme["ink"], textAnchor="end"))
        swatch_x = legend_x - len(text) * 3.5 - 10
        drawing.add(Rect(swatch_x, height - 11, 7, 7, fillColor=STATUS_COLORS[status], strokeColor=None))
        legend_x = swatch_x - 10
    return drawing


def power_chart(report, width, theme):
    series = report["chart_data"]["series"]
    return time_series_chart(
        report, width, 120, "Battery and solar panel voltage (V)",
        [("Battery", series["volt_batt"], SERIES_BLUE), ("Solar panel", series["volt_solar"], SERIES_ORANGE)],
        theme, threshold=(LOW_BATTERY_VOLTS, f"Low battery ({LOW_BATTERY_VOLTS:g} V)"),
    )


def sensor_charts(report, width, theme):
    """Small charts, one per sensor, sharing the report's time axis."""
    series = report["chart_data"]["series"]
    charts = []
    for field, (label, unit, kind) in SENSOR_CHARTS.items():
        options = {}
        if field == "wind_direction":
            options = {"fixed_range": (0, 360, (0, 90, 180, 270, 360)), "direction_labels": True, "wrap": 360}
        charts.append(time_series_chart(
            report, width, 100, f"{label} ({unit})", [(label, series[field], SERIES_BLUE)],
            theme, kind=kind, **options,
        ))
    return charts


def daily_uptime_chart(report, width, theme):
    days = report["chart_data"]["daily_uptime"]
    height = 100
    drawing = Drawing(width, height)
    _title(drawing, height, "Station working per day (%)", theme)
    plot_width = width - LEFT - RIGHT
    plot_height = height - TOP - BOTTOM

    def y_of(value):
        return BOTTOM + plot_height * value / 100

    for value in (0, 50, 100):
        drawing.add(Line(LEFT, y_of(value), LEFT + plot_width, y_of(value), strokeColor=GRID, strokeWidth=0.5))
        drawing.add(String(LEFT - 4, y_of(value) - 2, str(value), fontName=FONT, fontSize=TICK_SIZE,
                           fillColor=theme["muted"], textAnchor="end"))
    slot = plot_width / max(1, len(days))
    label_every = max(1, math.ceil(len(days) / (plot_width / 34)))
    for index, day in enumerate(days):
        x = LEFT + slot * index
        bar_height = y_of(day["uptime_pct"]) - y_of(0)
        if bar_height > 0:
            drawing.add(Rect(x + 1, y_of(0), max(0.6, slot - 2), bar_height, fillColor=SERIES_BLUE, strokeColor=None))
        if index % label_every == 0:
            date = datetime.fromisoformat(day["date"])
            drawing.add(String(x + slot / 2, BOTTOM - 9, date.strftime("%d %b"), fontName=FONT,
                               fontSize=TICK_SIZE, fillColor=theme["muted"], textAnchor="middle"))
    return drawing
