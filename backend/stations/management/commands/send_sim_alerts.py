from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from stations import sim_alerts


class Command(BaseCommand):
    help = "Email a warning for SIM bundles that are about to expire or run out of data."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="List the warnings and recipients without sending or marking them sent.",
        )

    def handle(self, *args, dry_run=False, **options):
        alert_settings = sim_alerts.get_alert_settings()
        if not alert_settings.enabled and not dry_run:
            self.stdout.write("SIM alert emails are disabled.")
            return

        alerts = sim_alerts.due_alerts(alert_settings)
        if not alerts:
            self.stdout.write("No SIM bundles need a warning.")
            return

        recipients = sim_alerts.get_recipients(alert_settings)
        for alert in alerts:
            station, phone, problem, _ = sim_alerts.describe(alert)
            self.stdout.write(f"- {station}, SIM {phone}: {problem}")
        if dry_run:
            self.stdout.write(f"Dry run: would email {len(recipients)} recipient(s): {', '.join(recipients) or 'none'}")
            return
        if not recipients:
            raise CommandError("No eligible registered email recipients were found.")

        with transaction.atomic():
            if sim_alerts.build_email(alerts, recipients).send() != 1:
                raise CommandError("The email backend did not confirm successful delivery.")
            sim_alerts.mark_sent(alerts)

        self.stdout.write(self.style.SUCCESS(f"Sent {len(alerts)} SIM warning(s) to {len(recipients)} recipient(s)."))
