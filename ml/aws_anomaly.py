"""
AWS sensor-fault detection — shared core.

ONE general Isolation Forest for the whole network, trained on all stations pooled
together. Imported by both:
  * ml/training/train_general_model.ipynb  -> trains + validates + saves the model
  * ml/fastapi_service/main.py             -> loads the model, scores live windows

Why one general model rather than one per station: we do not yet know which physical
stations will feed the live system (that is the field team's call). A per-station
model is useless for a station it never saw and cannot be built for a station with no
history. The features here are mostly BEHAVIOURAL -- rate of change, rolling variance,
within-bin spread -- and bad behaviour looks the same everywhere, so a pooled model
generalises to unseen stations. When real stations with history arrive, a per-station
model can be dropped in and preferred by the serving layer; the general model stays as
the fallback.

Detected faults (per the project doc): spike, drift, jitter (Isolation Forest);
stuck-at and rainfall-rate (deterministic rules -- a density model cannot see a frozen
sensor, which sits at a perfectly normal value).

TRAIN vs SERVE gaps, honestly stated -- these cannot be closed until the real stations
and firmware are known, and are documented for the field team:
  * UNITS: training data is calibrated (m/s, VWC%, hPa). Live ESP32 posts may be in
    different raw units. Per-sensor robust scaling absorbs a linear scale/offset but
    not a nonlinear calibration curve.
  * CADENCE: training is 5-min binned; live posts are ~15 min apart. step and rollvar
    have different characteristics at different cadence.
  * WITHIN-BIN STD: not available from raw live posts, so binstd is marked absent at
    serve time (has_binstd = 0), exactly as wind direction is handled in training.
"""

import warnings
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.metrics import (average_precision_score, matthews_corrcoef,
                             roc_auc_score)

warnings.filterwarnings("ignore")

# ---------------------------------------------------------------- configuration
ROLL = "6h"            # rolling-variance window (project doc: 6 hours)
STEP_MAX_GAP = 20      # minutes; a step across a bigger gap is not comparable
CONTAM = 0.01          # operating point: ~1% of clean training data flagged
MIN_TRAIN = 500        # skip a station-sensor with too little clean data
TRAIN_FRAC = 0.7       # fraction of blocks assigned to train
N_SYNTH = 2000         # synthetic rows per fault type, for validation
SPLIT_BLOCK = 2016     # ~7 days at 5-min: blocked holdout size
SEG_BLOCK = 2016       # ~7 days: regime change-point granularity
SEG_K = 5.0            # block-median jump this many robust-sd = regime change
SEG_MIN = 2000         # a regime shorter than this is not worth training on
SEG_MIN_SD = 1.5       # ...and at least this many of the sensor's own sd

RAIN_MAX_BIN = 15.0    # mm in one 5-min bin; world record 5-min fall ~31 mm
RAIN_MAX_HOUR = 60.0   # mm in a rolling hour

FEATS = ["value", "step", "rollvar", "binstd"]

# (sensor, value column, within-bin std column or None, circular?)
SIGNALS = [
    ("wind_speed", "10m_wind_speed_ms_mean",         "10m_wind_speed_ms_std",         False),
    ("wind_dir",   "10m_wind_direction_deg",         None,                            True),
    ("solar",      "10m_solar_radiation_v_mean",     "10m_solar_radiation_v_std",     False),
    ("air_temp",   "2m_air_temperature_c_mean",      "2m_air_temperature_c_std",      False),
    ("humidity",   "2m_relative_humidity_pct_mean",  "2m_relative_humidity_pct_std",  False),
    ("pressure",   "gnd_pressure_hpa_mean",          "gnd_pressure_hpa_std",          False),
    ("soil_temp",  "gnd_soil_temperature_c_mean",    "gnd_soil_temperature_c_std",    False),
    ("soil_moist", "gnd_soil_moisture_vwc_pct_mean", "gnd_soil_moisture_vwc_pct_std", False),
]
RAIN_COL = "gnd_rainfall_mm_sum"
CIRCULAR = {"wind_dir"}

# Live app (flat ESP32 schema) field -> our sensor name. The app has no soil
# temperature field, and `light` is the only solar proxy; unmapped sensors are simply
# not scored for that station.
APP_FIELD_TO_SENSOR = {
    "temperature":    "air_temp",
    "humidity":       "humidity",
    "pressure":       "pressure",
    "wind_speed":     "wind_speed",
    "wind_direction": "wind_dir",
    "soil_moisture":  "soil_moist",
    "light":          "solar",
    # "rain" is handled by the rainfall rule, not the model
}


# ---------------------------------------------------------------- feature engineering
def feat_matrix(s, circular=False, binstd=None):
    """value / step / 6h rolling variance / within-bin std, on a datetime index.

    `s` is a numeric Series indexed by timestamp. `binstd` is an optional Series of
    within-bin std (training only); absent at serve time.
    """
    s = pd.to_numeric(s, errors="coerce")
    dt = s.index.to_series().diff().dt.total_seconds().div(60)
    raw = s.diff().abs()
    step = np.minimum(raw, 360 - raw) if circular else raw
    step = step.where(dt <= STEP_MAX_GAP)
    f = pd.DataFrame({"value": s, "step": step, "rollvar": s.rolling(ROLL).var()})
    if binstd is not None:
        f["binstd"] = pd.to_numeric(binstd, errors="coerce")
    return f


def feat_from_station(df, vcol, scol, circular):
    """Build a feature frame from a station CSV's columns (training path)."""
    if vcol not in df.columns:
        return pd.DataFrame()
    binstd = df[scol] if (scol and scol in df.columns) else None
    return feat_matrix(df[vcol], circular=circular, binstd=binstd)


# ---------------------------------------------------------------- scaling
def fit_scale(X):
    """Per-feature robust centre/spread for one sensor: median and 1.4826*MAD."""
    stats = {}
    for c in FEATS:
        x = X[c].dropna() if c in X.columns else pd.Series(dtype="float64")
        if len(x) < 2:
            stats[c] = (0.0, 1.0)
            continue
        med = float(x.median())
        mad = float((x - med).abs().median()) * 1.4826
        if mad <= 0:
            mad = float(x.std()) or 1.0
        stats[c] = (med, mad)
    return stats


def apply_scale(X, stats, sensor, sensors):
    """Project one sensor's features onto the shared stacked schema."""
    out = pd.DataFrame(index=X.index)
    for c in FEATS:
        med, mad = stats[c]
        out[c] = (X[c] - med) / mad if c in X.columns else 0.0
    out["has_binstd"] = float("binstd" in X.columns and X["binstd"].notna().any())
    for s in sensors:
        out[f"is_{s}"] = float(s == sensor)
    return out


# ---------------------------------------------------------------- regime + split
def find_regimes(X):
    """Split a sensor's feature frame at sustained level shifts in `value`."""
    s = X["value"]
    nb = len(s) // SEG_BLOCK
    if nb < 3:
        return [(0, len(s))]
    med = np.array([s.iloc[i * SEG_BLOCK:(i + 1) * SEG_BLOCK].median() for i in range(nb)])
    scale = float(np.median(np.abs(med - np.median(med)))) * 1.4826 or (float(s.std()) or 1.0)
    own = float(s.std()) or 1.0
    cuts = [i + 1 for i, d in enumerate(np.abs(np.diff(med)))
            if d > SEG_K * scale and d > SEG_MIN_SD * own]
    bounds = [0] + [c * SEG_BLOCK for c in cuts] + [len(s)]
    segs, start = [], 0
    for b in bounds[1:]:
        if b - start >= SEG_MIN or b == len(s):
            segs.append((start, b)); start = b
    if not segs:
        return [(0, len(s))]
    if len(segs) > 1 and segs[-1][1] - segs[-1][0] < SEG_MIN:
        segs[-2] = (segs[-2][0], segs[-1][1]); segs.pop()
    return segs


def block_split(n):
    """Contiguous-block train/holdout masks; holdout spans the whole record."""
    blk = np.arange(n) // SPLIT_BLOCK
    every = max(int(round(1 / (1 - TRAIN_FRAC))), 2)
    is_te = (blk % every) == (every - 1)
    if is_te.all() or not is_te.any():
        is_te = np.arange(n) >= int(n * TRAIN_FRAC)
    return ~is_te, is_te


# ---------------------------------------------------------------- validation harness
def synth_faults(X):
    """Synthetic faulty feature rows from the clean distribution."""
    rng = np.random.default_rng(0)
    base = X.sample(N_SYNTH, replace=True, random_state=0).reset_index(drop=True)
    vmu, vsd = X["value"].mean(), X["value"].std() or 1.0
    out = {}
    spike = base.copy(); spike["step"] = X["step"].quantile(0.999) * 5 + 1e-6
    out["spike"] = spike
    stuck = base.copy(); stuck["rollvar"] = 0.0; stuck["step"] = 0.0; stuck["value"] = vmu
    out["stuck"] = stuck
    drift = base.copy(); drift["value"] = vmu + rng.choice([-1, 1], N_SYNTH) * 5 * vsd
    out["drift"] = drift
    if "binstd" in X.columns:
        jit = base.copy(); jit["binstd"] = X["binstd"].quantile(0.999) * 5 + 1e-6
        out["jitter"] = jit
    return out


def classification_metrics(y_true, y_pred, y_score):
    """Confusion-matrix metrics for the SYNTHETIC benchmark (no field labels exist)."""
    y_true, y_pred = np.asarray(y_true), np.asarray(y_pred)
    tp = int(((y_pred == 1) & (y_true == 1)).sum())
    fp = int(((y_pred == 1) & (y_true == 0)).sum())
    tn = int(((y_pred == 0) & (y_true == 0)).sum())
    fn = int(((y_pred == 0) & (y_true == 1)).sum())
    rec = tp / (tp + fn) if tp + fn else np.nan
    spec = tn / (tn + fp) if tn + fp else np.nan
    prec = tp / (tp + fp) if tp + fp else np.nan
    acc = (tp + tn) / len(y_true) if len(y_true) else np.nan
    f1 = 2 * prec * rec / (prec + rec) if prec and rec and (prec + rec) else np.nan
    lo, hi = np.min(y_score), np.max(y_score)
    norm = (y_score - lo) / (hi - lo) if hi > lo else np.zeros_like(y_score)
    out = {"tp": tp, "fp": fp, "tn": tn, "fn": fn,
           "accuracy": round(acc, 4), "balanced_acc": round((rec + spec) / 2, 4),
           "precision": round(prec, 4) if prec == prec else np.nan,
           "recall": round(rec, 4), "specificity": round(spec, 4),
           "f1": round(f1, 4) if f1 == f1 else np.nan,
           "mae_score": round(float(np.mean(np.abs(norm - y_true))), 4)}
    if len(np.unique(y_true)) == 2:
        out["roc_auc"] = round(float(roc_auc_score(y_true, y_score)), 4)
        out["pr_auc"] = round(float(average_precision_score(y_true, y_score)), 4)
        out["mcc"] = round(float(matthews_corrcoef(y_true, y_pred)), 4)
    return out


# ---------------------------------------------------------------- rules
def rain_rule(rain_series):
    """Deterministic tipping-bucket faults: impossible rate / hourly total / jam."""
    r = pd.to_numeric(rain_series, errors="coerce")
    rate = r > RAIN_MAX_BIN
    hour = r.rolling("1h").sum() > RAIN_MAX_HOUR
    stuck = (r.rolling(ROLL).std() == 0) & (r.rolling(ROLL).mean() > 1e-9)
    return ((rate | hour | stuck) & r.notna())


def stuck_rule(value_series):
    """Frozen at a NON-ZERO constant over the 6h window (legit zeros exempt)."""
    s = pd.to_numeric(value_series, errors="coerce")
    return (s.rolling(ROLL).std() <= 1e-9) & (s.rolling(ROLL).mean().abs() > 1e-9)


# ---------------------------------------------------------------- data loading
def load_station(path):
    df = pd.read_csv(path, low_memory=False)
    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    return df.dropna(subset=["timestamp"]).set_index("timestamp").sort_index()


def iter_station_files(clean_root):
    root = Path(clean_root)
    for sdir in sorted(p for p in root.iterdir() if p.is_dir()):
        f = next(sdir.glob("*-station.csv"), None)
        if f:
            yield sdir.name, f


# ---------------------------------------------------------------- training
def train_general(clean_root, n_estimators=200, max_samples=50_000, subsample=400_000):
    """Train ONE Isolation Forest on all stations pooled. Returns (bundle, metrics_df).

    Scaling is GLOBAL per sensor (pooled across stations, fitted on train blocks only)
    so the same transform applies to any station -- including unseen ones -- at serve
    time. Slim by construction: few shallow trees, capped sample, so the saved model
    is small enough to upload to shared hosting.
    """
    train_by, test_by = {}, {}          # sensor -> list of per-station frames
    for st, f in iter_station_files(clean_root):
        df = load_station(f)
        for name, vcol, scol, circ in SIGNALS:
            X = feat_from_station(df, vcol, scol, circ).dropna()
            if len(X) < MIN_TRAIN:
                continue
            segs = find_regimes(X)
            X = X.iloc[segs[-1][0]:segs[-1][1]]     # current regime only
            if len(X) < MIN_TRAIN:
                continue
            tr_m, te_m = block_split(len(X))
            train_by.setdefault(name, []).append(X.iloc[tr_m])
            test_by.setdefault(name, []).append(X.iloc[te_m])

    sensors = [n for n, _, _, _ in SIGNALS if n in train_by]
    scales = {n: fit_scale(pd.concat(train_by[n])) for n in sensors}

    stacked = pd.concat([apply_scale(pd.concat(train_by[n]), scales[n], n, sensors)
                         for n in sensors])
    cols = list(stacked.columns)
    if len(stacked) > subsample:
        stacked = stacked.sample(subsample, random_state=0)

    model = IsolationForest(n_estimators=n_estimators, contamination=CONTAM,
                            max_samples=min(max_samples, len(stacked)),
                            random_state=0, n_jobs=-1).fit(stacked.values)

    # PER-SENSOR thresholds, not one global cutoff. A single threshold over the pooled
    # matrix is set by whichever sensor sits in the sparsest region and leaves the rest
    # under-flagged (global-threshold recall was 0.26-0.52 in testing). Each sensor's
    # threshold is the (1-CONTAM) quantile of that sensor's own training anomaly score,
    # giving every sensor an equal ~1% false-positive budget.
    def ascore(Z):
        return -model.decision_function(Z.values)      # higher = more anomalous

    thresholds = {}
    for n in sensors:
        Ztr = apply_scale(pd.concat(train_by[n]), scales[n], n, sensors)[cols]
        thresholds[n] = float(np.quantile(ascore(Ztr), 1 - CONTAM))

    bundle = {"model": model, "scales": scales, "sensors": sensors, "columns": cols,
              "thresholds": thresholds, "trained_on": "all_stations_pooled"}

    # Per-sensor validation from the one shared model, at each sensor's own threshold.
    rows = []
    for n in sensors:
        Xtr, Xte = pd.concat(train_by[n]), pd.concat(test_by[n])
        thr = thresholds[n]
        Z = apply_scale(Xte, scales[n], n, sensors)[cols]
        sc = ascore(Z)
        yt, yp, ys = [np.zeros(len(Z), int)], [(sc > thr).astype(int)], [sc - thr]
        m = {"sensor": n, "n_train": len(Xtr), "n_holdout": len(Xte),
             "clean_fpr": round(float((sc > thr).mean()), 4)}
        for kind, rowsf in synth_faults(Xtr).items():
            R = apply_scale(rowsf, scales[n], n, sensors)[cols]
            scf = ascore(R)
            m[f"recall_{kind}"] = round(float((scf > thr).mean()), 3)
            yt.append(np.ones(len(R), int)); yp.append((scf > thr).astype(int)); ys.append(scf - thr)
        m.update(classification_metrics(np.concatenate(yt), np.concatenate(yp), np.concatenate(ys)))
        rows.append(m)
    return bundle, pd.DataFrame(rows)


# ---------------------------------------------------------------- serving
def save_bundle(bundle, path):
    joblib.dump(bundle, path, compress=3)


def load_bundle(path):
    return joblib.load(path)


def score_window(bundle, window, station_id=None):
    """Score the most recent reading in a per-station window of live readings.

    `window` is a DataFrame indexed (or with a column) by timestamp, holding whatever
    app fields are present (temperature, humidity, ...). Returns a dict:
        {sensor: {"flag": 0/1, "score": float, "reason": str}, ...}
    Only sensors with a mapped, populated column are scored. Needs ~6h of history for
    the rolling-variance feature; with less, rollvar is NaN and that sensor is skipped.
    """
    if "timestamp" in window.columns:
        window = window.set_index("timestamp")
    window = window.sort_index()
    model, scales, sensors, cols = (bundle["model"], bundle["scales"],
                                    bundle["sensors"], bundle["columns"])
    thresholds = bundle.get("thresholds", {})
    out = {}
    for field, sensor in APP_FIELD_TO_SENSOR.items():
        if field not in window.columns or sensor not in scales:
            continue
        s = pd.to_numeric(window[field], errors="coerce")
        if s.notna().sum() < 2:
            continue
        feat = feat_matrix(s, circular=(sensor in CIRCULAR))      # no binstd live
        last = feat.dropna(subset=["value", "step", "rollvar"]).tail(1)
        if last.empty:
            continue
        Z = apply_scale(last, scales[sensor], sensor, sensors)[cols]
        ascore = float(-model.decision_function(Z.values)[0])     # higher = anomalous
        thr = thresholds.get(sensor, 0.0)
        flag = int(ascore > thr)
        reason = "anomaly" if flag else "ok"
        # Deterministic stuck-at overrides a "normal" model verdict.
        if bool(stuck_rule(s).iloc[-1]):
            flag, reason = 1, "stuck"
        out[sensor] = {"flag": flag, "score": round(ascore - thr, 4), "reason": reason}

    if "rain" in window.columns:
        rain = pd.to_numeric(window["rain"], errors="coerce")
        if rain.notna().sum() >= 2 and bool(rain_rule(rain).iloc[-1]):
            out["rainfall"] = {"flag": 1, "score": None, "reason": "rain_rate"}
        elif rain.notna().any():
            out["rainfall"] = {"flag": 0, "score": None, "reason": "ok"}
    return out
