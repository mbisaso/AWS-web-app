from django.contrib.auth.decorators import login_required
from django.shortcuts import render
from .models import Station
from django.views.generic import TemplateView
from django.contrib.auth.mixins import LoginRequiredMixin


class LandingView(TemplateView):
    """Public landing page — no login required."""
    template_name = "stations/landing.html"


class DashboardView(LoginRequiredMixin, TemplateView):
    """Protected dashboard — redirects to login if not authenticated."""
    template_name = "stations/dashboard.html"
    login_url = '/login/'


@login_required
def dashboard(request):
    stations = Station.objects.select_related("status").all()

    summary = {"full": 0, "partial": 0, "down": 0}
    for s in stations:
        status = getattr(s, "status", None)
        key = status.status if status else "down"
        summary[key] = summary.get(key, 0) + 1

    return render(request, "stations/dashboard.html", {
        "stations": stations,
        "summary": summary,
    })