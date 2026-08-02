import os
import sys
import logging
from pathlib import Path
import pandas as pd
import datetime

logger = logging.getLogger(__name__)

# Ensure backend directory is in sys.path so backend.ml is importable
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

try:
    from ml import aws_anomaly as A
except ImportError:
    # Fallback to root ml folder if running in non-standard environment
    ROOT_DIR = BASE_DIR.parent
    if str(ROOT_DIR) not in sys.path:
        sys.path.insert(0, str(ROOT_DIR))
    import aws_anomaly as A

_BUNDLE = None

def get_model_bundle():
    """
    Lazily loads and caches the general Isolation Forest ML model bundle into memory.
    """
    global _BUNDLE
    if _BUNDLE is not None:
        return _BUNDLE

    model_paths = [
        BASE_DIR / "ml" / "models" / "general_model.joblib",
        BASE_DIR.parent / "ml" / "models" / "general_model.joblib",
    ]

    model_path = None
    for p in model_paths:
        if p.exists():
            model_path = p
            break

    if model_path is None:
        msg = f"ML Model file general_model.joblib not found in search paths: {model_paths}"
        print(f"[ERROR] [ML MODEL] {msg}")
        logger.error(f"[ML MODEL] {msg}")
        return None

    try:
        _BUNDLE = A.load_bundle(model_path)
        msg = f"Successfully loaded ML model bundle from {model_path}"
        print(f"[LOADED] [ML MODEL] {msg}")
        logger.info(f"[ML MODEL] {msg}")
        return _BUNDLE
    except Exception as e:
        msg = f"Failed to load ML model bundle from {model_path}: {e}"
        print(f"[ERROR] [ML MODEL] {msg}")
        logger.exception(f"[ML MODEL] {msg}")
        return None


def predict_station_window(station_code, reading=None):
    """
    Directly runs anomaly detection in-memory for a station's recent readings.
    
    Queries ~6 hours of history from SensorReading for this station, builds the feature
    matrix (rolling variance, step, etc.), and runs Isolation Forest + rule checks.

    Returns dict matching the ML service format, or None on failure.
    """
    print(f"\n[START] [ML MODEL] Starting sensor anomaly prediction for station '{station_code}'...")
    logger.info(f"[ML MODEL] Starting anomaly prediction for station '{station_code}'...")

    bundle = get_model_bundle()
    if bundle is None:
        print(f"[ABORTED] [ML MODEL] Prediction ABORTED for station '{station_code}': Model bundle unavailable.")
        return None

    from stations.models import SensorReading

    ref_time = reading.timestamp if reading else datetime.datetime.now(datetime.timezone.utc)
    window_start = ref_time - datetime.timedelta(hours=6)

    recent = list(
        SensorReading.objects.filter(
            station_code=station_code,
            timestamp__gte=window_start,
            timestamp__lte=ref_time,
        ).order_by('timestamp').values(
            'timestamp', 'temperature', 'humidity', 'pressure',
            'wind_speed', 'wind_direction', 'soil_moisture', 'light', 'rain',
        )
    )

    if len(recent) < 2:
        print(f"[SKIP] [ML MODEL] Insufficient historical readings ({len(recent)} found, minimum 2 required for rolling window). Skipping model scoring.")
        logger.warning(f"[ML MODEL] Insufficient readings ({len(recent)} found) for station '{station_code}'.")
        return None

    print(f"[INFO] [ML MODEL] Retrieved {len(recent)} historical readings in 6h window. Computing features & anomaly scores...")

    readings_data = []
    for r in recent:
        readings_data.append({
            'timestamp':      r['timestamp'].isoformat() if isinstance(r['timestamp'], datetime.datetime) else str(r['timestamp']),
            'temperature':    r['temperature'],
            'humidity':       r['humidity'],
            'pressure':       r['pressure'],
            'wind_speed':     r['wind_speed'],
            'wind_direction': r['wind_direction'],
            'soil_moisture':  r['soil_moisture'],
            'light':          r['light'],
            'rain':           r['rain'],
        })

    try:
        df = pd.DataFrame(readings_data)
        df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
        df = df.dropna(subset=["timestamp"])

        if df.empty:
            print(f"[ERROR] [ML MODEL] DataFrame empty after parsing timestamps for station '{station_code}'")
            return None

        sensors = A.score_window(bundle, df, station_id=station_code)
        faulty = [s for s, v in sensors.items() if isinstance(v, dict) and v.get("flag") == 1]

        as_of_val = df["timestamp"].max()
        as_of_str = as_of_val.isoformat() if pd.notna(as_of_val) else None

        result = {
            "station_id": station_code,
            "as_of": as_of_str,
            "n_readings": len(df),
            "sensors": sensors,
            "faulty_sensors": faulty,
            "any_fault": bool(faulty),
        }

        if faulty:
            print(f"[FAULT DETECTED] [ML MODEL] Prediction COMPLETED for station '{station_code}' -> FAULTY SENSORS DETECTED: {faulty}")
            for sensor_name in faulty:
                s_info = sensors.get(sensor_name, {})
                print(f"   -> {sensor_name}: reason='{s_info.get('reason')}', score={s_info.get('score')}")
            logger.warning(f"[ML MODEL] Faults detected for station '{station_code}': {faulty}")
        else:
            print(f"[SUCCESS] [ML MODEL] Prediction COMPLETED for station '{station_code}' -> All sensors normal (Status: FULL).")
            logger.info(f"[ML MODEL] All sensors operational for station '{station_code}'.")

        return result
    except Exception as e:
        print(f"[FAILURE] [ML MODEL] Prediction FAILED for station '{station_code}': {e}")
        logger.exception(f"[ML MODEL] Anomaly prediction failed for station '{station_code}': {e}")
        return None
