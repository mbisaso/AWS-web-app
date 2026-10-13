from datetime import date, datetime, timedelta, timezone

from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, TestCase

from stations.management.commands.send_daily_performance_report import Command
from stations.models import DailyPerformanceReportSettings
from stations.performance_reports import SENSOR_FIELDS
from stations.report_email import (
	build_email_html,
	build_report_pdf,
	summarize_reports,
)


def make_station_report(code, actual, expected, battery_average, downtime, latency):
	period_start = datetime(2026, 10, 12, tzinfo=timezone.utc)
	period_end = period_start + timedelta(days=1)
	sensors = {
		field: {
			"total_readings": actual,
			"null_readings": 2 if field == "humidity" else 0,
			"completeness_pct": round(
				(actual - (2 if field == "humidity" else 0)) / actual * 100, 2
			) if actual else 0.0,
		}
		for field in SENSOR_FIELDS
	}
	return {
		"station_name": f"Test {code}",
		"station_code": code,
		"period_start": period_start.isoformat(),
		"period_end": period_end.isoformat(),
		"data_availability_pct": round(actual / expected * 100, 2),
		"expected_readings": expected,
		"actual_readings": actual,
		"transmission_success_pct": round(actual / expected * 100, 2),
		"avg_latency_seconds": latency,
		"uptime_pct": 98.0,
		"total_downtime_minutes": downtime,
		"downtime_incidents": 1,
		"total_gaps": 2,
		"low_battery_events": 1,
		"power": {
			"volt_batt_min": battery_average - 1,
			"volt_batt_avg": battery_average,
			"volt_batt_max": battery_average + 1,
			"volt_solar_min": 0.0,
			"volt_solar_avg": 9.0,
			"volt_solar_max": 18.0,
			"low_battery_events": 1,
		},
		"sensors": sensors,
		"active_faults": ["humidity"],
		"gaps": [],
	}


class DailyPerformanceReportTests(SimpleTestCase):
	def setUp(self):
		self.stations = [
			make_station_report("AWS-TEST-1", 90, 96, 12.0, 30, 40.0),
			make_station_report("AWS-TEST-2", 48, 96, 11.0, 60, 10.0),
		]

	def test_summary_weights_rates_by_expected_readings(self):
		summary = summarize_reports(self.stations)

		self.assertEqual(summary["station_count"], 2)
		self.assertEqual(summary["actual_readings"], 138)
		self.assertEqual(summary["expected_readings"], 192)
		self.assertEqual(summary["data_availability_pct"], 71.88)
		self.assertEqual(summary["transmission_success_pct"], 71.88)
		self.assertEqual(summary["uptime_pct"], 96.88)
		self.assertEqual(summary["power"]["volt_batt_avg"], 11.65)

	def test_email_and_pdf_render_station_summary(self):
		report = {
			"report_date": date(2026, 10, 12),
			"stations": self.stations,
			"summary": summarize_reports(self.stations),
		}

		email_html = build_email_html(report)
		pdf = build_report_pdf(report)

		self.assertIn("Overall sensor completeness", email_html)
		self.assertIn("AWS-TEST-1", email_html)
		self.assertTrue(pdf.startswith(b"%PDF-"))


class DailyPerformanceRecipientTests(TestCase):
	def test_selected_group_includes_only_selected_active_users_with_email(self):
		user_model = get_user_model()
		selected_user = user_model.objects.create_user(
			username="selected-recipient",
			email="selected@example.com",
			password="test-password",
		)
		inactive_user = user_model.objects.create_user(
			username="inactive-recipient",
			email="inactive@example.com",
			password="test-password",
			is_active=False,
		)
		unselected_user = user_model.objects.create_user(
			username="unselected-recipient",
			email="unselected@example.com",
			password="test-password",
		)
		settings = DailyPerformanceReportSettings.objects.create(
			recipient_group=DailyPerformanceReportSettings.RecipientGroup.SELECTED,
		)
		settings.selected_users.set([selected_user, inactive_user])

		self.assertEqual(Command._get_recipients(settings), ["selected@example.com"])
