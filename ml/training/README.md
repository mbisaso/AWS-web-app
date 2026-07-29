# ML training — AWS sensor-fault detector

Trains the **general anomaly-detection model** that the FastAPI service serves. One
Isolation Forest for the whole station network, detecting per-sensor faults (spike,
drift, jitter) with deterministic rules for stuck-at and impossible rainfall.

## Layout

```
ml/
  aws_anomaly.py                 shared core: features, training, scoring, rules
  models/
    general_model.joblib         the trained model the service loads   (tracked, ~26 MB)
    general_validation.csv        validation metrics from the last run
  training/
    train_general_model.ipynb    run this to (re)train and validate
    README.md                    this file
  data/                          <-- GIT-IGNORED. Put training CSVs here.
    clean_data/<station>/...     cleaned baseline the model trains on
    weather_data/<station>/...   full (noisy) data, for scoring demos
  fastapi_service/
    main.py                      loads general_model.joblib, serves /predict
```

## How to (re)train

1. Put the training data in `ml/data/` — specifically `ml/data/clean_data/`, one
   folder per station, each with a `*-station.csv`. This folder is git-ignored on
   purpose (it is ~1.3 GB); it does not ship with the repo, so a new dev drops the
   data in and runs.
2. Open `train_general_model.ipynb` and run top to bottom. It trains, validates,
   plots, and writes `ml/models/general_model.joblib` + `general_validation.csv`.
3. Commit the updated `general_model.joblib` (it is small enough to track).

Nothing new to install — the pinned `ml/requirements.txt` already covers it
(scikit-learn, pandas, numpy, joblib, matplotlib).

## What the model expects (and does not)

- **Detection, not forecasting.** It flags whether a sensor is transmitting faulty
  data right now; it does not predict weather.
- **Needs ~6 hours of history** per reading (for the rolling-variance feature). The
  service is sent a window, not a single row.
- **No field labels exist**, so recall is measured on *synthetic* injected faults and
  false-positive rate on genuine clean holdout. The FPR is the trustworthy half.

## Last validation (general model, all 13 training stations)

| metric | value |
|---|--:|
| false-positive rate (target 1%) | **1.0%** |
| recall, spike & jitter | **1.00** |
| recall, drift | 0.02–0.77 (weak — no temporal model) |
| recall, stuck | ~0 by the model; caught by the **rule** instead |
| ROC-AUC | 0.867 |
| precision | 0.819 |
| model size | ~26 MB |

## Config

Model size/quality is set in the notebook (`N_ESTIMATORS`, `MAX_SAMPLES`). The
defaults (200 trees / 50k samples) were picked from a sweep: they give ~0.72
recall-excluding-stuck at 26 MB, within ~0.045 of the older per-station models at a
fraction of the size (the per-station set was 2.2 GB).

## Known train-vs-serve gaps (for the field team)

These cannot be closed until the real stations and their firmware are known:

- **Units** — training data is calibrated (m/s, VWC %, hPa); live ESP32 posts may be
  raw. Per-sensor robust scaling absorbs a linear scale/offset, not a nonlinear
  calibration curve.
- **Cadence** — training is 5-minute binned; live posts are ~15 min apart.
- **Within-bin std** — unavailable live, so that feature is marked absent at serve
  time (same as wind direction is handled in training).
- **Rainfall units** — a known upstream over-count at the seven 15-second-cadence
  stations (see the main project session log). Rainfall is rule-based regardless.

## Per-station models (future)

When real stations accumulate history, a per-station model can be trained (see the
original `train_model.py` in the main project) and the serving layer can prefer it
for that station, falling back to this general model otherwise.
