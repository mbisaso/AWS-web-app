import csv
import io

from django import forms
from django.contrib import admin, messages
from django.shortcuts import render, redirect
from django.urls import path, reverse
from django.utils.dateparse import parse_datetime

from .models import Station, StationStatus, SensorReading, BenchmarkReading


@admin.register(Station)
class StationAdmin(admin.ModelAdmin):
    list_display  = ['station_id', 'name', 'location', 'expected_interval_minutes']
    search_fields = ['station_id', 'name']


@admin.register(StationStatus)
class StationStatusAdmin(admin.ModelAdmin):
    list_display = ['station', 'status', 'last_updated', 'computed_by']
    list_filter  = ['status']


@admin.register(SensorReading)
class SensorReadingAdmin(admin.ModelAdmin):
    list_display  = ['station_id', 'timestamp', 'temperature',
                     'humidity', 'wind_speed', 'volt_batt', 'received_at']
    list_filter   = ['station_id']
    search_fields = ['station_id']
    ordering      = ['-timestamp']


# ─────────────────────────────────────────────────────────
# BenchmarkReading — CSV import
# ─────────────────────────────────────────────────────────

# CSV columns (besides the first "time" column) that map directly
# onto BenchmarkReading fields. Anything else in the CSV is ignored;
# any of these missing from the CSV are simply left as None.
BENCHMARK_CSV_FIELDS = [
    'temperature', 'humidity', 'pressure', 'wind_speed',
    'wind_direction', 'rain', 'light', 'soil_moisture',
]


class BenchmarkImportForm(forms.Form):
    """
    Prompts for the metadata that applies to every row in the CSV,
    plus the file itself. Kept as a plain Form (not a ModelForm)
    since it doesn't map 1:1 onto BenchmarkReading.
    """
    source = forms.CharField(max_length=100, initial='UNMA')
    location = forms.CharField(max_length=100, required=False)
    csv_file = forms.FileField(label='CSV file')

    def clean_csv_file(self):
        f = self.cleaned_data['csv_file']
        if not f.name.lower().endswith('.csv'):
            raise forms.ValidationError('File must be a .csv file')
        return f


@admin.register(BenchmarkReading)
class BenchmarkReadingAdmin(admin.ModelAdmin):
    list_display  = ['source', 'location', 'timestamp', 'temperature',
                      'humidity', 'pressure', 'wind_speed']
    list_filter   = ['source', 'location']
    search_fields = ['source', 'location']
    ordering      = ['-timestamp']
    change_list_template = 'admin/stations/benchmarkreading/change_list.html'

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path(
                'import-csv/',
                self.admin_site.admin_view(self.import_csv),
                name='stations_benchmarkreading_import_csv',
            ),
        ]
        return custom_urls + urls

    def import_csv(self, request):
        """
        Standalone admin view (not a list action) since list actions
        can't accept file uploads. Prompts for source/location first,
        then parses the uploaded CSV and bulk-creates BenchmarkReadings.
        """
        if request.method == 'POST':
            form = BenchmarkImportForm(request.POST, request.FILES)
            if form.is_valid():
                source = form.cleaned_data['source']
                location = form.cleaned_data['location']
                csv_file = form.cleaned_data['csv_file']

                decoded = io.TextIOWrapper(csv_file.file, encoding='utf-8-sig')
                reader = csv.reader(decoded)

                try:
                    header = next(reader)
                except StopIteration:
                    self.message_user(request, 'CSV file is empty.', level=messages.ERROR)
                    return redirect('..')

                # First column is the timestamp; remaining columns are
                # matched by name against BENCHMARK_CSV_FIELDS. Unknown
                # columns are ignored; known fields not present are skipped.
                field_columns = {}
                for idx, col_name in enumerate(header[1:], start=1):
                    col_name = col_name.strip().lower()
                    if col_name in BENCHMARK_CSV_FIELDS:
                        field_columns[col_name] = idx

                readings = []
                skipped = 0
                for row in reader:
                    if not row or not row[0].strip():
                        continue

                    timestamp = parse_datetime(row[0].strip())
                    if timestamp is None:
                        skipped += 1
                        continue

                    kwargs = {
                        'source': source,
                        'location': location,
                        'timestamp': timestamp,
                    }
                    for field_name, col_idx in field_columns.items():
                        if col_idx >= len(row):
                            continue
                        raw_value = row[col_idx].strip()
                        if not raw_value:
                            continue
                        try:
                            kwargs[field_name] = float(raw_value)
                        except ValueError:
                            pass

                    readings.append(BenchmarkReading(**kwargs))

                BenchmarkReading.objects.bulk_create(readings, batch_size=500)

                message = f'Imported {len(readings)} benchmark reading(s).'
                if skipped:
                    message += f' Skipped {skipped} row(s) with unparseable timestamps.'
                self.message_user(request, message, level=messages.SUCCESS)
                return redirect(reverse('admin:stations_benchmarkreading_changelist'))
        else:
            form = BenchmarkImportForm()

        context = {
            **self.admin_site.each_context(request),
            'form': form,
            'title': 'Import benchmark readings from CSV',
            'opts': self.model._meta,
        }
        return render(request, 'admin/stations/benchmarkreading/import_csv.html', context)
