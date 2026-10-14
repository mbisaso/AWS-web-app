from datetime import date, datetime, time, timedelta, timezone
from io import StringIO
from unittest import mock

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.management import call_command
from django.test import SimpleTestCase, TestCase
from django.utils import timezone as django_timezone
from rest_framework.test import APIClient

from stations.management.commands.send_daily_performance_report import Command
from stations.models import (
	DailyPerformanceReportSettings,
	MaintenanceLog,
	SensorReading,
	Station,
	StationStatus,
)
from stations.performance_reports import SENSOR_FIELDS, build_performance_report_data
from stations.report_email import (
	build_daily_report,
	build_email_html,
	build_report_pdf,
	build_station_report_pdf,
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
			"fault_events": 1 if field == "humidity" else 0,
			"fault_minutes": 30.0 if field == "humidity" else 0.0,
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
		"on_time_readings": actual,
		"on_time_intervals": actual,
		"clock_ahead_readings": 0,
		"duplicate_readings": 0,
		"covered_intervals": actual,
		"communication_interruptions": 1,
		"communication_interruption_minutes": 45.0,
		"communication_events": [],
		"sensor_fault_events": 1,
		"maintenance_count": 1,
		"maintenance_events": [],
		"fault_events": [],
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
			"battery_temp_min": 20.0,
			"battery_temp_avg": 25.0,
			"battery_temp_max": 30.0,
			"low_battery_events": 1,
			"charging_hours": 6.0,
			"discharging_hours": 12.0,
			"measured_hours": 24.0,
			"charging_pct": 25.0,
			"power_outages": 1,
			"power_outage_minutes": 60.0,
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
		self.assertEqual(summary["communication_interruptions"], 2)
		self.assertEqual(summary["sensor_fault_events"], 2)
		self.assertEqual(summary["power"]["charging_pct"], 25.0)
		self.assertEqual(summary["power"]["power_outages"], 2)
		self.assertEqual(summary["uptime_pct"], 71.88)
		self.assertEqual(summary["power"]["volt_batt_avg"], 11.65)

	def test_email_and_pdf_render_station_summary(self):
		report = {
			"report_date": date(2026, 10, 12),
			"stations": self.stations,
			"summary": summarize_reports(self.stations),
		}

		email_html = build_email_html(report)
		pdf = build_report_pdf(report)

		self.assertIn("Overall sensor health", email_html)
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


REPORT_DAY = date(2026, 10, 12)


def local_day_start():
	return django_timezone.make_aware(
		datetime.combine(REPORT_DAY, datetime.min.time()),
		django_timezone.get_current_timezone(),
	)


def add_readings(station, start, end, step_minutes=15, **fields):
	rows = []
	current = start
	while current < end:
		rows.append(SensorReading(**{
			"station": station,
			"station_code": station.station_id,
			"timestamp": current,
			"temperature": 20.0 + len(rows) % 10,
			"volt_batt": 12.5,
			**fields,
		}))
		current += timedelta(minutes=step_minutes)
	SensorReading.objects.bulk_create(rows)
	# received_at is auto_now_add, so set realistic on-time arrivals afterwards.
	for reading in SensorReading.objects.filter(timestamp__gte=start, timestamp__lt=end):
		SensorReading.objects.filter(pk=reading.pk).update(
			received_at=reading.timestamp + timedelta(minutes=1)
		)


class PerformanceReportDataTests(TestCase):
	def setUp(self):
		self.station = Station.objects.create(name="Probe", station_id="AWS-PROBE")
		self.start = local_day_start()
		self.end = self.start + timedelta(days=1)

	def build(self):
		return build_performance_report_data(self.station, self.start, self.end)

	def test_complete_day_has_full_uptime_and_no_gaps(self):
		add_readings(self.station, self.start, self.end)

		report = self.build()

		self.assertEqual(report["data_availability_pct"], 100.0)
		self.assertEqual(report["uptime_pct"], 100.0)
		self.assertEqual(report["total_gaps"], 0)
		self.assertEqual(report["downtime_incidents"], 0)

	def test_outage_after_last_reading_is_reported(self):
		add_readings(self.station, self.start, self.start + timedelta(hours=10))

		report = self.build()

		self.assertEqual(report["uptime_pct"], 41.67)
		self.assertEqual(report["total_downtime_minutes"], 840)
		self.assertEqual(report["downtime_incidents"], 1)
		self.assertEqual(report["total_gaps"], 1)
		self.assertEqual(report["gaps"][0]["missed_readings"], 56)
		self.assertEqual(report["gaps"][0]["end"], self.end.isoformat())

	def test_outage_before_first_reading_is_reported(self):
		add_readings(self.station, self.start + timedelta(hours=12), self.end)

		report = self.build()

		self.assertEqual(report["uptime_pct"], 50.0)
		self.assertEqual(report["gaps"][0]["start"], self.start.isoformat())
		self.assertEqual(report["gaps"][0]["duration_minutes"], 720)
		self.assertEqual(report["gaps"][0]["missed_readings"], 48)

	def test_station_with_no_readings_is_fully_down(self):
		report = self.build()

		self.assertEqual(report["uptime_pct"], 0.0)
		self.assertEqual(report["total_downtime_minutes"], 1440)
		self.assertEqual(report["downtime_incidents"], 1)
		self.assertEqual(report["gaps"][0]["missed_readings"], 96)

	def test_off_schedule_readings_still_count_as_up(self):
		add_readings(self.station, self.start + timedelta(minutes=7), self.end)

		report = self.build()

		self.assertEqual(report["uptime_pct"], 100.0)
		self.assertEqual(report["total_gaps"], 0)

	def test_offset_schedule_has_no_edge_gaps_and_gap_times_are_local(self):
		self.station.expected_interval_minutes = 30
		self.station.save()
		add_readings(self.station, self.start + timedelta(minutes=20), self.start + timedelta(hours=4), step_minutes=30)
		add_readings(self.station, self.start + timedelta(hours=11, minutes=20), self.end, step_minutes=30)

		report = self.build()

		self.assertEqual(report["total_gaps"], 1)
		gap = report["gaps"][0]
		self.assertEqual(gap["start"], (self.start + timedelta(hours=3, minutes=50)).isoformat())
		self.assertEqual(gap["end"], (self.start + timedelta(hours=11, minutes=20)).isoformat())
		self.assertEqual(gap["missed_readings"], 14)

	def test_sparse_readings_reduce_uptime(self):
		add_readings(self.station, self.start, self.end, step_minutes=60)

		report = self.build()

		self.assertEqual(report["uptime_pct"], 25.0)
		self.assertEqual(report["downtime_incidents"], 24)

	def test_duplicate_readings_are_counted_once(self):
		half_day = self.start + timedelta(hours=12)
		add_readings(self.station, self.start, half_day, humidity=None)
		add_readings(self.station, self.start, half_day, humidity=60.0)

		report = self.build()

		self.assertEqual(report["actual_readings"], 48)
		self.assertEqual(report["data_availability_pct"], 50.0)
		self.assertEqual(report["sensors"]["temperature"]["null_readings"], 0)
		self.assertEqual(report["sensors"]["humidity"]["null_readings"], 0)

	def test_transmission_counts_readings_received_within_one_interval(self):
		add_readings(self.station, self.start, self.start + timedelta(hours=1))
		readings = SensorReading.objects.order_by("timestamp")
		delays = [timedelta(minutes=1), timedelta(minutes=5), timedelta(hours=2), timedelta(minutes=-10)]
		for reading, delay in zip(readings, delays):
			SensorReading.objects.filter(pk=reading.pk).update(received_at=reading.timestamp + delay)

		report = self.build()

		self.assertEqual(report["on_time_readings"], 3)
		self.assertEqual(report["transmission_success_pct"], 3.12)
		self.assertEqual(report["clock_ahead_readings"], 1)
		self.assertEqual(report["avg_latency_seconds"], (60 + 300 + 7200) / 3)

	def test_late_backlog_is_a_communication_interruption(self):
		add_readings(self.station, self.start, self.start + timedelta(hours=6))
		backlog_arrival = self.start + timedelta(hours=4, minutes=30)
		SensorReading.objects.filter(
			timestamp__gte=self.start + timedelta(hours=2),
			timestamp__lte=self.start + timedelta(hours=4),
		).update(received_at=backlog_arrival)

		report = self.build()

		self.assertEqual(report["communication_interruptions"], 1)
		event = report["communication_events"][0]
		self.assertEqual(event["start"], (self.start + timedelta(hours=2)).isoformat())
		self.assertEqual(event["end"], backlog_arrival.isoformat())
		self.assertEqual(event["delayed_readings"], 9)
		self.assertEqual(report["communication_interruption_minutes"], 150)

	def test_charging_time_and_battery_temperature(self):
		midday = self.start + timedelta(hours=6)
		add_readings(self.station, self.start, midday, curr_batt=0.2, battery_temp=20.0)
		add_readings(self.station, midday, midday + timedelta(hours=6), curr_batt=-0.5, battery_temp=30.0)

		power = self.build()["power"]

		self.assertEqual(power["charging_hours"], 6.0)
		self.assertEqual(power["discharging_hours"], 6.0)
		self.assertEqual(power["charging_pct"], 50.0)
		self.assertEqual(power["battery_temp_min"], 20.0)
		self.assertEqual(power["battery_temp_max"], 30.0)

	def test_outage_after_low_battery_is_power_related(self):
		add_readings(self.station, self.start, self.start + timedelta(hours=6), volt_batt=10.8)

		report = self.build()

		self.assertEqual(report["gaps"][0]["cause"], "low_battery")
		self.assertEqual(report["power"]["power_outages"], 1)
		self.assertEqual(report["power"]["power_outage_minutes"], 1095)

	def test_sensor_faults_record_type_and_duration(self):
		add_readings(self.station, self.start, self.start + timedelta(hours=12), humidity=60.0)
		SensorReading.objects.filter(
			timestamp__gte=self.start + timedelta(hours=1),
			timestamp__lt=self.start + timedelta(hours=2),
		).update(temperature=None)
		SensorReading.objects.filter(timestamp=self.start + timedelta(hours=5)).update(temperature=75.0)

		report = self.build()

		temperature = report["sensors"]["temperature"]
		self.assertEqual(temperature["faults_by_type"], {"missing": 1, "out_of_range": 1, "stuck": 0})
		self.assertEqual(temperature["fault_minutes"], 75)
		humidity = report["sensors"]["humidity"]
		self.assertEqual(humidity["faults_by_type"]["stuck"], 1)
		self.assertEqual(humidity["fault_minutes"], 720)
		self.assertIn(
			{"sensor": "temperature", "type": "out_of_range"},
			[{"sensor": event["sensor"], "type": event["type"]} for event in report["fault_events"]],
		)

	def test_short_constant_value_is_not_stuck(self):
		add_readings(self.station, self.start, self.start + timedelta(hours=3), humidity=60.0)

		self.assertEqual(self.build()["sensors"]["humidity"]["fault_events"], 0)

	def test_extra_readings_do_not_raise_transmission_above_schedule(self):
		add_readings(self.station, self.start, self.start + timedelta(hours=12), step_minutes=5)

		report = self.build()

		self.assertEqual(report["on_time_readings"], 144)
		self.assertEqual(report["transmission_success_pct"], 50.0)

	def test_interruption_stops_where_station_outage_starts(self):
		add_readings(self.station, self.start, self.start + timedelta(hours=4))
		add_readings(self.station, self.start + timedelta(hours=10), self.end)
		SensorReading.objects.filter(
			timestamp__gte=self.start + timedelta(hours=3),
			timestamp__lt=self.start + timedelta(hours=4),
		).update(received_at=self.start + timedelta(hours=10))

		event = self.build()["communication_events"][0]

		self.assertEqual(event["end"], (self.start + timedelta(hours=4)).isoformat())

	def test_wind_vane_in_calm_air_is_not_stuck(self):
		add_readings(self.station, self.start, self.start + timedelta(hours=8), wind_direction=270.0, wind_speed=0.5)
		add_readings(self.station, self.start + timedelta(hours=8), self.start + timedelta(hours=16), wind_direction=90.0, wind_speed=12.0)

		wind_direction = self.build()["sensors"]["wind_direction"]

		self.assertEqual(wind_direction["faults_by_type"]["stuck"], 1)
		self.assertEqual(wind_direction["fault_minutes"], 480)

	def test_duplicate_readings_are_logger_errors(self):
		add_readings(self.station, self.start, self.start + timedelta(hours=1))
		add_readings(self.station, self.start, self.start + timedelta(hours=1))

		self.assertEqual(self.build()["duplicate_readings"], 4)

	def test_reading_linked_only_by_station_code_is_counted(self):
		SensorReading.objects.create(
			station=None,
			station_code="AWS-PROBE",
			timestamp=self.start + timedelta(hours=1),
		)

		self.assertEqual(self.build()["actual_readings"], 1)

	def test_missing_status_is_not_logged(self):
		with self.assertNoLogs("stations.performance_reports", level="WARNING"):
			report = self.build()

		self.assertEqual(report["active_faults"], [])

	def test_faults_are_read_from_status(self):
		StationStatus.objects.create(station=self.station, details={"faulty_sensors": ["humidity"]})
		self.station.refresh_from_db()

		self.assertEqual(self.build()["active_faults"], ["humidity"])

	def test_generated_at_is_report_creation_time(self):
		before = django_timezone.now()

		generated_at = datetime.fromisoformat(self.build()["generated_at"])

		self.assertGreaterEqual(generated_at, before)

	def test_daily_report_covers_local_calendar_day(self):
		SensorReading.objects.create(
			station=self.station,
			station_code="AWS-PROBE",
			timestamp=self.start + timedelta(hours=23, minutes=30),
		)
		SensorReading.objects.create(
			station=self.station,
			station_code="AWS-PROBE",
			timestamp=self.end + timedelta(minutes=30),
		)

		report = build_daily_report(REPORT_DAY)

		self.assertEqual(report["stations"][0]["actual_readings"], 1)
		self.assertTrue(build_report_pdf(report).startswith(b"%PDF-"))


class SendDailyPerformanceReportCommandTests(TestCase):
	def setUp(self):
		user_model = get_user_model()
		user_model.objects.create_user("admin1", "admin1@example.com", "x", role="admin")
		user_model.objects.create_user("viewer1", "viewer1@example.com", "x")
		station = Station.objects.create(name="Cmd", station_id="AWS-CMD")
		start = local_day_start()
		add_readings(station, start, start + timedelta(days=1))
		self.settings = DailyPerformanceReportSettings.objects.create(
			enabled=True,
			send_time=time(8, 0),
		)
		self.now = start + timedelta(days=1, hours=9)

	def run_command(self, *args):
		with mock.patch("django.utils.timezone.now", return_value=self.now):
			call_command("send_daily_performance_report", *args, stdout=StringIO())

	def test_sends_previous_day_report_once(self):
		self.run_command()
		self.run_command()

		self.assertEqual(len(mail.outbox), 1)
		message = mail.outbox[0]
		self.assertEqual(message.bcc, ["admin1@example.com"])
		self.assertIn(REPORT_DAY.isoformat(), message.subject)
		self.assertEqual(message.attachments[0][2], "application/pdf")
		self.settings.refresh_from_db()
		self.assertEqual(self.settings.last_sent_on, REPORT_DAY + timedelta(days=1))

	def test_waits_for_send_time(self):
		self.now -= timedelta(hours=2)

		self.run_command()

		self.assertEqual(len(mail.outbox), 0)

	def test_disabled_schedule_sends_nothing(self):
		self.settings.enabled = False
		self.settings.save()

		self.run_command()

		self.assertEqual(len(mail.outbox), 0)

	def test_dry_run_sends_nothing(self):
		self.run_command("--dry-run")

		self.assertEqual(len(mail.outbox), 0)
		self.settings.refresh_from_db()
		self.assertIsNone(self.settings.last_sent_on)

	def test_all_active_group_includes_every_active_user(self):
		self.settings.recipient_group = DailyPerformanceReportSettings.RecipientGroup.ALL_ACTIVE
		self.settings.save()

		self.run_command()

		self.assertEqual(
			sorted(mail.outbox[0].bcc),
			["admin1@example.com", "viewer1@example.com"],
		)

	def test_failed_send_is_not_marked_sent(self):
		with mock.patch(
			"django.core.mail.EmailMultiAlternatives.send",
			side_effect=OSError("smtp down"),
		):
			with self.assertRaises(OSError):
				self.run_command()

		self.settings.refresh_from_db()
		self.assertIsNone(self.settings.last_sent_on)


class MaintenanceLogTests(TestCase):
	def setUp(self):
		user_model = get_user_model()
		self.admin = user_model.objects.create_user("maint-admin", "maint-admin@example.com", "x", role="admin")
		self.viewer = user_model.objects.create_user("maint-viewer", "maint-viewer@example.com", "x", role="viewer")
		self.station = Station.objects.create(name="Probe", station_id="AWS-PROBE")
		self.start = local_day_start()
		self.end = self.start + timedelta(days=1)
		self.client = APIClient()

	def create_entry(self, **fields):
		return MaintenanceLog.objects.create(**{
			"station": self.station,
			"activity_type": MaintenanceLog.ActivityType.REPAIR,
			"started_at": self.start + timedelta(hours=10),
			"ended_at": self.start + timedelta(hours=14),
			"description": "Replaced the battery",
			**fields,
		})

	def test_report_lists_maintenance_and_flags_gaps_during_it(self):
		add_readings(self.station, self.start, self.start + timedelta(hours=10))
		add_readings(self.station, self.start + timedelta(hours=14), self.end)
		self.create_entry()
		self.create_entry(started_at=self.start - timedelta(days=3), ended_at=self.start - timedelta(days=2))

		report = build_performance_report_data(self.station, self.start, self.end)

		self.assertEqual(report["maintenance_count"], 1)
		self.assertEqual(report["maintenance_events"][0]["activity_label"], "Repair")
		self.assertEqual(report["gaps"][0]["during_maintenance"], True)
		pdf = build_station_report_pdf(report)
		self.assertTrue(pdf.startswith(b"%PDF-"))

	def test_entry_without_end_time_is_included(self):
		self.create_entry(ended_at=None)

		report = build_performance_report_data(self.station, self.start, self.end)

		self.assertEqual(report["maintenance_events"][0]["end"], None)

	def test_editor_can_create_update_and_delete(self):
		self.client.force_authenticate(self.admin)

		response = self.client.post("/api/maintenance/", {
			"station_code": "AWS-PROBE",
			"activity_type": "cleaning",
			"started_at": (self.start + timedelta(hours=9)).isoformat(),
			"description": "Cleaned the solar panel",
			"performed_by": "Field team",
		}, format="json")

		self.assertEqual(response.status_code, 201)
		entry_id = response.data["data"]["id"]
		self.assertEqual(response.data["data"]["created_by"], "maint-admin@example.com")
		self.assertEqual(MaintenanceLog.objects.get(id=entry_id).created_by, self.admin)

		response = self.client.patch(f"/api/maintenance/{entry_id}/", {"description": "Cleaned panel and vane"}, format="json")
		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data["data"]["description"], "Cleaned panel and vane")

		response = self.client.delete(f"/api/maintenance/{entry_id}/")
		self.assertEqual(response.status_code, 200)
		self.assertFalse(MaintenanceLog.objects.exists())

	def test_viewer_can_read_but_not_write(self):
		self.create_entry()
		self.client.force_authenticate(self.viewer)

		response = self.client.get("/api/maintenance/", {"station_id": "AWS-PROBE"})
		self.assertEqual(response.status_code, 200)
		self.assertEqual(len(response.data["data"]), 1)

		response = self.client.post("/api/maintenance/", {
			"station_code": "AWS-PROBE",
			"activity_type": "reset",
			"started_at": self.start.isoformat(),
			"description": "Restarted logger",
		}, format="json")
		self.assertEqual(response.status_code, 403)

	def test_anonymous_user_is_rejected(self):
		self.assertIn(self.client.get("/api/maintenance/").status_code, (401, 403))

	def test_end_before_start_is_rejected(self):
		self.client.force_authenticate(self.admin)

		response = self.client.post("/api/maintenance/", {
			"station_code": "AWS-PROBE",
			"activity_type": "repair",
			"started_at": (self.start + timedelta(hours=5)).isoformat(),
			"ended_at": (self.start + timedelta(hours=4)).isoformat(),
			"description": "Backwards",
		}, format="json")

		self.assertEqual(response.status_code, 400)
		self.assertIn("End time must be after the start time", response.data["error"])

	def test_list_filters_by_station_and_window(self):
		self.create_entry()
		self.create_entry(started_at=self.start - timedelta(days=5), ended_at=self.start - timedelta(days=4))
		other = Station.objects.create(name="Other", station_id="AWS-OTHER")
		self.create_entry(station=other)
		self.client.force_authenticate(self.viewer)

		response = self.client.get("/api/maintenance/", {
			"station_id": "AWS-PROBE",
			"start": self.start.isoformat(),
			"end": self.end.isoformat(),
		})

		self.assertEqual([item["description"] for item in response.data["data"]], ["Replaced the battery"])
