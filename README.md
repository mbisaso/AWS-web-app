# AWS Monitor (AdEMNEA Weather Station Dashboard)

A full-stack web platform for monitoring a network of Automatic Weather Stations (AWS) deployed across Uganda. Built at the IoT-ra Lab, Makerere University as part of the AdEMNEA Project (formerly WIMEA-ICT).

Physical stations use ESP32 microcontrollers to capture weather parameters and power rail metrics, transmitting data via GSM. This platform receives that data, stores it in PostgreSQL/MySQL, computes real-time sensor anomaly verdicts via an **embedded in-memory Machine Learning model**, and serves a React dashboard for meteorologists, farmers, and administrators.

This replaces a previous ThingSpeak-based pipeline with a fully in-house Django + MySQL/PostgreSQL + React stack.

---

## 🚦 Project Status (Updated)

- **Backend Architecture:** Production-ready Django application designed for single-package **cPanel shared hosting** (Phusion Passenger / WSGI).
- **Embedded ML Engine:** Anomaly detection is **100% embedded inside Django**. There is **no separate FastAPI/Uvicorn microservice** to maintain or run. Predictions execute in memory (~10–20ms) when data hits `/api/ingest/weather/`.
- **Split Channel Ingestion:** Ingestion endpoints mirror 3 ThingSpeak channels:
  - `/api/ingest/weather/` — Channel 1 (Weather metrics + ML anomaly scoring)
  - `/api/ingest/voltage/` — Channel 2 (Power rail voltages)
  - `/api/ingest/current/` — Channel 3 (Solar & battery currents)
  - `/api/ingest/` — Raw ESP32 string legacy fallback.

---

## 🛠️ Tech Stack

**Backend**
- Python 3.11+ / 3.14
- Django 5.2.3 + Django REST Framework
- djangorestframework-simplejwt (JWT Authentication)
- scikit-learn + pandas + joblib + numpy (In-memory ML Inference)
- MySQL / MariaDB / PostgreSQL

**Frontend**
- React 19 + TypeScript
- Vite 8
- TailwindCSS v4
- React Router v7

---

## 📁 Project Structure

```
AWS-web-app/
├── backend/                            Django project root (Package for cPanel)
│   ├── manage.py
│   ├── requirements.txt                Backend dependencies (Django + scikit-learn + pandas)
│   ├── test_ingest_weather.py          Local test script for live ML ingestion
│   ├── ml/                             Embedded ML module & model bundle
│   │   ├── aws_anomaly.py              Feature extraction & Isolation Forest scoring logic
│   │   └── models/
│   │       └── general_model.joblib    Pre-trained Isolation Forest model (~25 MB)
│   ├── aws_dashboard/                  Project settings package
│   │   ├── settings.py
│   │   ├── urls.py
│   │   ├── wsgi.py
│   │   └── asgi.py
│   ├── accounts/                       User management & JWT auth app
│   └── stations/                       Core data, ingestion & status app
│       ├── models.py                   Station, StationStatus, SensorReading, WeatherReading
│       ├── ml_service.py               In-memory model loader & predictor (predict_station_window)
│       ├── views.py                    API endpoints (/api/ingest/weather/, etc.)
│       ├── serializers.py
│       └── urls.py
├── frontend/                           React + Vite dashboard app
└── ml/                                 ML training notebooks & datasets (offline development)
```

---

## ⚙️ Quick Start (Local Development)

### 1. Setup Backend Virtual Environment

```bash
cd backend
python -m venv .venv

# Activate (Windows)
.venv\Scripts\activate

# Activate (Mac/Linux)
source .venv/bin/activate

pip install -r requirements.txt
```

### 2. Run Database Migrations

```bash
python manage.py migrate
python manage.py createsuperuser
```

### 3. Start Backend Server

```bash
python manage.py runserver
```
*Backend runs at `http://localhost:8000`*

### 4. Start React Frontend

In a separate terminal:
```bash
cd frontend
npm install
npm run dev
```
*Frontend runs at `http://localhost:5173`*

### 5. Daily Performance Report Email (Local)

The daily report covers the previous calendar day in `Africa/Kampala` time. It includes an overall summary and per-station details in the email and attached PDF. Delivery is disabled until configured.

1. Apply migrations and create an admin account if you have not already:

  ```powershell
  cd backend
  .\.venv\Scripts\python.exe manage.py migrate
  .\.venv\Scripts\python.exe manage.py createsuperuser
  ```

2. Open `http://localhost:8000/admin/`, sign in, and configure **Daily performance report settings**. Choose **Admins**, **All active users**, or **Selected users**. For **Selected users**, move the desired active accounts with email addresses into the selected list. Set the send time, then enable delivery. Admins include accounts with the `admin` role, staff status, or superuser status. Recipients are BCC'd.

3. Check the report without sending email:

  ```powershell
  .\.venv\Scripts\python.exe manage.py send_daily_performance_report --dry-run
  ```

4. To receive email outside the terminal, configure the existing `EMAIL_*` SMTP variables in `backend/.env`. Without SMTP settings, local development uses Django's console email backend and prints the message instead of sending it.

5. To run delivery locally without keeping Django's development server open, create a Windows Task Scheduler task:
  - Set a daily trigger at midnight and repeat it every 1 minute indefinitely.
  - Set the action program to the full path to `backend\.venv\Scripts\python.exe`.
  - Set arguments to `manage.py send_daily_performance_report`.
  - Set **Start in** to the full path to the `backend` directory.

The command checks the configured time and sends at most once per local day. The machine must be awake and the database reachable at delivery time. `--force` sends immediately for testing and bypasses the enabled/time checks.

---

## 🧪 Local ML Ingestion Testing

To verify in-memory ML model anomaly detection locally without an ESP32 device:

```bash
cd backend
.venv\Scripts\python.exe test_ingest_weather.py
```

**What the test script does:**
Simulates weather ingestion for Makerere (`AWS-001`), KYA (`AWS-002`), and Masaka (`AWS-003`) stations, printing live console logs (`[START]`, `[INFO]`, `[SUCCESS]`, `[FAULT DETECTED]`) and displaying the final `StationStatus` stored in your database.

---

## 🤖 Embedded Machine Learning Architecture

- **Model Type:** Isolation Forest + Deterministic Rules (`stuck_rule` & `rain_rule`).
- **Input:** 6-hour rolling window of readings per station.
- **Features Computed:** Rate of change (`step`), 6-hour rolling variance (`rollvar`), and robust feature scaling.
- **Output:** Per-sensor status flags (`air_temp`, `humidity`, `pressure`, `wind_speed`, `wind_dir`, `soil_moist`, `solar`, `rainfall`), score, and reason (`ok`, `stuck`, `anomaly`, `rain_rate`).
- **Station Status Verdicts:**
  - `FULL` — All sensors operating normally.
  - `PARTIAL` — One or more sensors flagged faulty.
  - `DOWN` — Station hasn't reported within `expected_interval_minutes`.

---

## 🌐 API Endpoints

| Method | Endpoint                              | Auth       | Description                                                 |
| ------ | ------------------------------------- | ---------- | ----------------------------------------------------------- |
| POST   | `/api/ingest/weather/`                | AllowAny   | Receives Channel 1 weather data & triggers embedded ML      |
| POST   | `/api/ingest/voltage/`                | AllowAny   | Receives Channel 2 voltage rail readings                    |
| POST   | `/api/ingest/current/`                | AllowAny   | Receives Channel 3 current readings                         |
| POST   | `/api/ingest/`                        | AllowAny   | Legacy raw ESP32 string ingest endpoint                     |
| POST   | `/api/token/`                         | AllowAny   | Obtain JWT access & refresh tokens                          |
| POST   | `/api/token/refresh/`                 | AllowAny   | Refresh JWT access token                                    |
| GET    | `/api/stations/`                      | JWT Bearer | Registered stations + live computed `StationStatus`        |
| GET    | `/api/stations/<station_id>/`         | JWT Bearer | Single station details + latest reading                     |
| GET    | `/api/stations/<station_id>/history/` | JWT Bearer | Historical time-series chart data (`?hours=24`, `?type=...`) |
| GET    | `/api/export/`                        | JWT Bearer | Export historical data to CSV/JSON for analysis             |

---

## 🚀 cPanel Deployment Notes

Refer to [DEPLOYMENT.md](file:///F:/IoT-ra/AWS-web-app/DEPLOYMENT.md) for full deployment instructions.

1. **Package Backend:** Zip the contents of `backend/` (including `backend/ml/` and `backend/stations/ml_service.py`). **Do NOT include `.venv` or local `.env`**.
2. **Upload to cPanel:** Upload and extract via cPanel File Manager.
3. **Install Requirements:** Run `pip install -r requirements.txt` in the cPanel Python Application setup.
4. **Restart App:** Click **Restart** in cPanel Setup Python App.
