# Serving the sensor-fault model

How the trained model is served to the Django backend. The main `DEPLOYMENT.md` covers
the Django app but not the ML service — this fills that gap.

## What runs

`fastapi_service/main.py` loads `models/general_model.joblib` once at startup and
exposes:

| endpoint | purpose |
|---|---|
| `GET /` | health check + model metadata |
| `POST /predict` | score a ~6h window of readings → per-sensor fault flags |

Run locally:

```bash
cd ml/fastapi_service
uvicorn main:app --host 0.0.0.0 --port 8001
```

Django reaches it at `ML_SERVICE_URL` (default `http://localhost:8001/predict`).

## The contract

**Request** (Django sends the last ~6 hours for the station, oldest→newest):

```json
{
  "station_id": "AWS-UG-004",
  "readings": [
    {"timestamp": "2026-06-17T09:00:00", "temperature": 24.5, "humidity": 78,
     "pressure": 900.1, "wind_speed": 1.2, "wind_direction": 180,
     "soil_moisture": 21.0, "light": 0.4, "rain": 0.0},
    "... more readings ..."
  ]
}
```

**Response** (per sensor: `flag` 0/1, `score` = margin past the sensor's threshold,
`reason`):

```json
{
  "station_id": "AWS-UG-004",
  "as_of": "2026-06-17T15:00:00",
  "n_readings": 24,
  "sensors": {
    "air_temp":   {"flag": 0, "score": -0.12, "reason": "ok"},
    "soil_moist": {"flag": 1, "score":  0.08, "reason": "anomaly"},
    "humidity":   {"flag": 1, "score": null,  "reason": "stuck"}
  },
  "faulty_sensors": ["soil_moist", "humidity"],
  "any_fault": true
}
```

Django maps `any_fault` → `StationStatus` (PARTIAL if any sensor faulty, else FULL) and
stores the per-sensor detail in `StationStatus.details` for the dashboard.

## Deployment note (shared cPanel)

The current host is shared cPanel with no SSH (see `DEPLOYMENT.md`). A persistent
`uvicorn` process is not what Passenger manages — Passenger serves the Django app, not
this service. Options, in order of preference for that environment:

1. **Separate small host / VPS** for the ML service (cleanest; the 26 MB model loads in
   one lightweight worker). Point `ML_SERVICE_URL` at it.
2. **cPanel "Application Manager" Python app** on its own port, if the plan allows a
   second persistent app.
3. **In-process fallback** — import `aws_anomaly` directly inside Django and call
   `score_window` without HTTP. Simplest to deploy on the current host, but couples the
   model into the web worker's memory. Reasonable given the small model size.

The service is stateless (it holds no history — Django sends the window), which keeps
all three options viable.

## Uploading the model

`general_model.joblib` is ~26 MB and tracked in git, so it ships with the repo — no
separate upload step. (The previous 2.2 GB per-station set would not have been
uploadable via cPanel File Manager; this is why the general model is deliberately slim.)
