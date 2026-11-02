"""
Email warnings for SIM bundles that are about to expire or run out of data.

`send_sim_alerts` runs from cron. Each warning threshold (e.g. 7, 3 and 1 days,
plus 0 for "expired / ran out") is emailed once per bundle; a top-up or a new
expiry date starts a new bundle, so its warnings start over.
"""
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import EmailMultiAlternatives
from django.db.models import Q
from django.utils import timezone
from django.utils.html import escape

from .models import SimAlertNotification, SimAlertSettings, SimCard
from .sim_usage import sim_usage_summary

Kind = SimAlertNotification.Kind


def get_alert_settings():
    alert_settings, _ = SimAlertSettings.objects.get_or_create(pk=1)
    return alert_settings


def get_recipients(alert_settings):
    users = get_user_model().objects.filter(is_active=True).exclude(email="")
    if alert_settings.recipient_group == SimAlertSettings.RecipientGroup.ADMINS:
        users = users.filter(Q(role="admin") | Q(is_staff=True) | Q(is_superuser=True))
    elif alert_settings.recipient_group == SimAlertSettings.RecipientGroup.SELECTED:
        users = alert_settings.selected_users.filter(is_active=True).exclude(email="")
    return list(dict.fromkeys(users.values_list("email", flat=True)))


def due_alerts(alert_settings, today=None):
    """Warnings whose threshold has been reached and not yet emailed for the current bundle."""
    today = today or timezone.localdate()
    thresholds = alert_settings.warning_day_list() + [0]
    alerts = []
    for sim in SimCard.objects.select_related("station"):
        summary = sim_usage_summary(sim)
        checks = []
        if sim.expiry_date:
            checks.append((Kind.EXPIRY, (sim.expiry_date - today).days, f"expiry:{sim.expiry_date.isoformat()}"))
        # Only warn about data when it runs out before the bundle expires anyway.
        if summary["days_to_empty"] is not None and summary["limited_by"] != "expiry":
            checks.append((Kind.DATA, summary["days_to_empty"], f"data:{sim.date_loaded}:{sim.data_limit_mb:g}"))

        for kind, days_left, bundle_key in checks:
            crossed = [t for t in thresholds if days_left <= t]
            if not crossed:
                continue
            threshold = min(crossed)
            already_sent = SimAlertNotification.objects.filter(
                sim=sim, kind=kind, bundle_key=bundle_key, threshold_days__lte=threshold,
            ).exists()
            if not already_sent:
                alerts.append({
                    "sim": sim, "kind": kind, "threshold": threshold, "bundle_key": bundle_key,
                    "days_left": days_left, "summary": summary,
                })
    return alerts


def describe(alert):
    sim, summary, days = alert["sim"], alert["summary"], alert["days_left"]
    station = f"{sim.station.name} ({sim.station.station_id})" if sim.station else "Unassigned SIM"
    if alert["kind"] == Kind.EXPIRY:
        when = sim.expiry_date.strftime("%d %b %Y")
        if days < 0:
            problem = f"bundle expired on {when}"
        elif days == 0:
            problem = f"bundle expires today ({when})"
        else:
            problem = f"bundle expires in {days} day{'s' if days != 1 else ''} on {when}"
    elif days <= 0:
        problem = "data has run out (estimated)"
    else:
        problem = f"data runs out in about {days} day{'s' if days != 1 else ''} (estimated)"
    usage = (
        f"{summary['remaining_mb']:.1f} MB left of {sim.data_limit_mb or 0:g} MB, "
        f"using about {summary['avg_daily_usage_mb']:.2f} MB/day"
    )
    return station, sim.phone_number, problem, usage


def build_email(alerts, recipients):
    sim_url = f"{settings.FRONTEND_URL.rstrip('/')}/dashboard/sim-management"
    count = len({alert["sim"].id for alert in alerts})
    subject = f"[AWS Monitor] {count} SIM bundle{'s' if count != 1 else ''} need{'s' if count == 1 else ''} a top-up"

    rows = [describe(alert) for alert in alerts]
    text = "The following station SIM bundles need attention:\n\n"
    text += "\n".join(f"- {station}, SIM {phone}: {problem}. {usage}." for station, phone, problem, usage in rows)
    text += f"\n\nTop up the bundle with MTN, then record it on the SIM management page:\n{sim_url}\n"

    items = "".join(
        f"<li><strong>{escape(station)}</strong>, SIM {escape(phone)}: {escape(problem)}."
        f"<br><span style=\"color:#64748b\">{escape(usage)}.</span></li>"
        for station, phone, problem, usage in rows
    )
    html = (
        "<p>The following station SIM bundles need attention:</p>"
        f"<ul>{items}</ul>"
        "<p>Top up the bundle with MTN, then record it on the "
        f"<a href=\"{escape(sim_url)}\">SIM management page</a>.</p>"
    )

    message = EmailMultiAlternatives(
        subject=subject, body=text, from_email=settings.DEFAULT_FROM_EMAIL, to=[], bcc=recipients,
    )
    message.attach_alternative(html, "text/html")
    return message


def mark_sent(alerts):
    for alert in alerts:
        SimAlertNotification.objects.get_or_create(
            sim=alert["sim"], kind=alert["kind"],
            threshold_days=alert["threshold"], bundle_key=alert["bundle_key"],
        )
