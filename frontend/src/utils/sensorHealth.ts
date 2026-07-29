// Interprets the sensor-fault model's per-station output for the UI.
//
// The backend stores the model's verdict in `station.status.details`:
//   { as_of, faulty_sensors: [...], sensors: { <sensor>: { flag, score, reason } } }
// This module turns that into display-ready shapes, and degrades gracefully when the
// model hasn't run yet (old data, or a station with too little history to score).

import type { Station } from '../types'

// Model sensor keys -> human labels.
export const SENSOR_LABELS: Record<string, string> = {
  air_temp: 'Air temperature',
  humidity: 'Humidity',
  pressure: 'Pressure',
  wind_speed: 'Wind speed',
  wind_dir: 'Wind direction',
  solar: 'Solar radiation',
  soil_temp: 'Soil temperature',
  soil_moist: 'Soil moisture',
  rainfall: 'Rainfall',
}

// Fault reasons -> label + badge tone. `anomaly` is the model's generic verdict;
// stuck/rain_rate come from the deterministic rules; spike/drift/jitter appear in
// validation. Amber = degraded, rose = clear fault.
export const REASON_META: Record<string, { label: string; tone: string }> = {
  ok:        { label: 'OK',                  tone: 'bg-emerald-50 text-emerald-700' },
  anomaly:   { label: 'Abnormal readings',   tone: 'bg-rose-50 text-rose-700' },
  stuck:     { label: 'Stuck / frozen',      tone: 'bg-amber-50 text-amber-700' },
  rain_rate: { label: 'Impossible rainfall', tone: 'bg-rose-50 text-rose-700' },
  spike:     { label: 'Spike',               tone: 'bg-rose-50 text-rose-700' },
  drift:     { label: 'Calibration drift',   tone: 'bg-amber-50 text-amber-700' },
  jitter:    { label: 'Electrical noise',    tone: 'bg-amber-50 text-amber-700' },
}

export function sensorLabel(key: string): string {
  return SENSOR_LABELS[key] ?? key.replace(/_/g, ' ')
}

export function reasonMeta(reason: string) {
  return REASON_META[reason] ?? { label: reason, tone: 'bg-slate-100 text-slate-600' }
}

export interface SensorHealth {
  key: string
  label: string
  ok: boolean
  reason: string
}

export type HealthSummary = 'ok' | 'fault' | 'nodata'

export interface StationHealth {
  hasData: boolean          // did the model produce per-sensor output for this station?
  summary: HealthSummary
  sensors: SensorHealth[]   // every scored sensor, faulty first
  faulty: SensorHealth[]
  faultyCount: number
  scoredCount: number
  asOf: string | null
}

export function deriveHealth(station: Station | null | undefined): StationHealth {
  const details = station?.status?.details
  const sensorsObj = details?.sensors
  const asOf = details?.as_of ?? null

  if (!sensorsObj || Object.keys(sensorsObj).length === 0) {
    return { hasData: false, summary: 'nodata', sensors: [], faulty: [],
             faultyCount: 0, scoredCount: 0, asOf }
  }

  const sensors: SensorHealth[] = Object.entries(sensorsObj).map(([key, v]) => ({
    key,
    label: sensorLabel(key),
    ok: v.flag === 0,
    reason: v.reason,
  }))
  // Faulty first, then alphabetical, so the important rows lead.
  sensors.sort((a, b) => Number(a.ok) - Number(b.ok) || a.label.localeCompare(b.label))

  const faulty = sensors.filter((s) => !s.ok)
  return {
    hasData: true,
    summary: faulty.length ? 'fault' : 'ok',
    sensors,
    faulty,
    faultyCount: faulty.length,
    scoredCount: sensors.length,
    asOf,
  }
}

// One-line health label + badge tone for a station, for tables and headers.
export function healthBadge(h: StationHealth): { label: string; tone: string } {
  if (!h.hasData) return { label: 'Awaiting analysis', tone: 'bg-slate-100 text-slate-500' }
  if (h.summary === 'ok') {
    return { label: `All ${h.scoredCount} sensors OK`, tone: 'bg-emerald-50 text-emerald-700' }
  }
  const noun = h.faultyCount === 1 ? 'sensor' : 'sensors'
  return { label: `${h.faultyCount} ${noun} faulty`, tone: 'bg-rose-50 text-rose-700' }
}
