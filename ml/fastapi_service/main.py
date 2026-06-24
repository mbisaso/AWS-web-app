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
    temperature:          Optional[float] = None
    dew_point:            Optional[float] = None
    wind_speed:           Optional[float] = None
    wind_direction:       Optional[float] = None
    temperature_mean_3h:  Optional[float] = None
    temperature_trend_3h: Optional[float] = None
    dew_point_mean_3h:    Optional[float] = None
    dew_point_trend_3h:   Optional[float] = None
    wind_speed_mean_3h:   Optional[float] = None
    wind_speed_trend_3h:  Optional[float] = None
    hour_of_day:          Optional[int]   = None

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