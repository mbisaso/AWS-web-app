"""
AWS sensor-fault detection service.

Replaces the previous supervised station-health classifier. This service loads the
general Isolation Forest (one model for the whole network) and scores a WINDOW of
recent readings for a station, returning a per-sensor fault verdict.

Why a window and not a single reading: the model's features include a 6-hour rolling
variance, so it needs recent history. The Django backend sends the last ~6 hours of
readings for the station (its "Option B" — the service stays stateless, which suits
shared/cPanel hosting).

Endpoints:
  GET  /            health check + model metadata
  POST /predict     score a window -> per-sensor flags
"""

import sys
from pathlib import Path
from typing import List, Optional

import pandas as pd
from fastapi import FastAPI
from pydantic import BaseModel

# aws_anomaly.py lives one level up (shared by training and serving).
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))
import aws_anomaly as A  # noqa: E402

MODEL_PATH = BASE_DIR / "models" / "general_model.joblib"
bundle = A.load_bundle(MODEL_PATH)

app = FastAPI(title="AWS Sensor-Fault Detector")


class Reading(BaseModel):
    timestamp: str
    temperature:    Optional[float] = None
    humidity:       Optional[float] = None
    pressure:       Optional[float] = None
    wind_speed:     Optional[float] = None
    wind_direction: Optional[float] = None
    soil_moisture:  Optional[float] = None
    light:          Optional[float] = None
    rain:           Optional[float] = None


class Window(BaseModel):
    station_id: str
    readings: List[Reading]      # oldest -> newest, ideally >= 6 hours


@app.get("/")
def root():
    return {
        "status": "AWS sensor-fault detector running",
        "model": bundle.get("trained_on", "general"),
        "sensors": bundle["sensors"],
        "needs_history_hours": 6,
    }


@app.post("/predict")
def predict(win: Window):
    """Score the latest reading in the window against each sensor's own threshold."""
    if not win.readings:
        return {"station_id": win.station_id, "error": "empty window", "sensors": {}}

    df = pd.DataFrame([r.model_dump() for r in win.readings])
    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    df = df.dropna(subset=["timestamp"])

    sensors = A.score_window(bundle, df, station_id=win.station_id)
    faulty = [s for s, v in sensors.items() if v["flag"] == 1]

    return {
        "station_id": win.station_id,
        "as_of": df["timestamp"].max().isoformat() if len(df) else None,
        "n_readings": len(df),
        "sensors": sensors,           # {sensor: {flag, score, reason}}
        "faulty_sensors": faulty,
        "any_fault": bool(faulty),
    }
