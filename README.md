# AWS Monitor

A web platform for monitoring a network of Automatic Weather Stations (AWS) deployed across Uganda. Built at IoT-ra Lab, Makerere University as part of the AdEMNEA Project (formerly WIMEA-ICT).

Physical stations are built around ESP32 microcontrollers that measure weather and environmental conditions and transmit readings via GSM. This platform receives that data, stores it in PostgreSQL, tracks each station's health, and exposes a React dashboard for meteorologists, farmers, and administrators to view live and historical readings.

This replaces a previous ThingSpeak-based pipeline with a fully in-house Django + PostgreSQL + React stack.

---

## Tech Stack

**Backend**

- Python 3.11+ (3.14 confirmed working)
- Django 5.2.3
- Django REST Framework
- djangorestframework-simplejwt — JWT authentication
- psycopg2-binary — PostgreSQL driver
- PostgreSQL 13+

**Frontend**

- React 19 + TypeScript
- Vite 8
- TailwindCSS v4
- React Router v7

---

## Prerequisites

Make sure these are installed before starting:

- Python 3.11 or higher
- Node.js v18 or higher
- npm (comes with Node)
- PostgreSQL 13 or higher

---

## Project Structure

```
AWS-web-app/
├── requirements.txt                    Python dependencies
├── backend/                            Django project root
│   ├── manage.py
│   ├── aws_dashboard/                  Project settings package
│   │   ├── settings.py                 Database, auth, JWT config
│   │   ├── urls.py                     Root URL routing
│   │   ├── wsgi.py
│   │   └── asgi.py
│   ├── accounts/                       Custom user app
│   │   ├── models.py                   User model with role field
│   │   ├── views.py                    Registration view
│   │   ├── urls.py
│   │   └── migrations/
│   └── stations/                       Core data app
│       ├── models.py                   Station, StationStatus, SensorReading
│       ├── serializers.py              DRF serializers
│       ├── views.py                    API views
│       ├── urls.py                     API routes
│       ├── admin.py
│       └── migrations/
└── frontend/                           React + Vite app
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── App.tsx                     Router
        └── pages/
            ├── LandingPage.tsx
            ├── LoginPage.tsx
            ├── RegisterPage.tsx
            └── DashboardPage.tsx
```

---

## Setup

### 1. Create the PostgreSQL database

Open your PostgreSQL shell (`psql -U postgres`) and run:

```sql
CREATE USER aws_user WITH PASSWORD 'aws@2026';
CREATE DATABASE "aws-db" OWNER aws_user;
GRANT ALL PRIVILEGES ON DATABASE "aws-db" TO aws_user;
\q
```

### 2. Check the database port

Open `backend/aws_dashboard/settings.py` and verify the `PORT` under `DATABASES` matches your local PostgreSQL port. The default PostgreSQL port is `5432`.

### 3. Set up the Python virtual environment

From the project root:

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# Mac/Linux
source venv/bin/activate

pip install -r requirements.txt
```

### 4. Run database migrations

```bash
cd backend
python manage.py migrate
```

### 5. Create a superuser

```bash
python manage.py createsuperuser
```

### 6. Start the Django backend

```bash
python manage.py runserver
```

Backend runs at `http://localhost:8000`

### 7. Start the React frontend

Open a second terminal from the project root:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`

---

## Running URLs

| URL                             | Description        |
| ------------------------------- | ------------------ |
| http://localhost:5173           | React landing page |
| http://localhost:5173/login     | Login page         |
| http://localhost:5173/register  | Register page      |
| http://localhost:5173/dashboard | Dashboard          |
| http://localhost:8000/admin     | Django admin panel |

---

## API Endpoints

| Method | Endpoint                              | Auth       | Description                             |
| ------ | ------------------------------------- | ---------- | --------------------------------------- |
| POST   | `/api/ingest/`                        | None       | Receives sensor data from ESP32         |
| POST   | `/api/token/`                         | None       | Login — returns access + refresh tokens |
| POST   | `/api/token/refresh/`                 | None       | Renew access token                      |
| GET    | `/api/latest/`                        | JWT Bearer | Latest reading per station              |
| GET    | `/api/stations/`                      | JWT Bearer | All registered stations with status     |
| GET    | `/api/stations/<station_id>/`         | JWT Bearer | One station + its latest reading        |
| GET    | `/api/stations/<station_id>/history/` | JWT Bearer | Time-series chart data                  |

### Ingest endpoint formats

**Format 1 — raw ESP32 string:**

```json
{
  "station_id": "AWS-UG-001",
  "raw": "Time:Wednesday, 2026-06-17 15:53:47,Press:nan,Alt:nan,Temp:24.5,Hum:78.2,..."
}
```

**Format 2 — pre-parsed JSON:**

```json
{
  "station_id": "AWS-UG-001",
  "timestamp": "2026-06-17T15:53:47",
  "temperature": 24.5,
  "humidity": 78.2
}
```

### History endpoint query parameters

| Parameter      | Default | Description                       |
| -------------- | ------- | --------------------------------- |
| `?hours=24`    | 24      | How many hours back to fetch      |
| `?limit=200`   | 200     | Max number of readings            |
| `?type=sensor` | sensor  | Returns weather fields            |
| `?type=power`  | —       | Returns power rail fields instead |

### Response envelope

All API responses follow this structure:

```json
{ "success": true, "data": { } }
{ "success": false, "error": "description of what went wrong" }
```

---

## Data Models

### `accounts.User`

Extends Django's `AbstractUser` with a `role` field: `admin`, `meteorologist`, `viewer`, `farmer` (default: `viewer`)

### `stations.Station`

One row per physical ESP32 device in the field.

| Field                       | Type             | Description                                        |
| --------------------------- | ---------------- | -------------------------------------------------- |
| `station_id`                | string (unique)  | Device identifier e.g. AWS-UG-001                  |
| `name`                      | string           | Human-readable station name                        |
| `location`                  | string           | Text description of location                       |
| `latitude` / `longitude`    | float (nullable) | GPS coordinates                                    |
| `expected_interval_minutes` | int              | How often this station should report (default: 15) |

### `stations.StationStatus`

One-to-one with Station. Tracks station health.

| Field          | Type     | Description                                                |
| -------------- | -------- | ---------------------------------------------------------- |
| `status`       | enum     | `full` / `partial` / `down`                                |
| `last_updated` | datetime | Auto-updated on save                                       |
| `details`      | JSON     | Arbitrary metadata                                         |
| `computed_by`  | string   | Who set the status — `rule_based` now, ML model name later |

### `stations.SensorReading`

One row per ESP32 transmission. The main time-series table.

| Field                                                       | Description                               |
| ----------------------------------------------------------- | ----------------------------------------- |
| `station`                                                   | FK to Station (nullable)                  |
| `station_code`                                              | Raw station ID from ESP32 (always filled) |
| `timestamp`                                                 | Datetime from ESP32 RTC                   |
| `received_at`                                               | When the server received it               |
| `temperature`                                               | °C                                        |
| `humidity`                                                  | %                                         |
| `pressure`                                                  | hPa                                       |
| `altitude`                                                  | m                                         |
| `light`                                                     | lux                                       |
| `soil_moisture`                                             | voltage                                   |
| `rain`                                                      | tip count                                 |
| `wind_speed`                                                | km/h                                      |
| `wind_direction`                                            | degrees                                   |
| `volt_3v3`, `volt_5v`, `volt_batt`, `volt_solar`, `volt_dc` | Power rail voltages                       |
| `curr_batt`, `curr_solar`                                   | Current readings                          |

All sensor fields are nullable — the ESP32 sends `nan` when a sensor is absent or broken.

DB indexes exist on `timestamp`, `station_code`, and the composite `(station_code, timestamp)`.

---

## Known Issues

- **CORS not configured** — `django-cors-headers` is not installed. The React frontend cannot call the Django API until this is added.
- **No REST registration endpoint** — the accounts app only has a template-based register view. React has no JSON API to call for signup.
- **No current user endpoint** — once logged in, React has no way to fetch the logged-in user's profile or role.
- **Frontend is static** — the dashboard and auth pages show hardcoded data with no real API calls yet.
- **Bug in ingest view** — `stations/views.py` line ~195 uses `status_code=400` instead of `status=400` in a DRF `Response()` call. This raises a `TypeError` at runtime if an ESP32 sends a malformed timestamp on Format 1.
- **Secrets hardcoded** — the Django secret key and database password are in `settings.py`. Must be moved to environment variables before any deployment.

---

Built at IoT-ra Lab, Makerere University — AdEMNEA Project.
