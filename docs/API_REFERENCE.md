# AWS Monitor — Backend API Reference

**Base URL (local):** `http://localhost:8000`

**Base URL (production):** `https://aws-dashboard.onrender.com`

**All timestamps** are ISO 8601, stored and returned in UTC. The server's `TIME_ZONE` is `Africa/Kampala` (UTC+3) for display purposes only — API timestamps are always UTC.

**Standard response envelope** (used by all custom endpoints except `/api/token/refresh/`):

```json
{ "success": true,  "message": null, "data": { ... } }
{ "success": false, "error": "description of what went wrong" }
```

---

## Category 1 — Data Ingestion (ESP32 → Django)

### `POST /api/ingest/`

Receives sensor readings from an ESP32 microcontroller. No authentication required — the ESP32 posts over GSM with no login capability.

**Auth:** None

---

#### Format 1 — Raw ESP32 string (preferred)

The ESP32 sends its native comma-separated output wrapped in a JSON envelope.

**Request body:**

```json
{
  "station_id": "AWS-UG-001",
  "raw": "Time:Tuesday, 2026-06-24 12:47:00,Press:1013.2,Alt:1137.0,Temp:24.5,Hum:78.2,Light:45230.00,SoilM:2.85,Rain:0,WSpd:3.60,WDir:180,V33:3.32,V5:4.96,VBatt:12.40,VSol:18.20,VDC:5.10,CBatt:0.43,CSol:1.24"
}
```

| Field        | Type   | Required          | Notes                                                                  |
| ------------ | ------ | ----------------- | ---------------------------------------------------------------------- |
| `station_id` | string | No                | Defaults to `"AWS-UG-001"` if omitted                                  |
| `raw`        | string | Yes (this format) | Full ESP32 string including the `Time:Day, YYYY-MM-DD HH:MM:SS` prefix |

**Key parsing detail:** The timestamp field contains a weekday followed by a comma (e.g. `Time:Tuesday, 2026-06-24`). The backend strips the weekday before splitting on commas. Any sensor value of `nan` is stored as `null`.

---

#### Format 2 — Pre-parsed JSON

Use this if the ESP32 or a proxy already parsed the string into fields.

**Request body:**

```json
{
  "station_id": "AWS-UG-001",
  "timestamp": "2026-06-24T12:47:00",
  "pressure": 1013.2,
  "altitude": 1137.0,
  "temperature": 24.5,
  "humidity": 78.2,
  "light": 45230.0,
  "soil_moisture": 2.85,
  "rain": 0,
  "wind_speed": 3.6,
  "wind_direction": 180,
  "volt_3v3": 3.32,
  "volt_5v": 4.96,
  "volt_batt": 12.4,
  "volt_solar": 18.2,
  "volt_dc": 5.1,
  "curr_batt": 0.43,
  "curr_solar": 1.24
}
```

All fields except `station_id` and `timestamp` are optional — missing or `null` fields are stored as `null`.

| Field                                                           | Type            | Unit                                                |
| --------------------------------------------------------------- | --------------- | --------------------------------------------------- |
| `timestamp`                                                     | ISO 8601 string | Required — server rejects if missing or unparseable |
| `temperature`                                                   | float           | °C                                                  |
| `humidity`                                                      | float           | %                                                   |
| `pressure`                                                      | float           | hPa                                                 |
| `altitude`                                                      | float           | metres                                              |
| `light`                                                         | float           | lux                                                 |
| `soil_moisture`                                                 | float           | voltage (raw ADC)                                   |
| `rain`                                                          | integer         | tip count                                           |
| `wind_speed`                                                    | float           | km/h                                                |
| `wind_direction`                                                | integer         | degrees (0–359)                                     |
| `volt_3v3` / `volt_5v` / `volt_batt` / `volt_solar` / `volt_dc` | float           | volts                                               |
| `curr_batt` / `curr_solar`                                      | float           | amps                                                |

---

**Success response** — HTTP 201:

```json
{
  "success": true,
  "message": null,
  "data": {
    "status": "ok",
    "id": 1042
  }
}
```

**Error responses:**

| HTTP | Condition                             | Body                                                                                     |
| ---- | ------------------------------------- | ---------------------------------------------------------------------------------------- |
| 400  | `raw` string timestamp unparseable    | `{"error": "Could not parse timestamp from raw string"}`                                 |
| 400  | Format 2 with missing/bad `timestamp` | `{"success": false, "error": {"error": "timestamp is required and must be ISO format"}}` |

**Side effect:** If `station_id` matches a registered `Station`, the backend calls the ML inference service and updates `StationStatus` — either `ml_model` (if FastAPI is running) or `rule_based` fallback. This happens asynchronously within the request but never causes the ingest to fail.

---

## Category 2 — Data Retrieval (Django → Frontend)

All endpoints in this category require a JWT Bearer token in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

---

### `GET /api/stations/`

Returns all registered stations with their current health status.

**Auth:** JWT Bearer  
**Query params:** None

**Success response** — HTTP 200:

```json
{
  "success": true,
  "message": null,
  "data": [
    {
      "id": 1,
      "station_id": "AWS-UG-001",
      "name": "Entebbe Airport",
      "location": "Entebbe International Airport, Wakiso District",
      "latitude": 0.0463,
      "longitude": 32.4433,
      "expected_interval_minutes": 15,
      "status": {
        "status": "full",
        "last_updated": "2026-06-24T12:47:03.821Z",
        "computed_by": "ml_model",
        "details": {
          "last_reading_id": 1042,
          "prediction": "healthy",
          "at_risk_proba": 0.1462,
          "threshold_used": 0.396
        }
      }
    },
    {
      "id": 2,
      "station_id": "AWS-UG-002",
      "name": "Kampala Makerere",
      "location": "Makerere University Hill, Kampala",
      "latitude": 0.3347,
      "longitude": 32.5682,
      "expected_interval_minutes": 15,
      "status": {
        "status": "partial",
        "last_updated": "2026-06-24T11:30:12.004Z",
        "computed_by": "rule_based",
        "details": {
          "last_reading_id": 1039
        }
      }
    }
  ]
}
```

**`status.status` values:** `"full"` (operating normally), `"partial"` (degraded — ML predicted `at_risk`), `"down"` (no status record yet)

**`status.computed_by` values:** `"ml_model"` (FastAPI was reachable), `"rule_based"` (FastAPI unavailable — station assumed full)

**`status.details`** is a free-form JSON object. When `computed_by` is `"ml_model"` it always contains `prediction`, `at_risk_proba`, and `threshold_used`. When `"rule_based"` it contains only `last_reading_id`.

---

### `GET /api/stations/<station_id>/`

Returns full detail for one station plus its most recent reading.

**Auth:** JWT Bearer  
**URL param:** `station_id` — e.g. `AWS-UG-001`  
**Query params:** None

**Success response** — HTTP 200:

```json
{
  "success": true,
  "message": null,
  "data": {
    "station": {
      "id": 1,
      "station_id": "AWS-UG-001",
      "name": "Entebbe Airport",
      "location": "Entebbe International Airport, Wakiso District",
      "latitude": 0.0463,
      "longitude": 32.4433,
      "expected_interval_minutes": 15,
      "status": {
        "status": "full",
        "last_updated": "2026-06-24T12:47:03.821Z",
        "computed_by": "ml_model",
        "details": {
          "last_reading_id": 1042,
          "prediction": "healthy",
          "at_risk_proba": 0.1462,
          "threshold_used": 0.396
        }
      }
    },
    "latest_reading": {
      "station_code": "AWS-UG-001",
      "timestamp": "2026-06-24T12:47:00Z",
      "received_at": "2026-06-24T12:47:03.512Z",
      "temperature": 24.5,
      "humidity": 78.2,
      "pressure": 1013.2,
      "wind_speed": 3.6,
      "wind_direction": 180,
      "rain": 0,
      "light": 45230.0,
      "soil_moisture": 2.85,
      "volt_batt": 12.4,
      "volt_solar": 18.2,
      "curr_batt": 0.43,
      "curr_solar": 1.24
    }
  }
}
```

`latest_reading` is `null` if the station has never posted a reading.

**Error response** — HTTP 404:

```json
{
  "success": false,
  "error": "Station AWS-UG-999 not found"
}
```

---

### `GET /api/latest/`

Returns the single most recent reading from every station that has ever posted data. Use this to populate a live overview or map.

**Auth:** JWT Bearer  
**Query params:** None

**Success response** — HTTP 200:

```json
{
  "success": true,
  "message": null,
  "data": [
    {
      "station_code": "AWS-UG-001",
      "timestamp": "2026-06-24T12:47:00Z",
      "received_at": "2026-06-24T12:47:03.512Z",
      "temperature": 24.5,
      "humidity": 78.2,
      "pressure": 1013.2,
      "wind_speed": 3.6,
      "wind_direction": 180,
      "rain": 0,
      "light": 45230.0,
      "soil_moisture": 2.85,
      "volt_batt": 12.4,
      "volt_solar": 18.2,
      "curr_batt": 0.43,
      "curr_solar": 1.24
    },
    {
      "station_code": "AWS-UG-002",
      "timestamp": "2026-06-24T11:30:00Z",
      "received_at": "2026-06-24T11:30:05.204Z",
      "temperature": 22.8,
      "humidity": 83.5,
      "pressure": 1011.7,
      "wind_speed": 1.2,
      "wind_direction": 90,
      "rain": 2,
      "light": 12400.0,
      "soil_moisture": 3.1,
      "volt_batt": 11.8,
      "volt_solar": 14.6,
      "curr_batt": 0.31,
      "curr_solar": 0.87
    }
  ]
}
```

**Note:** This scans all `station_code` values in `SensorReading` — it includes readings from unregistered stations (ones not in the `Station` table). If a station has never posted, it won't appear here.

---

### `GET /api/stations/<station_id>/history/`

Returns time-series readings for one station for use in charts

**Auth:** JWT Bearer  
**URL param:** `station_id` — e.g. `AWS-UG-001`

**Query parameters:**

| Param     | Default  | Description                                                        |
| --------- | -------- | ------------------------------------------------------------------ |
| `?hours=` | `24`     | How many hours back to fetch                                       |
| `?limit=` | `200`    | Max number of readings returned                                    |
| `?type=`  | `sensor` | `sensor` returns weather fields; `power` returns power rail fields |

**Success response with `?type=sensor`** — HTTP 200:

```json
{
  "success": true,
  "message": null,
  "data": {
    "station_id": "AWS-UG-001",
    "hours": 24,
    "count": 3,
    "readings": [
      {
        "timestamp": "2026-06-24T10:17:00Z",
        "temperature": 21.8,
        "humidity": 80.1,
        "pressure": 1012.6,
        "wind_speed": 2.1,
        "wind_direction": 135,
        "rain": 0,
        "light": 5200.0,
        "soil_moisture": 2.91
      },
      {
        "timestamp": "2026-06-24T11:32:00Z",
        "temperature": 23.2,
        "humidity": 79.0,
        "pressure": 1012.9,
        "wind_speed": 2.8,
        "wind_direction": 160,
        "rain": 0,
        "light": 38100.0,
        "soil_moisture": 2.88
      },
      {
        "timestamp": "2026-06-24T12:47:00Z",
        "temperature": 24.5,
        "humidity": 78.2,
        "pressure": 1013.2,
        "wind_speed": 3.6,
        "wind_direction": 180,
        "rain": 0,
        "light": 45230.0,
        "soil_moisture": 2.85
      }
    ]
  }
}
```

**Success response with `?type=power`** — HTTP 200:

```json
{
  "success": true,
  "message": null,
  "data": {
    "station_id": "AWS-UG-001",
    "hours": 24,
    "count": 3,
    "readings": [
      {
        "timestamp": "2026-06-24T10:17:00Z",
        "volt_3v3": 3.31,
        "volt_5v": 4.94,
        "volt_batt": 11.9,
        "volt_solar": 12.4,
        "volt_dc": 5.08,
        "curr_batt": 0.38,
        "curr_solar": 0.52
      },
      {
        "timestamp": "2026-06-24T12:47:00Z",
        "volt_3v3": 3.32,
        "volt_5v": 4.96,
        "volt_batt": 12.4,
        "volt_solar": 18.2,
        "volt_dc": 5.1,
        "curr_batt": 0.43,
        "curr_solar": 1.24
      }
    ]
  }
}
```

**Note:** `null` values in readings mean that sensor was broken or absent when the ESP32 posted. The frontend must handle `null` for every field.

---

### `GET /api/export/`

Exports historical readings as JSON or a downloadable CSV file. Intended for ML training data collection.

**Auth:** JWT Bearer

**Query parameters:**

| Param          | Default  | Description                                                                                        |
| -------------- | -------- | -------------------------------------------------------------------------------------------------- |
| `?station_id=` | _(none)_ | Filter to one station. Omit to export all stations                                                 |
| `?hours=`      | `168`    | How many hours back (default is 7 days)                                                            |
| `?output=`     | `json`   | `json` returns the standard envelope; `csv` triggers a file download                               |
| `?fields=`     | `all`    | `all` — all 21 fields; `sensor` — timestamp + weather only; `power` — timestamp + power rails only |

**Success response with `?output=json&fields=all`** — HTTP 200:

```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "id": 1041,
      "station_code": "AWS-UG-001",
      "timestamp": "2026-06-24T11:32:00Z",
      "received_at": "2026-06-24T11:32:04.102Z",
      "pressure": 1012.9,
      "altitude": 1137.0,
      "temperature": 23.2,
      "humidity": 79.0,
      "light": 38100.0,
      "soil_moisture": 2.88,
      "rain": 0,
      "wind_speed": 2.8,
      "wind_direction": 160,
      "volt_3v3": 3.31,
      "volt_5v": 4.94,
      "volt_batt": 11.9,
      "volt_solar": 16.8,
      "volt_dc": 5.09,
      "curr_batt": 0.4,
      "curr_solar": 1.1
    }
  ]
}
```

**Success response with `?output=csv`:**

HTTP 200 with headers:

```
Content-Type: text/csv
Content-Disposition: attachment; filename="aws_export.csv"
```

Body is a plain CSV file — column names match the JSON field names exactly.

**Note:** The `?output=` parameter is intentional — do **not** use `?format=` which is reserved by Django REST Framework and will cause a 404.

---

## Category 3 — Authentication (Frontend → Django)

### `POST /api/register/`

Creates a new user account.

**Auth:** None

**Request body:**

```json
{
  "username": "henry",
  "password": "securepassword123",
  "role": "meteorologist"
}
```

| Field      | Type   | Required | Notes                                                                      |
| ---------- | ------ | -------- | -------------------------------------------------------------------------- |
| `username` | string | Yes      | Must be unique                                                             |
| `password` | string | Yes      | Minimum 8 characters                                                       |
| `role`     | string | No       | One of: `admin`, `meteorologist`, `viewer`, `farmer`. Defaults to `viewer` |

**Success response** — HTTP 201:

```json
{
  "success": true,
  "message": "Account created",
  "data": {
    "username": "henry",
    "role": "meteorologist"
  }
}
```

**Error response** — HTTP 400 (e.g. duplicate username or password too short):

```json
{
  "success": false,
  "error": {
    "username": ["A user with that username already exists."],
    "password": ["Ensure this field has at least 8 characters."]
  }
}
```

**Note:** `error` is an object (field → list of messages) on validation failures, not a plain string.

---

### `POST /api/login/`

Authenticates a user and returns JWT tokens plus the user's role. This is the primary login endpoint — prefer this over `/api/token/`.

**Auth:** None

**Request body:**

```json
{
  "username": "henry",
  "password": "securepassword123"
}
```

**Success response** — HTTP 200:

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "username": "henry",
    "role": "meteorologist"
  }
}
```

**What to do with the tokens:**

- Store `access` and `refresh` in memory or `localStorage`
- Attach `access` to every subsequent API call: `Authorization: Bearer <access>`
- The access token expires in **60 minutes**
- When a request returns HTTP 401, call `/api/token/refresh/` with the `refresh` token to get a new access token
- The refresh token expires in **7 days** — after that the user must log in again

**Error response** — HTTP 401:

```json
{
  "success": false,
  "error": "Invalid username or password"
}
```

---

### `POST /api/token/refresh/`

Issues a new access token from a valid refresh token. Call this when the access token expires (HTTP 401 on a protected endpoint).

**Auth:** None

**Request body:**

```json
{
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Success response** — HTTP 200:

> **Note:** This endpoint is served by `djangorestframework-simplejwt` directly and does **not** use the standard `{ success, data }` envelope.

```json
{
  "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

Replace the stored access token with this new value. The refresh token itself rotates — a new `refresh` value is also returned if `ROTATE_REFRESH_TOKENS` is `True` (it is):

```json
{
  "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error response** — HTTP 401 (token expired or invalid):

```json
{
  "detail": "Token is invalid or expired",
  "code": "token_not_valid"
}
```

When this happens, the user's session is fully expired. Redirect to `/login`.

---

## Quick Reference

| Method | URL                           | Auth   | Purpose                          |
| ------ | ----------------------------- | ------ | -------------------------------- |
| POST   | `/api/ingest/`                | None   | ESP32 posts sensor data          |
| POST   | `/api/register/`              | None   | Create user account              |
| POST   | `/api/login/`                 | None   | Login, get tokens + role         |
| POST   | `/api/token/refresh/`         | None   | Renew expired access token       |
| GET    | `/api/stations/`              | Bearer | All stations + health status     |
| GET    | `/api/stations/<id>/`         | Bearer | One station + latest reading     |
| GET    | `/api/latest/`                | Bearer | Latest reading per station (all) |
| GET    | `/api/stations/<id>/history/` | Bearer | Time-series chart data           |
| GET    | `/api/export/`                | Bearer | Bulk data export (JSON or CSV)   |
