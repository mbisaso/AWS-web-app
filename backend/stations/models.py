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

    def __str__(self):
        return f"{self.name} ({self.station_id})"


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
    Alt         →   altitude           →   altitude (m)
    Temp        →   temperature        →   air temperature (°C)
    Hum         →   humidity           →   relative humidity (%)
    Light       →   light              →   light level (lux)
    SoilM       →   soil_moisture      →   soil moisture voltage (V)
    Rain        →   rain               →   rain gauge tip count
    WSpd        →   wind_speed         →   wind speed (km/h)
    WDir        →   wind_direction     →   wind direction (degrees 0-360)
    V33         →   volt_3v3           →   3.3V rail voltage
    V5          →   volt_5v            →   5V rail voltage
    VBatt       →   volt_batt          →   battery voltage
    VSol        →   volt_solar         →   solar panel voltage
    VDC         →   volt_dc            →   DC input voltage
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

    # ── Atmospheric ───────────────────────────────────────
    # ESP32 key: Press  →  e.g. 1013.25 or nan→NULL
    pressure = models.FloatField(
        null=True, blank=True,
        help_text="Air pressure in hPa. ESP32 key: Press"
    )
    # ESP32 key: Alt  →  e.g. 45.20 or nan→NULL
    altitude = models.FloatField(
        null=True, blank=True,
        help_text="Altitude in meters. ESP32 key: Alt"
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

    # ── Environment ───────────────────────────────────────
    # ESP32 key: Light  →  e.g. 0.00
    light = models.FloatField(
        null=True, blank=True,
        help_text="Light level in lux. ESP32 key: Light"
    )
    # ESP32 key: SoilM  →  e.g. 3.30
    soil_moisture = models.FloatField(
        null=True, blank=True,
        help_text="Soil moisture voltage. ESP32 key: SoilM"
    )
    # ESP32 key: Rain  →  e.g. 0
    rain = models.IntegerField(
        null=True, blank=True,
        help_text="Rain gauge tip count. ESP32 key: Rain"
    )

    # ── Wind ──────────────────────────────────────────────
    # ESP32 key: WSpd  →  e.g. 0.00
    wind_speed = models.FloatField(
        null=True, blank=True,
        help_text="Wind speed in km/h. ESP32 key: WSpd"
    )
    # ESP32 key: WDir  →  e.g. 2
    wind_direction = models.IntegerField(
        null=True, blank=True,
        help_text="Wind direction in degrees. ESP32 key: WDir"
    )

    # ── Power rails ───────────────────────────────────────
    # ESP32 key: V33  →  e.g. 3.36
    volt_3v3 = models.FloatField(
        null=True, blank=True,
        help_text="3.3V rail voltage. ESP32 key: V33"
    )
    # ESP32 key: V5  →  e.g. 4.82
    volt_5v = models.FloatField(
        null=True, blank=True,
        help_text="5V rail voltage. ESP32 key: V5"
    )
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
    # ESP32 key: VDC  →  e.g. 1.02
    volt_dc = models.FloatField(
        null=True, blank=True,
        help_text="DC input voltage. ESP32 key: VDC"
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