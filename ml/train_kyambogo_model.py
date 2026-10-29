"""
Standalone training & validation script for the 15-minute Kyambogo conditional monitoring model.
Works locally on an 8 GB RAM PC (~150 MB peak RAM, ~5 seconds runtime) or on Kaggle.

Usage (Local PC):
    python ml/train_kyambogo_model.py

Outputs:
    - ml/models/general_model.joblib          (Updated model bundle)
    - backend/ml/models/general_model.joblib  (Synced copy for Django in-memory ML service)
    - ml/models/general_validation.csv        (Per-sensor validation metrics table)
"""

import os
import sys
import time
import shutil
import tracemalloc
from pathlib import Path

import numpy as np
import pandas as pd

ML_DIR = Path(__file__).resolve().parent
ROOT_DIR = ML_DIR.parent
if str(ML_DIR) not in sys.path:
    sys.path.insert(0, str(ML_DIR))

import aws_anomaly as A

# Adjust STEP_MAX_GAP to 65 min for both 15-minute and 30-minute station reporting cadences
A.STEP_MAX_GAP = 65

DATA_DIR = ML_DIR / "data" / "clean_data"
OUT_MODEL_ML = ML_DIR / "models" / "general_model.joblib"
OUT_MODEL_BACKEND = ROOT_DIR / "backend" / "ml" / "models" / "general_model.joblib"
OUT_VAL_CSV = ML_DIR / "models" / "general_validation.csv"

N_ESTIMATORS = 200
MAX_SAMPLES = 50_000


def main():
    print("=" * 75)
    print("TRAINING 15-MINUTE ISOLATION FOREST MODEL (KYAMBOGO 6-SENSOR SCHEMA)")
    print("=" * 75)

    if not DATA_DIR.exists() or not list(A.iter_station_files(DATA_DIR)):
        raise FileNotFoundError(
            f"No station CSVs found in {DATA_DIR}. Run 'python ml/extract_kyambogo.py' first."
        )

    tracemalloc.start()
    t0 = time.perf_counter()

    bundle, report = A.train_general(
        DATA_DIR,
        n_estimators=N_ESTIMATORS,
        max_samples=MAX_SAMPLES,
    )

    elapsed = time.perf_counter() - t0
    current_mem, peak_mem = tracemalloc.get_traced_memory()
    tracemalloc.stop()

    print(f"\n[DONE] Training completed in {elapsed:.2f} seconds!")
    print(f"[RAM]  Peak Python memory allocated during training: {peak_mem / 1e6:.2f} MB")
    print(f"[INFO] Sensors trained ({len(bundle['sensors'])}): {bundle['sensors']}")
    print("[INFO] Per-sensor 99th-percentile thresholds:")
    for k, v in bundle["thresholds"].items():
        print(f"       - {k:<12}: {v:.4f}")

    print("\n=== VALIDATION METRICS (15-MIN CADENCE) ===")
    cols = [
        "sensor", "n_train", "n_holdout", "clean_fpr",
        "recall_spike", "recall_drift", "recall_stuck",
        "precision", "recall", "f1", "roc_auc", "pr_auc",
    ]
    present_cols = [c for c in cols if c in report.columns]
    print(report[present_cols].to_string(index=False))

    OUT_MODEL_ML.parent.mkdir(parents=True, exist_ok=True)
    A.save_bundle(bundle, OUT_MODEL_ML)
    report.to_csv(OUT_VAL_CSV, index=False)
    print(f"\n[SAVED] Model bundle -> {OUT_MODEL_ML} ({OUT_MODEL_ML.stat().st_size / 1e6:.2f} MB)")
    print(f"[SAVED] Validation CSV -> {OUT_VAL_CSV}")

    if OUT_MODEL_BACKEND.parent.exists():
        shutil.copy2(OUT_MODEL_ML, OUT_MODEL_BACKEND)
        print(f"[SYNCED] Copied model bundle to Django backend -> {OUT_MODEL_BACKEND}")


if __name__ == "__main__":
    main()
