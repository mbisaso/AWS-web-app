from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional

# Absolute path anchored to this file's location — works regardless of working directory
BASE_DIR = Path(__file__).resolve().parent.parent

# Load model, threshold and feature list on startup
model     = joblib.load(BASE_DIR / 'models' / 'station_health_model.pkl')
threshold = joblib.load(BASE_DIR / 'models' / 'classification_threshold.pkl')
features  = joblib.load(BASE_DIR / 'models' / 'feature_cols.pkl')

app = FastAPI(title="AWS Station Health Predictor")

class SensorInput(BaseModel):
    # Direct sensor readings
    temperature:    Optional[float] = None
    humidity:       Optional[float] = None
    pressure:       Optional[float] = None
    rain:           Optional[float] = None
    wind_speed:     Optional[float] = None
    wind_direction: Optional[float] = None
    light:          Optional[float] = None
    soil_moisture:  Optional[float] = None
    volt_3v3:       Optional[float] = None
    volt_5v:        Optional[float] = None
    volt_batt:      Optional[float] = None
    volt_solar:     Optional[float] = None
    volt_dc:        Optional[float] = None
    curr_batt:      Optional[float] = None
    curr_solar:     Optional[float] = None
    # Rolling features over the last 3 readings
    temperature_mean_3:    Optional[float] = None
    temperature_trend_3:   Optional[float] = None
    wind_speed_mean_3:     Optional[float] = None
    wind_speed_trend_3:    Optional[float] = None
    soil_moisture_mean_3:  Optional[float] = None
    soil_moisture_trend_3: Optional[float] = None
    volt_batt_mean_3:      Optional[float] = None
    volt_batt_trend_3:     Optional[float] = None
    volt_solar_mean_3:     Optional[float] = None
    volt_solar_trend_3:    Optional[float] = None
    curr_batt_mean_3:      Optional[float] = None
    curr_batt_trend_3:     Optional[float] = None
    curr_solar_mean_3:     Optional[float] = None
    curr_solar_trend_3:    Optional[float] = None
    # Time features
    hour_of_day:      Optional[int]   = None
    hours_since_last: Optional[float] = None

@app.get("/")
def root():
    return {"status": "AWS Health Predictor running"}

@app.post("/predict")
def predict(data: SensorInput):
    # Build a single-row DataFrame in the exact feature order the model expects
    row = pd.DataFrame([{f: getattr(data, f) for f in features}])

    # Get probability of at_risk (column 0)
    at_risk_proba = model.predict_proba(row)[0][0]

    # Apply tuned threshold
    prediction = "at_risk" if at_risk_proba >= threshold else "healthy"

    return {
        "prediction":    prediction,
        "at_risk_proba": round(float(at_risk_proba), 4),
        "threshold_used": threshold
    }