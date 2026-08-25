from django.db import models

class Station(models.Model):
    """
    Represents a physical AWS station.
    One station sends many SensorReadings.
    """
    name       = models.CharField(max_length=100)
    station_id = models.CharField(max_length=50, unique=True)
    location   = models.CharField(max_length=100, blank=True)
    latitude   = models.FloatField(null=True, blank=True)
    longitude  = models.FloatField(null=True, blank=True)

    # How often we expect data from this station (minutes)
    # Used by StationStatus to decide if station is DOWN
    expected_interval_minutes = models.IntegerField(default=15)

    phone_number = models.CharField(max_length=20, blank=True)
    sensors      = models.JSONField(default=list, blank=True)
    notes        = models.TextField(blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.phone_number:
            # Use get_or_create or update_or_create
            # We import SimCard locally if it's defined after
            SimCard.objects.update_or_create(
                station=self,
                defaults={'phone_number': self.phone_number}
            )
        else:
            SimCard.objects.filter(station=self).delete()

    def __str__(self):
        return f"{self.name} ({self.station_id})"


class SimCard(models.Model):
    """
    Dedicated model for managing the SIM card of a station.
    Auto-created when a Station is saved with a phone_number.
    """
    station = models.OneToOneField(Station, on_delete=models.CASCADE, related_name='sim_card')
    phone_number = models.CharField(max_length=20)
    iccid = models.CharField(max_length=50, blank=True)
    data_limit_mb = models.FloatField(default=1024.0)  # 1GB default limit
    data_used_mb = models.FloatField(default=0.0)
    date_loaded = models.DateField(null=True, blank=True)
    expiry_date = models.DateField(null=True, blank=True)
    
    def __str__(self):
        return f"SIM {self.phone_number} for {self.station.station_id}"


class StationStatus(models.Model):
    """
    Tracks whether a station is transmitting correctly.
    Updated automatically by the listening agent / ML layer.
    """
    class Status(models.TextChoices):
        FULL    = "full",    "Perfectly Transmitting"
        PARTIAL = "partial", "Partially Transmitting"
        DOWN    = "down",    "Down"

    station     = models.OneToOneField(
                    Station,
                    related_name="status",
                    on_delete=models.CASCADE
                  )
    status      = models.CharField(
                    max_length=10,
                    choices=Status.choices,
                    default=Status.DOWN
                  )
    last_updated = models.DateTimeField(auto_now=True)
    details      = models.JSONField(default=dict, blank=True)
    computed_by  = models.CharField(max_length=50, default="rule_based")

    def __str__(self):
        return f"{self.station.station_id} — {self.status}"


class SensorReading(models.Model):
    """
    Stores one reading from the ESP32 AWS station received via GSM.

    Raw ESP32 string example:
    Time:Wednesday, 2026-06-17 15:53:47,Press:nan,Alt:nan,Temp:nan,
    Hum:nan,Light:0.00,SoilM:3.30,Rain:0,WSpd:0.00,WDir:2,
    V33:3.36,V5:4.82,VBatt:11.32,VSol:1.02,VDC:1.02,CBatt:0.43,CSol:0.62

    ESP32 key   →   DB column          →   Meaning
    ---------       ---------              -------
    Time        →   timestamp          →   when reading was taken (from RTC)
    Press       →   pressure           →   air pressure (hPa)
    Temp        →   temperature        →   air temperature (°C)
    Hum         →   humidity           →   relative humidity (%)
    SolRadV     →   solar_radiation_v  →   solar radiation sensor voltage (V)
    SolRad      →   solar_radiation    →   solar radiation (W/m²)
    SoilM       →   soil_moisture_v    →   soil moisture sensor voltage (V)
    SoilPct     →   soil_moisture      →   soil moisture (%)
    Rain        →   rain               →   rain gauge tip count
    WSpd        →   wind_speed         →   wind speed (km/h)
    WDirV       →   wind_direction_v   →   wind direction sensor voltage (V)
    WDir        →   wind_direction     →   wind direction (degrees 0-360)
    
    VBatt       →   volt_batt          →   battery voltage (V)
    VSol        →   volt_solar         →   solar panel voltage (V)
    
    CBatt       →   curr_batt          →   battery current (A)
    CSol        →   curr_solar         →   solar current (A)
    """

    # ── Identity ──────────────────────────────────────────
    # ForeignKey to Station so we can filter readings per station
    # station_id CharField kept as fallback if station not yet registered
    station = models.ForeignKey(
        Station,
        related_name="readings",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Link to registered Station."
    )
    station_code = models.CharField(
        max_length=50,
        default='AWS-UG-001',
        help_text="Raw station ID string from ESP32 e.g. AWS-UG-001"
    )

    # ── Time ──────────────────────────────────────────────
    # ESP32 key: Time  →  "Wednesday, 2026-06-17 15:53:47"
    # Day name is stripped during parsing, stored as: 2026-06-17 15:53:47
    timestamp   = models.DateTimeField(
        help_text="Timestamp from the ESP32 RTC. ESP32 key: Time"
    )
    received_at = models.DateTimeField(
        auto_now_add=True,
        help_text="When this server received the reading"
    )

    # ── Atmospheric & Environmental ───────────────────────
    # ESP32 key: Press  →  e.g. 1013.25 or nan→NULL
    pressure = models.FloatField(
        null=True, blank=True,
        help_text="Air pressure in hPa. ESP32 key: Press"
    )
    # ESP32 key: Temp  →  e.g. 24.50 or nan→NULL
    temperature = models.FloatField(
        null=True, blank=True,
        help_text="Air temperature in Celsius. ESP32 key: Temp"
    )
    # ESP32 key: Hum  →  e.g. 78.20 or nan→NULL
    humidity = models.FloatField(
        null=True, blank=True,
        help_text="Relative humidity in percent. ESP32 key: Hum"
    )
    # Solar Radiation (Raw Voltage & Converted W/m²)
    solar_radiation_v = models.FloatField(
        null=True, blank=True,
        help_text="Solar radiation sensor voltage in Volts."
    )
    solar_radiation = models.FloatField(
        null=True, blank=True,
        help_text="Solar radiation in W/m². ESP32 key: Light / SolRad"
    )
    # Soil Moisture (Raw Voltage & Converted %)
    soil_moisture_v = models.FloatField(
        null=True, blank=True,
        help_text="Soil moisture sensor voltage in Volts. ESP32 key: SoilM"
    )
    soil_moisture = models.FloatField(
        null=True, blank=True,
        help_text="Soil moisture in percent (%)."
    )
    # ESP32 key: Rain  →  e.g. 0
    rain = models.FloatField(
        null=True, blank=True,
        help_text="Rain gauge tip count. ESP32 key: Rain"
    )

    # ── Wind ──────────────────────────────────────────────
    # ESP32 key: WSpd  →  e.g. 0.00
    wind_speed = models.FloatField(
        null=True, blank=True,
        help_text="Wind speed in km/h. ESP32 key: WSpd"
    )
    # Wind Direction (Raw Voltage & Converted Degrees)
    wind_direction_v = models.FloatField(
        null=True, blank=True,
        help_text="Wind direction sensor voltage in Volts."
    )
    wind_direction = models.IntegerField(
        null=True, blank=True,
        help_text="Wind direction in degrees (0-360). ESP32 key: WDir"
    )

    # ── Power rails ───────────────────────────────────────
    # ESP32 key: VBatt  →  e.g. 11.32
    volt_batt = models.FloatField(
        null=True, blank=True,
        help_text="Battery voltage. ESP32 key: VBatt"
    )
    # ESP32 key: VSol  →  e.g. 1.02
    volt_solar = models.FloatField(
        null=True, blank=True,
        help_text="Solar panel voltage. ESP32 key: VSol"
    )
    battery_temp = models.FloatField(
        null=True, blank=True,
        help_text="Battery temperature in Celsius."
    )

    # ── Currents ──────────────────────────────────────────
    # ESP32 key: CBatt  →  e.g. 0.43
    curr_batt = models.FloatField(
        null=True, blank=True,
        help_text="Battery current in Amps. ESP32 key: CBatt"
    )
    # ESP32 key: CSol  →  e.g. 0.62
    curr_solar = models.FloatField(
        null=True, blank=True,
        help_text="Solar current in Amps. ESP32 key: CSol"
    )

    class Meta:
        ordering = ['-timestamp']
        indexes  = [
            models.Index(fields=['timestamp'],           name='idx_timestamp'),
            models.Index(fields=['station_code'],         name='idx_station_code'),
            models.Index(fields=['station_code', 'timestamp'],     name= 'idx_code_time'),
          
        ]

    def __str__(self):
        return f"{self.station_code} @ {self.timestamp}"


class WeatherReading(models.Model):
    """
    Stores atmospheric/environmental data from one ESP32 reading.
    Mirrors ThingSpeak Channel 1 (fields 1-8):
    field1:Temp, field2:Hum, field3:Press, field4:Rain,
    field5:WSpd, field6:WDir, field7:SolRad, field8:SoilM
    """
    station = models.ForeignKey(
        Station,
        related_name="weather_readings",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    station_code = models.CharField(
        max_length=50,
        default='AWS-UG-001',
        help_text="Raw station ID string from ESP32 e.g. AWS-UG-001"
    )

    timestamp   = models.DateTimeField(
        help_text="Timestamp from the ESP32 RTC. ESP32 key: Time"
    )
    received_at = models.DateTimeField(auto_now_add=True)

    pressure          = models.FloatField(null=True, blank=True, help_text="ESP32 key: Press")
    temperature       = models.FloatField(null=True, blank=True, help_text="ESP32 key: Temp")
    humidity          = models.FloatField(null=True, blank=True, help_text="ESP32 key: Hum")
    solar_radiation_v = models.FloatField(null=True, blank=True, help_text="Solar radiation sensor voltage (V)")
    solar_radiation   = models.FloatField(null=True, blank=True, help_text="Solar radiation (W/m²)")
    soil_moisture_v   = models.FloatField(null=True, blank=True, help_text="Soil moisture sensor voltage (V). ESP32 key: SoilM")
    soil_moisture     = models.FloatField(null=True, blank=True, help_text="Soil moisture (%)")
    rain              = models.FloatField(null=True, blank=True, help_text="ESP32 key: Rain")
    wind_speed        = models.FloatField(null=True, blank=True, help_text="ESP32 key: WSpd")
    wind_direction_v  = models.FloatField(null=True, blank=True, help_text="Wind direction sensor voltage (V)")
    wind_direction    = models.IntegerField(null=True, blank=True, help_text="ESP32 key: WDir")

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['timestamp'], name='idx_weather_timestamp'),
            models.Index(fields=['station_code', 'timestamp'], name='idx_weather_code_time'),
        ]

    def __str__(self):
        return f"Weather {self.station_code} @ {self.timestamp}"


class VoltageReading(models.Model):
    """
    Stores voltage rail data from one ESP32 reading.
    Mirrors ThingSpeak Channel 2 (fields 1-3):
    field1:VBatt, field2:VSol, field3:BatteryTemp
    """
    station = models.ForeignKey(
        Station,
        related_name="voltage_readings",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    station_code = models.CharField(max_length=50, default='AWS-UG-001')

    timestamp   = models.DateTimeField(help_text="ESP32 key: Time")
    received_at = models.DateTimeField(auto_now_add=True)

    volt_batt    = models.FloatField(null=True, blank=True, help_text="ESP32 key: VBatt")
    volt_solar   = models.FloatField(null=True, blank=True, help_text="ESP32 key: VSol")
    battery_temp = models.FloatField(null=True, blank=True, help_text="ESP32 key: Battery temperature (°C)")
    
    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['timestamp'], name='idx_voltage_timestamp'),
            models.Index(fields=['station_code', 'timestamp'], name='idx_voltage_code_time'),
        ]

    def __str__(self):
        return f"Voltage {self.station_code} @ {self.timestamp}"


class CurrentReading(models.Model):
    """
    Stores current data from one ESP32 reading.
    Mirrors ThingSpeak Channel 3 (fields 1-2):
    field1:CBatt, field2:CSol
    """
    station = models.ForeignKey(
        Station,
        related_name="current_readings",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    station_code = models.CharField(max_length=50, default='AWS-UG-001')

    timestamp   = models.DateTimeField(help_text="ESP32 key: Time")
    received_at = models.DateTimeField(auto_now_add=True)

    curr_batt  = models.FloatField(null=True, blank=True, help_text="ESP32 key: CBatt")
    curr_solar = models.FloatField(null=True, blank=True, help_text="ESP32 key: CSol")

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['timestamp'], name='idx_current_timestamp'),
            models.Index(fields=['station_code', 'timestamp'], name='idx_current_code_time'),
        ]

    def __str__(self):
        return f"Current {self.station_code} @ {self.timestamp}"


class BenchmarkReading(models.Model):
    """
    Reference-data reading imported from an external meteorological
    authority (e.g. UNMA) — used to benchmark AWS station accuracy.
    """
    source    = models.CharField(max_length=100, default='UNMA')
    location  = models.CharField(max_length=100, blank=True)
    timestamp = models.DateTimeField(db_index=True)

    temperature     = models.FloatField(null=True, blank=True)
    humidity        = models.FloatField(null=True, blank=True)
    pressure        = models.FloatField(null=True, blank=True)
    solar_radiation = models.FloatField(null=True, blank=True, help_text="Solar radiation in W/m²")
    soil_moisture   = models.FloatField(null=True, blank=True)
    rain            = models.FloatField(null=True, blank=True)
    wind_speed      = models.FloatField(null=True, blank=True)
    wind_direction  = models.FloatField(null=True, blank=True)

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['source', 'timestamp'], name='idx_benchmark_source_time'),
        ]

    def __str__(self):
        return f"{self.source} @ {self.timestamp}"
