from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import EmailMultiAlternatives
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from stations.models import DailyPerformanceReportSettings
from stations.report_email import build_daily_report, build_email_html, build_email_text, build_report_pdf


class Command(BaseCommand):
    help = "Send the configured previous-day station performance report email."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Send now even if scheduling is disabled or not yet due.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Render the report and list recipients without sending or marking it sent.",
        )

    def handle(self, *args, **options):
        force = options["force"]
        dry_run = options["dry_run"]
        local_now = timezone.localtime()
        today = local_now.date()

        with transaction.atomic():
            report_settings, _ = DailyPerformanceReportSettings.objects.get_or_create(
                pk=1,
                defaults={
                    "recipient_group": DailyPerformanceReportSettings.RecipientGroup.ADMINS,
                    "send_time": "08:00",
                    "enabled": False,
                },
            )
            report_settings = DailyPerformanceReportSettings.objects.select_for_update().get(pk=1)

            if not force and not dry_run:
                if not report_settings.enabled:
                    self.stdout.write("Daily performance email is disabled.")
                    return
                if local_now.time() < report_settings.send_time:
                    self.stdout.write("Configured send time has not been reached yet.")
                    return
                if report_settings.last_sent_on == today:
                    self.stdout.write("Daily performance email was already sent today.")
                    return

            recipients = self._get_recipients(report_settings)
            if not recipients:
                raise CommandError("No eligible registered email recipients were found.")

            report_date = today - timedelta(days=1)
            report = build_daily_report(report_date)
            if not report["stations"]:
                raise CommandError("No stations are registered; no report was sent.")

            pdf = build_report_pdf(report)
            if dry_run:
                self.stdout.write(self.style.SUCCESS(
                    f"Dry run ready: {len(recipients)} recipient(s), "
                    f"{len(report['stations'])} station(s), "
                    f"{len(pdf)}-byte PDF for {report_date.isoformat()}."
                ))
                self.stdout.write("Recipients: " + ", ".join(recipients))
                return

            subject = f"Daily AWS Performance Report - {report_date.isoformat()}"
            message = EmailMultiAlternatives(
                subject=subject,
                body=build_email_text(report),
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[],
                bcc=recipients,
            )
            message.attach_alternative(build_email_html(report), "text/html")
            message.attach(
                f"daily-performance-{report_date.isoformat()}.pdf",
                pdf,
                "application/pdf",
            )
            sent_count = message.send()
            if sent_count != 1:
                raise CommandError("The email backend did not confirm successful delivery.")

            report_settings.last_sent_on = today
            report_settings.save(update_fields=["last_sent_on", "updated_at"])

        self.stdout.write(self.style.SUCCESS(
            f"Sent the {report_date.isoformat()} performance report to "
            f"{len(recipients)} recipient(s)."
        ))

    @staticmethod
    def _get_recipients(report_settings):
        user_model = get_user_model()
        users = user_model.objects.filter(is_active=True).exclude(email="")
        if report_settings.recipient_group == DailyPerformanceReportSettings.RecipientGroup.ADMINS:
            users = users.filter(
                Q(role="admin") | Q(is_staff=True) | Q(is_superuser=True)
            )
        elif report_settings.recipient_group == DailyPerformanceReportSettings.RecipientGroup.SELECTED:
            users = report_settings.selected_users.filter(is_active=True).exclude(email="")
        return list(dict.fromkeys(users.values_list("email", flat=True)))
