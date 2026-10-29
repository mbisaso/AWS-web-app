"""
Extracts Sheet 7 ('Kyambogo 25') from 'ML DATA.xlsx' into clean 15-minute CSV files
for conditional monitoring ML training.

Included columns (6 target sensors + timestamp):
  - timestamp          (combined Date + Time in ISO format YYYY-MM-DD HH:MM:SS)
  - temperature        (Temperature in °C)
  - humidity           (Relative Humidity in % RH)
  - pressure           (Barometric Pressure in hPa)
  - wind_speed         (Converted from km/h to m/s by dividing by 3.6)
  - wind_direction     (Wind Direction in degrees 0-360)
  - solar_radiation    (Global Radiation in W/m²)

Excluded:
  - Dew Point (°C)     (Derived from Temperature & Humidity; not an independent physical sensor)
"""

import os
import re
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
import numpy as np
import pandas as pd

ROOT_DIR = Path(__file__).resolve().parent.parent
XLSX_PATH = ROOT_DIR / "ML DATA.xlsx"

OUT_CLEAN_CSV = ROOT_DIR / "ml" / "data" / "kyambogo_15min_clean.csv"
OUT_STATION_CSV = ROOT_DIR / "ml" / "data" / "clean_data" / "kyambogo" / "kyambogo-station.csv"
OUT_STATION_30M_CSV = ROOT_DIR / "ml" / "data" / "clean_data" / "kyambogo_30m" / "kyambogo_30m-station.csv"


def parse_xlsx_sheet(xlsx_path: Path, sheet_xml_path: str = "xl/worksheets/sheet7.xml") -> pd.DataFrame:
    with zipfile.ZipFile(xlsx_path, "r") as z:
        shared_strings = []
        if "xl/sharedStrings.xml" in z.namelist():
            for _, elem in ET.iterparse(z.open("xl/sharedStrings.xml"), events=("end",)):
                if elem.tag.endswith("}si"):
                    shared_strings.append(
                        "".join(t.text or "" for t in elem.iter() if t.tag.endswith("}t"))
                    )
                    elem.clear()

        def col_to_idx(cell_ref: str) -> int:
            col = re.match(r"([A-Z]+)", cell_ref).group(1)
            idx = 0
            for ch in col:
                idx = idx * 26 + (ord(ch) - ord("A") + 1)
            return idx - 1

        rows = []
        for _, elem in ET.iterparse(z.open(sheet_xml_path), events=("end",)):
            if elem.tag.endswith("}row"):
                r_dict = {}
                for c in elem:
                    if c.tag.endswith("}c"):
                        c_idx = col_to_idx(c.attrib.get("r", "A1"))
                        t = c.attrib.get("t")
                        v_elem = c.find(
                            "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v"
                        )
                        val = v_elem.text if v_elem is not None else None
                        if t == "s" and val is not None:
                            val = shared_strings[int(val)]
                        r_dict[c_idx] = val
                if r_dict:
                    rows.append([r_dict.get(i) for i in range(max(r_dict.keys()) + 1)])
                elem.clear()

    return pd.DataFrame(rows[1:], columns=rows[0])


def main():
    print(f"[1/3] Reading 'Kyambogo 25' from {XLSX_PATH} ...")
    raw_df = parse_xlsx_sheet(XLSX_PATH, "xl/worksheets/sheet7.xml")
    print(f"      Loaded {len(raw_df):,} raw rows.")

    # Parse Date + Excel fractional Time into a clean timestamp
    dates = pd.to_datetime(raw_df["Date"], format="%m/%d/%y", errors="coerce")
    time_frac = pd.to_numeric(raw_df["Time"], errors="coerce").fillna(0.0)
    timestamps = dates + pd.to_timedelta(np.round(time_frac * 86400), unit="s")

    def find_col(prefix: str) -> str:
        matches = [c for c in raw_df.columns if c.startswith(prefix)]
        if not matches:
            raise KeyError(f"Column starting with '{prefix}' not found in {list(raw_df.columns)}")
        return matches[0]

    temp_c = pd.to_numeric(raw_df[find_col("Temperature")], errors="coerce")
    hum_pct = pd.to_numeric(raw_df[find_col("Relative Humidity")], errors="coerce")
    press_hpa = pd.to_numeric(raw_df[find_col("Barometric Pressure")], errors="coerce")
    wind_kmh = pd.to_numeric(raw_df["Wind Speed (km/h)"], errors="coerce")
    wind_ms = (wind_kmh / 3.6).round(4)  # Convert km/h -> m/s to match backend/ESP32 schema
    wind_dir = pd.to_numeric(raw_df[find_col("Wind Direction")], errors="coerce")
    solar_wm2 = pd.to_numeric(raw_df[find_col("Global Radiation")], errors="coerce")

    # Sanity check with Dew Point before dropping it: Dew Point should not exceed Temperature
    dew_c = pd.to_numeric(raw_df[find_col("Dew Point")], errors="coerce")
    invalid_dew = (dew_c > temp_c + 0.5).sum()
    print(f"      Pre-check: rows where Dew Point > Temperature: {invalid_dew} (Dew Point excluded from final CSV)")

    # 1. Clean 6-sensor CSV (live app schema names)
    clean_df = pd.DataFrame({
        "timestamp": timestamps,
        "temperature": temp_c,
        "humidity": hum_pct,
        "pressure": press_hpa,
        "wind_speed": wind_ms,
        "wind_direction": wind_dir,
        "solar_radiation": solar_wm2,
    }).dropna(subset=["timestamp"]).sort_values("timestamp").drop_duplicates(subset=["timestamp"])

    OUT_CLEAN_CSV.parent.mkdir(parents=True, exist_ok=True)
    clean_df.to_csv(OUT_CLEAN_CSV, index=False)
    print(f"[2/3] Saved clean 6-sensor CSV -> {OUT_CLEAN_CSV} ({OUT_CLEAN_CSV.stat().st_size / 1e6:.2f} MB, {len(clean_df):,} rows)")

    # 2. Training-pipeline compatible CSV (includes both live names and SIGNALS names for train_general)
    station_df = clean_df.copy()
    station_df["2m_air_temperature_c_mean"] = station_df["temperature"]
    station_df["2m_relative_humidity_pct_mean"] = station_df["humidity"]
    station_df["gnd_pressure_hpa_mean"] = station_df["pressure"]
    station_df["10m_wind_speed_ms_mean"] = station_df["wind_speed"]
    station_df["10m_wind_direction_deg"] = station_df["wind_direction"]
    station_df["10m_solar_radiation_v_mean"] = station_df["solar_radiation"]

    OUT_STATION_CSV.parent.mkdir(parents=True, exist_ok=True)
    station_df.to_csv(OUT_STATION_CSV, index=False)
    print(f"[3/4] Saved 15-min training station CSV -> {OUT_STATION_CSV} ({OUT_STATION_CSV.stat().st_size / 1e6:.2f} MB)")

    # 3. 30-minute cadence series (for 30-min stations like Makerere)
    station_30m_df = station_df.iloc[::2].copy()
    OUT_STATION_30M_CSV.parent.mkdir(parents=True, exist_ok=True)
    station_30m_df.to_csv(OUT_STATION_30M_CSV, index=False)
    print(f"[4/4] Saved 30-min training station CSV -> {OUT_STATION_30M_CSV} ({OUT_STATION_30M_CSV.stat().st_size / 1e6:.2f} MB, {len(station_30m_df):,} rows)")

    print("\n=== EXTRACTED KYAMBOGO CSV SUMMARY ===")
    print(clean_df.describe().round(3).to_string())


if __name__ == "__main__":
    main()
