/* ─────────────────────────────────────────────
   API service layer for the dashboard overview.
   Uses mock data during development.
   Swap the fetchDashboardData implementation when
   the Django REST API is available.
   ───────────────────────────────────────────── */

/* ── Types matching Django models ── */

export type StationStatus = 'online' | 'partial' | 'offline'

export type AlertType =
  | 'station_offline'
  | 'sensor_anomaly'
  | 'sim_expiring'
  | 'low_battery'
  | 'threshold_breach'

export type AlertSeverity = 'critical' | 'warning' | 'info'

export interface SensorReading {
  value: number
  unit: string
}

export interface StationReading {
  id: number
  name: string
  station_code: string
  location: string
  latitude: number
  longitude: number
  status: StationStatus
  temperature: SensorReading | null
  humidity: SensorReading | null
  rainfall: SensorReading | null
  wind_speed: SensorReading | null
  pressure: SensorReading | null
  last_seen: string
  expected_interval_minutes: number
  is_stale: boolean
}

export interface Alert {
  id: number
  type: AlertType
  severity: AlertSeverity
  station_name: string
  station_id: number
  message: string
  timestamp: string
  is_resolved?: boolean
  resolved_at?: string
  resolved_note?: string
  explanation?: string
  related_url?: string
}

export interface AlertFilterParams {
  severity?: AlertSeverity | 'all'
  type?: AlertType | 'all'
  station_id?: number | null
  status?: 'unresolved' | 'resolved' | 'all'
  search?: string
  date_from?: string
  date_to?: string
  page?: number
  page_size?: number
}

export interface AlertsDataResponse {
  alerts: Alert[]
  total: number
}

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  station_offline: 'Station Offline',
  sensor_anomaly: 'Sensor Anomaly',
  sim_expiring: 'SIM Expiry',
  low_battery: 'Low Battery',
  threshold_breach: 'Threshold Breach',
}

export const SEVERITY_CONFIG: Record<AlertSeverity, { label: string; dot: string; text: string; bg: string; border: string }> = {
  critical: { label: 'Critical', dot: 'bg-red-500', text: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  warning: { label: 'Warning', dot: 'bg-yellow-500', text: 'text-yellow-500', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  info: { label: 'Info', dot: 'bg-blue-500', text: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-200' },
}

export interface DashboardSummary {
  total_stations: number
  online_stations: number
  online_percentage: number
  offline_stations: number
  offline_percentage: number
  active_alerts: number
  critical_alerts: number
  warning_alerts: number
  info_alerts: number
}

export interface DashboardData {
  summary: DashboardSummary
  stations: StationReading[]
  alerts: Alert[]
}

/* ── Relative-time helper ── */

export function formatRelativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime()
  const diffSeconds = Math.floor(diffMs / 1000)

  if (diffSeconds < 60) return 'just now'
  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

/* ── Mock data — @development-only ── */

const STATION_DEFS = [
  {
    id: 1,
    name: 'Rukungiri Ridge',
    station_code: 'AWS-001',
    location: 'Rukungiri, Western Region',
    latitude: -0.79,
    longitude: 29.92,
    status: 'online' as StationStatus,
    temp: 26.4,
    humidity: 62,
    rainfall: 0,
    wind: 3.2,
    pressure: 1013.2,
    last_seen_minutes_ago: 2,
    interval: 15,
  },
  {
    id: 2,
    name: 'Lake Victoria East',
    station_code: 'AWS-014',
    location: 'Mfangano, Homa Bay',
    latitude: -0.3,
    longitude: 33.5,
    status: 'partial' as StationStatus,
    temp: 28.1,
    humidity: 78,
    rainfall: 1.2,
    wind: 5.7,
    pressure: 1010.5,
    last_seen_minutes_ago: 11,
    interval: 15,
  },
  {
    id: 3,
    name: 'Karamoja Basin',
    station_code: 'AWS-027',
    location: 'Moroto, Karamoja',
    latitude: 2.5,
    longitude: 34.5,
    status: 'offline' as StationStatus,
    temp: null,
    humidity: null,
    rainfall: null,
    wind: null,
    pressure: null,
    last_seen_minutes_ago: 187,
    interval: 15,
  },
  {
    id: 4,
    name: 'Mount Elgon Gate',
    station_code: 'AWS-031',
    location: 'Mbale, Eastern Region',
    latitude: 1.1,
    longitude: 34.5,
    status: 'online' as StationStatus,
    temp: 22.8,
    humidity: 55,
    rainfall: 0,
    wind: 4.1,
    pressure: 1015.8,
    last_seen_minutes_ago: 4,
    interval: 15,
  },
  {
    id: 5,
    name: 'Mbarara Valley',
    station_code: 'AWS-008',
    location: 'Mbarara, Western Region',
    latitude: -0.6,
    longitude: 30.6,
    status: 'online' as StationStatus,
    temp: 29.5,
    humidity: 45,
    rainfall: 0,
    wind: 2.8,
    pressure: 1012.1,
    last_seen_minutes_ago: 1,
    interval: 15,
  },
  {
    id: 6,
    name: 'Gulu Savannah',
    station_code: 'AWS-022',
    location: 'Gulu, Northern Region',
    latitude: 2.75,
    longitude: 32.3,
    status: 'partial' as StationStatus,
    temp: 31.2,
    humidity: 52,
    rainfall: 0,
    wind: 6.3,
    pressure: 1009.8,
    last_seen_minutes_ago: 23,
    interval: 30,
  },
  {
    id: 7,
    name: 'Jinja Lakeside',
    station_code: 'AWS-005',
    location: 'Jinja, Eastern Region',
    latitude: 0.42,
    longitude: 33.2,
    status: 'online' as StationStatus,
    temp: 27.3,
    humidity: 68,
    rainfall: 0.3,
    wind: 4.5,
    pressure: 1011.4,
    last_seen_minutes_ago: 3,
    interval: 15,
  },
  {
    id: 8,
    name: 'Kasese Highlands',
    station_code: 'AWS-019',
    location: 'Kasese, Western Region',
    latitude: 0.18,
    longitude: 30.08,
    status: 'online' as StationStatus,
    temp: 24.1,
    humidity: 71,
    rainfall: 2.8,
    wind: 1.9,
    pressure: 1014.6,
    last_seen_minutes_ago: 5,
    interval: 15,
  },
  {
    id: 9,
    name: 'Moroto Drylands',
    station_code: 'AWS-035',
    location: 'Moroto, Karamoja',
    latitude: 2.5,
    longitude: 34.6,
    status: 'offline' as StationStatus,
    temp: null,
    humidity: null,
    rainfall: null,
    wind: null,
    pressure: null,
    last_seen_minutes_ago: 422,
    interval: 15,
  },
  {
    id: 10,
    name: 'Entebbe Coast',
    station_code: 'AWS-002',
    location: 'Entebbe, Central Region',
    latitude: 0.05,
    longitude: 32.45,
    status: 'online' as StationStatus,
    temp: 25.9,
    humidity: 74,
    rainfall: 0.8,
    wind: 3.6,
    pressure: 1012.9,
    last_seen_minutes_ago: 1,
    interval: 15,
  },
]

/* ── Station-id to station_name lookup ── */
const STATION_MAP = Object.fromEntries(STATION_DEFS.map((s) => [s.id, `${s.station_code} · ${s.name}`]))

function stationName(id: number): string {
  return STATION_MAP[id] ?? `Station ${id}`
}

const ALERT_DEFS: Omit<Alert, 'id'>[] = [
  {
    type: 'station_offline',
    severity: 'critical',
    station_name: stationName(3),
    station_id: 3,
    message: 'No transmission received for over 3 hours. Battery may be depleted.',
    timestamp: minutesAgo(12),
  },
  {
    type: 'sensor_anomaly',
    severity: 'warning',
    station_name: stationName(2),
    station_id: 2,
    message: 'Humidity sensor reporting erratic values (78% → 94% in 5 minutes).',
    timestamp: minutesAgo(28),
    explanation: 'The humidity sensor at Lake Victoria East exhibited a rapid 16% rise within 5 minutes. This rate of change is 3.8σ above the station\'s typical diurnal variation, suggesting possible sensor condensation or mechanical fault.',
  },
  {
    type: 'sim_expiring',
    severity: 'warning',
    station_name: stationName(9),
    station_id: 9,
    message: 'GSM SIM card expires in 14 days. Please arrange replacement.',
    timestamp: minutesAgo(55),
  },
  {
    type: 'low_battery',
    severity: 'warning',
    station_name: stationName(6),
    station_id: 6,
    message: 'Battery voltage at 11.8V — below nominal operating range (12.0–14.2V).',
    timestamp: minutesAgo(104),
  },
  {
    type: 'threshold_breach',
    severity: 'info',
    station_name: stationName(8),
    station_id: 8,
    message: 'Rainfall exceeded 24h threshold: 48.2mm recorded (limit: 40mm).',
    timestamp: minutesAgo(185),
  },
  {
    type: 'station_offline',
    severity: 'critical',
    station_name: stationName(9),
    station_id: 9,
    message: 'No transmission received for over 7 hours. Station presumed offline.',
    timestamp: minutesAgo(240),
  },
]

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString()
}

function generateMockData(): DashboardData {
  const stations: StationReading[] = STATION_DEFS.map((s) => {
    const lastSeen = minutesAgo(s.last_seen_minutes_ago)
    return {
      id: s.id,
      name: s.name,
      station_code: s.station_code,
      location: s.location,
      latitude: s.latitude,
      longitude: s.longitude,
      status: s.status,
      temperature: s.temp !== null ? { value: s.temp, unit: '°C' } : null,
      humidity: s.humidity !== null ? { value: s.humidity, unit: '%' } : null,
      rainfall: s.rainfall !== null ? { value: s.rainfall, unit: 'mm' } : null,
      wind_speed: s.wind !== null ? { value: s.wind, unit: 'm/s' } : null,
      pressure: s.pressure !== null ? { value: s.pressure, unit: 'hPa' } : null,
      last_seen: lastSeen,
      expected_interval_minutes: s.interval,
      is_stale: Date.now() - new Date(lastSeen).getTime() > s.interval * 2 * 60 * 1000,
    }
  })

  const online = stations.filter((s) => s.status === 'online').length
  const offline = stations.filter((s) => s.status !== 'online').length

  return {
    summary: {
      total_stations: stations.length,
      online_stations: online,
      online_percentage: Math.round((online / stations.length) * 100),
      offline_stations: offline,
      offline_percentage: Math.round((offline / stations.length) * 100),
      active_alerts: ALERT_DEFS.length,
      critical_alerts: ALERT_DEFS.filter((a) => a.severity === 'critical').length,
      warning_alerts: ALERT_DEFS.filter((a) => a.severity === 'warning').length,
      info_alerts: ALERT_DEFS.filter((a) => a.severity === 'info').length,
    },
    stations,
    alerts: ALERT_DEFS.map((a, i) => ({ ...a, id: i + 1 })),
  }
}

/* ── Public API — swap this implementation when the Django REST API is ready ── */

export async function fetchDashboardData(): Promise<DashboardData> {
  /* --- MOCK IMPLEMENTATION (development only) --- */
  await new Promise((resolve) => setTimeout(resolve, 600 + Math.random() * 400))
  return generateMockData()

  /* --- PRODUCTION IMPLEMENTATION (uncomment when API is ready) ---
  const response = await fetch(`${API_BASE}/dashboard/overview/`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  })
  if (!response.ok) {
    throw new Error(`Dashboard API error: ${response.status} ${response.statusText}`)
  }
  return response.json()
  */
}

/* ─────────────────────────────────────────────
   Alerts Center types & mock data
   ───────────────────────────────────────────── */

const ALERT_TEMPLATES: Array<{
  type: AlertType
  severity: AlertSeverity
  station_id: number
  message: string
  explanation?: string
}> = [
  /* ── Critical: station_offline ── */
  { type: 'station_offline', severity: 'critical', station_id: 3, message: 'Heartbeat timeout — no response for 3+ hours. Battery may be depleted.' },
  { type: 'station_offline', severity: 'critical', station_id: 9, message: 'Station presumed offline after 48 missed check-ins over 12 hours.' },
  { type: 'station_offline', severity: 'critical', station_id: 3, message: 'Communication link lost. Last known battery voltage: 11.2V.' },
  { type: 'station_offline', severity: 'critical', station_id: 1, message: 'Solar charge controller reported zero input for 48 hours. Battery at critical level.' },
  { type: 'station_offline', severity: 'critical', station_id: 6, message: 'No transmission received — possible antenna damage after reported storm.' },
  { type: 'station_offline', severity: 'critical', station_id: 8, message: 'Cellular modem not responding to ping. Network carrier shows no recent connection.' },

  /* ── Warning: sensor_anomaly ── */
  { type: 'sensor_anomaly', severity: 'warning', station_id: 2, message: 'Humidity reading 4.2 σ above 30-day baseline (78% → 94% in 5 min).', explanation: 'The humidity sensor exhibited a rapid 16% rise within 5 minutes, 4.2 standard deviations above the station\'s typical diurnal variation. Likely causes: condensation on the sensor element or mechanical damage to the radiation shield.' },
  { type: 'sensor_anomaly', severity: 'warning', station_id: 5, message: 'Temperature sensor reporting 38.5°C — exceeds expected range for this hour by 6.1°C.', explanation: 'The temperature reading of 38.5°C at 14:00 local time is 6.1°C above the historical average for this hour. The model confidence is moderate (p=0.78). Possible causes: direct sunlight exposure due to shield misalignment, or a genuine extreme event.' },
  { type: 'sensor_anomaly', severity: 'warning', station_id: 7, message: 'Wind speed sensor stuck at 0.0 m/s for 90+ minutes despite gust readings at adjacent stations.', explanation: 'Zero-wind reading sustained for 90+ minutes while stations within 15 km report gusts of 4–7 m/s. The sensor likely has mechanical friction or bearing failure. Anemometer replacement recommended.' },
  { type: 'sensor_anomaly', severity: 'warning', station_id: 10, message: 'Barometric pressure dropped 4.2 hPa in 30 minutes — anomalous rate of change.', explanation: 'A pressure drop of 4.2 hPa in 30 minutes exceeds the 99th percentile for rate-of-change at this station. This may indicate a rapidly approaching convective system or sensor malfunction. Cross-referencing with satellite imagery recommended.' },
  { type: 'sensor_anomaly', severity: 'warning', station_id: 4, message: 'Solar radiation sensor reading 1,200 W/m² at 18:00 — physically implausible for this hour.', explanation: 'Solar radiation of 1,200 W/m² at 18:00 local time is above the theoretical maximum for this latitude and time of day. The sensor may be partially shaded by debris or the signal conditioner may be drifting.' },

  /* ── Warning: sim_expiring ── */
  { type: 'sim_expiring', severity: 'warning', station_id: 9, message: 'SIM card expires in 14 days. Please arrange replacement.' },
  { type: 'sim_expiring', severity: 'warning', station_id: 6, message: 'Data bundle depleted — 0 MB of 500 MB monthly allocation remaining.' },
  { type: 'sim_expiring', severity: 'warning', station_id: 3, message: 'SIM card expires in 7 days. Automatic renewal may fail — manual intervention required.' },
  { type: 'sim_expiring', severity: 'warning', station_id: 2, message: 'Roaming charges exceeded: $12.40 incurred in the last 24 hours above plan limit.' },

  /* ── Warning: low_battery ── */
  { type: 'low_battery', severity: 'warning', station_id: 6, message: 'Battery voltage at 11.8V — below nominal operating range (12.0–14.2V).' },
  { type: 'low_battery', severity: 'warning', station_id: 3, message: 'Battery at 32% state of charge. Solar input insufficient for current load.' },
  { type: 'low_battery', severity: 'warning', station_id: 1, message: 'Battery temperature at 52°C — exceeds safe operating limit of 45°C.' },

  /* ── Info: threshold_breach ── */
  { type: 'threshold_breach', severity: 'info', station_id: 8, message: 'Rainfall exceeded 24h threshold: 48.2mm recorded (limit: 40mm).' },
  { type: 'threshold_breach', severity: 'info', station_id: 10, message: 'Wind gust 22.4 m/s exceeds warning threshold of 20 m/s.' },
  { type: 'threshold_breach', severity: 'info', station_id: 5, message: 'Daily max temperature 35.8°C exceeds alert threshold of 34.0°C.' },

  /* ── Info: sensor_anomaly (lower severity) ── */
  { type: 'sensor_anomaly', severity: 'info', station_id: 7, message: 'Rain gauge tips reported at 15-min intervals despite no precipitation — possible debris or insect activity.', explanation: 'The rain gauge has been reporting consistent tip counts at regular intervals for the past 6 hours despite no recorded precipitation. This pattern is characteristic of debris (leaf/insect) in the funnel rather than actual rainfall.' },
  { type: 'sensor_anomaly', severity: 'info', station_id: 4, message: 'Battery voltage sensor calibration drift detected: offset of 0.15V relative to reference reading during maintenance.', explanation: 'Routine cross-check during maintenance revealed a 0.15V offset between the telemetry-reported voltage and the manual multimeter reading at the battery terminals. This is within the alert threshold for investigation.' },

  /* ── Info: threshold_breach (continued) ── */
  { type: 'threshold_breach', severity: 'info', station_id: 2, message: 'Relative humidity averaged 92% over the last 6 hours — dew point alert for crop advisory.' },
  { type: 'threshold_breach', severity: 'info', station_id: 6, message: 'Soil moisture deficit: 7 consecutive days below 25th percentile. Irrigation advisory.' },
  { type: 'threshold_breach', severity: 'info', station_id: 9, message: 'Atmospheric pressure dropped 8 hPa in 6 hours — advisory for incoming weather system.' },
]

const RESOLUTION_NOTES = [
  'Replaced battery on-site. Voltage restored to 13.1V.',
  'SIM card replaced with new unit. Connectivity restored.',
  'Remote reboot resolved connectivity issue.',
  'Sensor cleaned and recalibrated. Readings back within normal range.',
  'Filed maintenance ticket for antenna inspection.',
  'Temporary fix applied — awaiting replacement part.',
  'Threshold adjusted per region review. No action required.',
  'Technician dispatched and resolved on-site.',
]

function generateMockAlerts(): Alert[] {
  const alerts: Alert[] = []
  let id = 1

  for (const tpl of ALERT_TEMPLATES) {
    /* spread timestamps over the last 7 days */
    const hoursAgo = Math.random() * 7 * 24
    const timestamp = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString()

    /* ~30% resolved */
    const is_resolved = Math.random() < 0.3
    let resolved_at: string | undefined
    let resolved_note: string | undefined

    if (is_resolved) {
      const resolveHoursAfter = 1 + Math.random() * 48
      resolved_at = new Date(Date.now() - (hoursAgo - resolveHoursAfter) * 60 * 60 * 1000).toISOString()
      resolved_note = RESOLUTION_NOTES[id % RESOLUTION_NOTES.length]
    }

    alerts.push({
      id,
      ...tpl,
      station_name: stationName(tpl.station_id),
      timestamp,
      is_resolved,
      resolved_at,
      resolved_note,
    })
    id++
  }

  /* sort newest first */
  alerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  return alerts
}

let cachedMockAlerts: Alert[] | null = null

function getMockAlerts(): Alert[] {
  if (!cachedMockAlerts) {
    cachedMockAlerts = generateMockAlerts()
  }
  return cachedMockAlerts
}

export async function fetchAlertsData(params?: AlertFilterParams): Promise<AlertsDataResponse> {
  /* --- MOCK IMPLEMENTATION (development only) --- */
  await new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 200))

  let filtered = getMockAlerts()

  if (params) {
    if (params.severity && params.severity !== 'all') {
      filtered = filtered.filter((a) => a.severity === params.severity)
    }
    if (params.type && params.type !== 'all') {
      filtered = filtered.filter((a) => a.type === params.type)
    }
    if (params.station_id) {
      filtered = filtered.filter((a) => a.station_id === params.station_id)
    }
    if (params.status === 'unresolved') {
      filtered = filtered.filter((a) => !a.is_resolved)
    } else if (params.status === 'resolved') {
      filtered = filtered.filter((a) => a.is_resolved)
    }
    if (params.search) {
      const q = params.search.toLowerCase()
      filtered = filtered.filter(
        (a) => a.message.toLowerCase().includes(q) || a.station_name.toLowerCase().includes(q),
      )
    }
    if (params.date_from) {
      const from = new Date(params.date_from).getTime()
      filtered = filtered.filter((a) => new Date(a.timestamp).getTime() >= from)
    }
    if (params.date_to) {
      const to = new Date(params.date_to).getTime() + 86_400_000
      filtered = filtered.filter((a) => new Date(a.timestamp).getTime() <= to)
    }
  }

  return { alerts: filtered, total: filtered.length }

  /* --- PRODUCTION IMPLEMENTATION (uncomment when API is ready) ---
  const query = new URLSearchParams()
  if (params?.severity && params.severity !== 'all') query.set('severity', params.severity)
  if (params?.type && params.type !== 'all') query.set('type', params.type)
  if (params?.station_id) query.set('station_id', String(params.station_id))
  if (params?.status && params.status !== 'all') query.set('status', params.status)
  if (params?.search) query.set('search', params.search)
  if (params?.date_from) query.set('date_from', params.date_from)
  if (params?.date_to) query.set('date_to', params.date_to)
  if (params?.page) query.set('page', String(params.page))
  if (params?.page_size) query.set('page_size', String(params.page_size))

  const url = `${API_BASE}/alerts/?${query.toString()}`
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  })
  if (!response.ok) {
    throw new Error(`Alerts API error: ${response.status} ${response.statusText}`)
  }
  return response.json()
  */
}

/* ─────────────────────────────────────────────
   Weather Data screen types & mock data
   ───────────────────────────────────────────── */

export type SensorType =
  | 'temperature'
  | 'humidity'
  | 'rainfall'
  | 'wind_speed'
  | 'wind_direction'
  | 'atmospheric_pressure'
  | 'solar_radiation'

export interface HistoricalReading {
  id: number
  timestamp: string
  station_id: number
  station_name: string
  sensor_type: SensorType
  value: number
  unit: string
  is_anomaly: boolean
  anomaly_reason?: string
  is_stale: boolean
}

export interface CurrentSensorReading {
  value: number
  unit: string
  trend: 'up' | 'down' | 'stable'
  is_stale: boolean
  is_out_of_range: boolean
}

export interface WeatherDataResponse {
  readings: HistoricalReading[]
  current: Partial<Record<SensorType, CurrentSensorReading | null>>
}

export const SENSOR_CONFIG: Record<SensorType, { label: string; unit: string; color: string }> = {
  temperature:        { label: 'Temperature',        unit: '°C',   color: '#F97316' },
  humidity:           { label: 'Humidity',           unit: '%',    color: '#0EA5E9' },
  rainfall:           { label: 'Rainfall',           unit: 'mm',   color: '#38BDF8' },
  wind_speed:         { label: 'Wind Speed',         unit: 'm/s',  color: '#22C55E' },
  wind_direction:     { label: 'Wind Direction',     unit: '°',    color: '#94A3B8' },
  atmospheric_pressure: { label: 'Atm. Pressure',    unit: 'hPa',  color: '#8B5CF6' },
  solar_radiation:    { label: 'Solar Radiation',    unit: 'W/m²', color: '#F59E0B' },
}

const SENSOR_LIMITS: Record<SensorType, { min: number; max: number }> = {
  temperature:        { min: -10, max: 55 },
  humidity:           { min: 0,   max: 100 },
  rainfall:           { min: 0,   max: 200 },
  wind_speed:         { min: 0,   max: 50 },
  wind_direction:     { min: 0,   max: 360 },
  atmospheric_pressure: { min: 900, max: 1100 },
  solar_radiation:    { min: 0,   max: 1400 },
}

function generateSensorValue(type: SensorType, hour: number, stationIdx: number): number {
  const seed = (stationIdx * 7 + hour * 13) % 100
  const r = (seed % 17) / 17

  switch (type) {
    case 'temperature': {
      const base = 22 + (stationIdx % 5) * 2
      const diurnal = -5 * Math.cos((hour - 14) * Math.PI / 12)
      return parseFloat((base + diurnal + (r - 0.5) * 3).toFixed(1))
    }
    case 'humidity': {
      const base = 55 + (stationIdx % 4) * 8
      const diurnal = 8 * Math.cos((hour - 14) * Math.PI / 12)
      return parseFloat(Math.min(100, Math.max(20, base + diurnal + (r - 0.5) * 6)).toFixed(0))
    }
    case 'rainfall':
      return r < 0.1 ? parseFloat((Math.random() * 18).toFixed(1)) : 0
    case 'wind_speed':
      return parseFloat(Math.max(0.3, (2 + (r - 0.5) * 4 + Math.sin(hour * Math.PI / 12) * 1.5)).toFixed(1))
    case 'wind_direction':
      return parseFloat((r * 360).toFixed(0))
    case 'atmospheric_pressure':
      return parseFloat((1013 + (r - 0.5) * 12).toFixed(1))
    case 'solar_radiation': {
      if (hour < 6 || hour > 19) return 0
      const peak = 700 + (r - 0.5) * 200
      return parseFloat(Math.max(0, (peak * Math.sin((hour - 6) * Math.PI / 13))).toFixed(0))
    }
  }
}

function getAnomalyReason(type: SensorType, value: number): string {
  if (type === 'temperature' && value > 45) return 'Extreme temperature'
  if (type === 'temperature' && value < 0) return 'Below-freezing reading'
  if (type === 'humidity' && value > 95) return 'Near-saturation humidity'
  if (type === 'rainfall' && value > 50) return 'Extreme precipitation event'
  if (type === 'wind_speed' && value > 25) return 'High wind speed alert'
  if (type === 'solar_radiation' && value > 1200) return 'Extreme solar irradiance'
  if (type === 'atmospheric_pressure' && (value < 980 || value > 1045)) return 'Abnormal pressure'
  return 'Unexpected sensor reading'
}

export async function fetchWeatherData(params: {
  stationId?: number | null
  sensorType: SensorType
  dateFrom: string
  dateTo: string
}): Promise<WeatherDataResponse> {
  /* --- MOCK IMPLEMENTATION (development only) --- */
  await new Promise((resolve) => setTimeout(resolve, 400 + Math.random() * 300))

  const fromMs = new Date(params.dateFrom).getTime()
  const toMs = new Date(params.dateTo).getTime()
  const intervalMs = 3 * 60 * 60 * 1000

  const stations = params.stationId
    ? STATION_DEFS.filter((s) => s.id === params.stationId)
    : STATION_DEFS

  const readings: HistoricalReading[] = []
  const latestByStation: Map<number, { value: number; prevValue: number | null }> = new Map()

  for (const station of stations) {
    const stationIdx = STATION_DEFS.indexOf(station)

    for (let t = fromMs; t <= toMs; t += intervalMs) {
      const hour = new Date(t).getHours()
      const value = generateSensorValue(params.sensorType, hour, stationIdx)
      const isAnomaly = readings.length > 0 && readings.length % 37 === 0

      readings.push({
        id: readings.length + 1,
        timestamp: new Date(t).toISOString(),
        station_id: station.id,
        station_name: station.name,
        sensor_type: params.sensorType,
        value,
        unit: SENSOR_CONFIG[params.sensorType].unit,
        is_anomaly: isAnomaly,
        anomaly_reason: isAnomaly ? getAnomalyReason(params.sensorType, value) : undefined,
        is_stale: false,
      })
    }

    const lastReading = readings[readings.length - 1]
    if (lastReading) {
      latestByStation.set(station.id, { value: lastReading.value, prevValue: readings.length >= 2 ? readings[readings.length - 2].value : null })
    }
  }

  const current: Partial<Record<SensorType, CurrentSensorReading | null>> = {}

  if (params.stationId && latestByStation.has(params.stationId)) {
    const { value, prevValue } = latestByStation.get(params.stationId)!
    const limits = SENSOR_LIMITS[params.sensorType]
    let trend: 'up' | 'down' | 'stable' = 'stable'
    if (prevValue !== null) {
      const diff = value - prevValue
      trend = Math.abs(diff) < 0.5 ? 'stable' : diff > 0 ? 'up' : 'down'
    }
    current[params.sensorType] = {
      value,
      unit: SENSOR_CONFIG[params.sensorType].unit,
      trend,
      is_stale: false,
      is_out_of_range: value < limits.min || value > limits.max,
    }
  }

  return { readings, current }
}

export const DATE_PRESETS = [
  { label: 'Today',     days: 0 },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
] as const

/* ─────────────────────────────────────────────
   Power Data screen types & mock data
   ───────────────────────────────────────────── */

export type ChargingStatus = 'charging' | 'discharging' | 'idle'

export type PowerMetricType =
  | 'battery_level'
  | 'voltage'
  | 'current_draw'
  | 'solar_input'

export interface PowerReading {
  id: number
  timestamp: string
  station_id: number
  station_name: string
  metric: PowerMetricType
  value: number
  unit: string
  is_anomaly: boolean
  anomaly_reason?: string
  is_stale: boolean
}

export interface PowerCurrentReading {
  battery_level: number | null
  voltage: number | null
  current_draw: number | null
  solar_input: number | null
  charging_status: ChargingStatus | null
  estimated_days_remaining: number | null
  is_stale: boolean
}

export interface PowerDataResponse {
  readings: PowerReading[]
  current: PowerCurrentReading | null
}

export const POWER_METRIC_CONFIG: Record<PowerMetricType, { label: string; unit: string; color: string }> = {
  battery_level: { label: 'Battery Level', unit: '%', color: '#22C55E' },
  voltage:       { label: 'Voltage',       unit: 'V', color: '#0EA5E9' },
  current_draw:  { label: 'Current Draw',  unit: 'A', color: '#F97316' },
  solar_input:   { label: 'Solar Input',   unit: 'W', color: '#F59E0B' },
}

const BATTERY_CAPACITY_AH = 100
const NOMINAL_VOLTAGE = 12
const TOTAL_WATT_HOURS = BATTERY_CAPACITY_AH * NOMINAL_VOLTAGE

function generatePowerMetricValue(metric: PowerMetricType, hour: number, stationIdx: number): number {
  const seed = (stationIdx * 7 + hour * 13 + 3) % 100
  const r = (seed % 17) / 17

  switch (metric) {
    case 'battery_level': {
      const base = 65 + (stationIdx % 3) * 10
      const solarHours = Math.max(0, Math.min(1, (hour - 6) / 8))
      const chargeBoost = solarHours * 12
      const overnightDrop = -15 * (1 - solarHours)
      return parseFloat(Math.min(100, Math.max(5, base + chargeBoost + overnightDrop + (r - 0.5) * 5)).toFixed(0))
    }
    case 'voltage': {
      const level = generatePowerMetricValue('battery_level', hour, stationIdx)
      return parseFloat((11.0 + (level / 100) * 3.2 + (r - 0.5) * 0.3).toFixed(2))
    }
    case 'current_draw': {
      const baseDraw = 0.8 + (stationIdx % 5) * 0.3
      const solarHours = Math.max(0, Math.min(1, (hour - 6) / 8))
      const draw = hour >= 19 || hour < 6 ? baseDraw * 1.5 : baseDraw * 0.6
      const solarOffset = solarHours > 0 ? -0.3 * solarHours : 0
      return parseFloat(Math.max(0.1, draw + solarOffset + (r - 0.5) * 0.4).toFixed(2))
    }
    case 'solar_input': {
      if (hour < 6 || hour > 19) return 0
      const peak = 80 + (stationIdx % 4) * 30 + (r - 0.5) * 40
      return parseFloat(Math.max(0, (peak * Math.sin((hour - 6) * Math.PI / 13))).toFixed(0))
    }
  }
}

function getPowerAnomalyReason(metric: PowerMetricType, value: number): string {
  if (metric === 'battery_level' && value < 15) return 'Critically low battery'
  if (metric === 'battery_level' && value < 30) return 'Low battery'
  if (metric === 'voltage' && value < 11.5) return 'Under-voltage — battery may be depleted'
  if (metric === 'voltage' && value > 14.5) return 'Over-voltage — possible regulator fault'
  if (metric === 'current_draw' && value > 8) return 'Abnormally high current draw'
  if (metric === 'solar_input' && value < 5 && new Date().getHours() >= 8 && new Date().getHours() <= 17) return 'Solar panel under-performing during daylight'
  return 'Unexpected power reading'
}

function getChargingStatus(hour: number, batteryLevel: number, solarInput: number): ChargingStatus {
  if (solarInput > 10 && batteryLevel < 95) return 'charging'
  if (solarInput > 5 && batteryLevel < 90) return 'charging'
  if (solarInput === 0 && batteryLevel < 50) return 'discharging'
  if (batteryLevel >= 95) return 'idle'
  if (hour >= 6 && hour <= 19 && solarInput > 0) return 'charging'
  return 'discharging'
}

export async function fetchPowerData(params: {
  stationId?: number | null
  metric: PowerMetricType
  dateFrom: string
  dateTo: string
}): Promise<PowerDataResponse> {
  /* --- MOCK IMPLEMENTATION (development only) --- */
  await new Promise((resolve) => setTimeout(resolve, 400 + Math.random() * 300))

  const fromMs = new Date(params.dateFrom).getTime()
  const toMs = new Date(params.dateTo).getTime()
  const intervalMs = 3 * 60 * 60 * 1000

  const stations = params.stationId
    ? STATION_DEFS.filter((s) => s.id === params.stationId)
    : STATION_DEFS

  const readings: PowerReading[] = []
  const latestByStation: Map<number, number> = new Map()

  for (const station of stations) {
    const stationIdx = STATION_DEFS.indexOf(station)
    let latestValue: number | null = null

    for (let t = fromMs; t <= toMs; t += intervalMs) {
      const hour = new Date(t).getHours()
      const value = generatePowerMetricValue(params.metric, hour, stationIdx)
      const isAnomaly = readings.length > 0 && readings.length % 41 === 0

      readings.push({
        id: readings.length + 1,
        timestamp: new Date(t).toISOString(),
        station_id: station.id,
        station_name: station.name,
        metric: params.metric,
        value,
        unit: POWER_METRIC_CONFIG[params.metric].unit,
        is_anomaly: isAnomaly,
        anomaly_reason: isAnomaly ? getPowerAnomalyReason(params.metric, value) : undefined,
        is_stale: false,
      })
      latestValue = value
    }

    if (latestValue !== null) {
      latestByStation.set(station.id, latestValue)
    }
  }

  const current: PowerCurrentReading | null = params.stationId && latestByStation.has(params.stationId)
    ? (() => {
        const station = STATION_DEFS.find((s) => s.id === params.stationId)!
        const hour = new Date().getHours()
        const stationIdx = STATION_DEFS.indexOf(station)
        const batteryLevel = generatePowerMetricValue('battery_level', hour, stationIdx)
        const voltage = generatePowerMetricValue('voltage', hour, stationIdx)
        const currentDraw = generatePowerMetricValue('current_draw', hour, stationIdx)
        const solarInput = generatePowerMetricValue('solar_input', hour, stationIdx)
        const chargingStatus = getChargingStatus(hour, batteryLevel, solarInput)

        const avgDailyConsumption = (0.8 + (stationIdx % 5) * 0.3) * 24
        const avgDailySolar = 80 * 8 * 0.6
        const netDaily = avgDailySolar - avgDailyConsumption * 12
        const daysRemaining = batteryLevel > 20
          ? null
          : Math.max(0, Math.round((batteryLevel / 100 * TOTAL_WATT_HOURS) / (Math.abs(netDaily) || 1) * (netDaily < 0 ? 0.8 : 1)))

        return {
          battery_level: batteryLevel,
          voltage,
          current_draw: currentDraw,
          solar_input: solarInput,
          charging_status: chargingStatus,
          estimated_days_remaining: daysRemaining,
          is_stale: false,
        }
      })()
    : null

  return { readings, current }
}

/* ─────────────────────────────────────────────
   Weather Analysis screen types & mock data
   ───────────────────────────────────────────── */

export type ViewMode = 'trends' | 'comparison' | 'correlation' | 'distribution'

export interface AnalysisStats {
  average: number
  min: number
  max: number
  std_dev: number
  count: number
  trend: 'rising' | 'falling' | 'stable'
  percent_change: number | null
  compared_to_baseline: { pct_above: number; baseline_value: number } | null
  sparkline: number[]
}

export interface AnalysisDataResponse {
  readings: HistoricalReading[]
  stats: Record<string, AnalysisStats>
}

const BASELINE_VALUES: Partial<Record<SensorType, number>> = {
  temperature: 26.0,
  humidity: 65,
  rainfall: 2.5,
  wind_speed: 3.5,
  atmospheric_pressure: 1013,
  solar_radiation: 450,
}

function computeStats(values: number[]): AnalysisStats {
  const count = values.length
  const sum = values.reduce((a, b) => a + b, 0)
  const average = sum / count
  const min = Math.min(...values)
  const max = Math.max(...values)
  const variance = values.reduce((acc, v) => acc + (v - average) ** 2, 0) / count
  const std_dev = Math.sqrt(variance)

  const firstHalf = values.slice(0, Math.floor(count / 2))
  const secondHalf = values.slice(Math.floor(count / 2))
  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
  const trend: 'rising' | 'falling' | 'stable' =
    secondAvg - firstAvg > firstAvg * 0.02 ? 'rising'
    : firstAvg - secondAvg > firstAvg * 0.02 ? 'falling'
    : 'stable'

  const percent_change = firstAvg > 0 ? parseFloat((((secondAvg - firstAvg) / firstAvg) * 100).toFixed(1)) : null

  const step = Math.max(1, Math.floor(count / 20))
  const sparkline: number[] = []
  for (let i = 0; i < count && sparkline.length < 20; i += step) {
    sparkline.push(values[i])
  }

  return { average: parseFloat(average.toFixed(1)), min: parseFloat(min.toFixed(1)), max: parseFloat(max.toFixed(1)), std_dev: parseFloat(std_dev.toFixed(2)), count, trend, percent_change, compared_to_baseline: null, sparkline }
}

export async function fetchAnalysisData(params: {
  sensorTypes: SensorType[]
  stationIds: number[]
  dateFrom: string
  dateTo: string
}): Promise<AnalysisDataResponse> {
  /* --- MOCK IMPLEMENTATION (development only) --- */
  await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 400))

  const stations = params.stationIds.length
    ? STATION_DEFS.filter((s) => params.stationIds.includes(s.id))
    : STATION_DEFS

  const fromMs = new Date(params.dateFrom).getTime()
  const toMs = new Date(params.dateTo).getTime()
  const intervalMs = 3 * 60 * 60 * 1000

  const readings: HistoricalReading[] = []
  const valuesByKey = new Map<string, number[]>()

  for (const sensorType of params.sensorTypes) {
    for (const station of stations) {
      const stationIdx = STATION_DEFS.indexOf(station)
      const key = `${station.id}:${sensorType}`
      const vals: number[] = []

      for (let t = fromMs; t <= toMs; t += intervalMs) {
        const hour = new Date(t).getHours()
        const value = generateSensorValue(sensorType, hour, stationIdx)
        const isAnomaly = readings.length > 0 && readings.length % 47 === 0

        readings.push({
          id: readings.length + 1,
          timestamp: new Date(t).toISOString(),
          station_id: station.id,
          station_name: station.name,
          sensor_type: sensorType,
          value,
          unit: SENSOR_CONFIG[sensorType].unit,
          is_anomaly: isAnomaly,
          anomaly_reason: isAnomaly ? getAnomalyReason(sensorType, value) : undefined,
          is_stale: false,
        })
        vals.push(value)
      }
      valuesByKey.set(key, vals)
    }
  }

  const stats: Record<string, AnalysisStats> = {}

  for (const [key, vals] of valuesByKey) {
    if (!vals.length) continue
    const s = computeStats(vals)
    const baselineVal = BASELINE_VALUES[params.sensorTypes.find((st) => key.includes(st))!]
    if (baselineVal !== undefined) {
      const pctAbove = parseFloat((((s.average - baselineVal) / baselineVal) * 100).toFixed(1))
      s.compared_to_baseline = { pct_above: pctAbove, baseline_value: baselineVal }
    }
    stats[key] = s
  }

  return { readings, stats }
}

/* ─────────────────────────────────────────────
   Station & User Management — types & mock data
   ───────────────────────────────────────────── */

export type ConnectivityType = 'gsm' | 'lora' | 'wifi'

export type UserRole = 'admin' | 'analyst' | 'technician' | 'public_viewer'

export interface StationManagementData {
  id: number
  name: string
  station_code: string
  location: string
  latitude: number
  longitude: number
  status: StationStatus
  connectivity: ConnectivityType
  expected_interval_minutes: number
  sensors: string[]
  notes: string
  sim_id: number | null
  created_at: string
  is_active: boolean
}

export interface SimAccount {
  id: number
  carrier: string
  iccid: string
  phone_number: string
  bundle_size_mb: number
  usage_mb: number
  expiry_date: string
  status: 'active' | 'inactive'
  station_id: number | null
}

export interface UserAccount {
  id: number
  name: string
  email: string
  role: UserRole
  status: 'active' | 'invited' | 'disabled'
  last_login: string | null
  created_at: string
}

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  analyst: 'Analyst',
  technician: 'Technician',
  public_viewer: 'Public Viewer',
}

export const CONNECTIVITY_LABELS: Record<ConnectivityType, string> = {
  gsm: 'GSM',
  lora: 'LoRa',
  wifi: 'Wi-Fi',
}

const SENSOR_OPTIONS = ['temperature', 'humidity', 'rainfall', 'wind_speed', 'pressure', 'solar_radiation']

/* ── In-memory mock database ── */

let nextStationId = 100
let nextSimId = 50
let nextUserId = 20

const MOCK_STATIONS: StationManagementData[] = STATION_DEFS.map((s, i) => ({
  id: s.id,
  name: s.name,
  station_code: s.station_code,
  location: s.location,
  latitude: s.latitude,
  longitude: s.longitude,
  status: s.status,
  connectivity: (['gsm', 'lora', 'wifi'] as ConnectivityType[])[i % 3],
  expected_interval_minutes: s.interval,
  sensors: SENSOR_OPTIONS.slice(0, 3 + (i % 3)),
  notes: i === 2 ? 'Solar panel replaced March 2026. New charge controller installed.' : '',
  sim_id: i < 7 ? i + 1 : null,
  created_at: new Date(Date.now() - (30 + i * 45) * 24 * 60 * 60 * 1000).toISOString(),
  is_active: i !== 8,
}))

const MOCK_SIMS: SimAccount[] = [
  { id: 1, carrier: 'Airtel', iccid: '891234000000000001', phone_number: '+256700100001', bundle_size_mb: 500, usage_mb: 320, expiry_date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10), status: 'active', station_id: 1 },
  { id: 2, carrier: 'MTN', iccid: '891234000000000002', phone_number: '+256700100002', bundle_size_mb: 1000, usage_mb: 540, expiry_date: new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10), status: 'active', station_id: 2 },
  { id: 3, carrier: 'Airtel', iccid: '891234000000000003', phone_number: '+256700100003', bundle_size_mb: 500, usage_mb: 480, expiry_date: new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10), status: 'inactive', station_id: 3 },
  { id: 4, carrier: 'Africell', iccid: '891234000000000004', phone_number: '+256700100004', bundle_size_mb: 2000, usage_mb: 210, expiry_date: new Date(Date.now() + 120 * 86400000).toISOString().slice(0, 10), status: 'active', station_id: 4 },
  { id: 5, carrier: 'MTN', iccid: '891234000000000005', phone_number: '+256700100005', bundle_size_mb: 500, usage_mb: 500, expiry_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10), status: 'active', station_id: 5 },
  { id: 6, carrier: 'Airtel', iccid: '891234000000000006', phone_number: '+256700100006', bundle_size_mb: 1000, usage_mb: 60, expiry_date: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10), status: 'active', station_id: 6 },
  { id: 7, carrier: 'Africell', iccid: '891234000000000007', phone_number: '+256700100007', bundle_size_mb: 500, usage_mb: 0, expiry_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10), status: 'active', station_id: 7 },
  { id: 8, carrier: 'MTN', iccid: '891234000000000008', phone_number: '+256700100008', bundle_size_mb: 2000, usage_mb: 1500, expiry_date: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10), status: 'active', station_id: null },
]

const MOCK_USERS: UserAccount[] = [
  { id: 1, name: 'Sarah Kintu', email: 'sarah@awsmonitor.ug', role: 'admin', status: 'active', last_login: new Date(Date.now() - 15 * 60000).toISOString(), created_at: new Date(Date.now() - 300 * 86400000).toISOString() },
  { id: 2, name: 'James Opondo', email: 'james@awsmonitor.ug', role: 'analyst', status: 'active', last_login: new Date(Date.now() - 2 * 3600000).toISOString(), created_at: new Date(Date.now() - 200 * 86400000).toISOString() },
  { id: 3, name: 'Grace Nabatanzi', email: 'grace@awsmonitor.ug', role: 'technician', status: 'active', last_login: new Date(Date.now() - 24 * 3600000).toISOString(), created_at: new Date(Date.now() - 150 * 86400000).toISOString() },
  { id: 4, name: 'Peter Mukasa', email: 'peter@awsmonitor.ug', role: 'technician', status: 'active', last_login: new Date(Date.now() - 3 * 86400000).toISOString(), created_at: new Date(Date.now() - 100 * 86400000).toISOString() },
  { id: 5, name: 'Alice Akello', email: 'alice@awsmonitor.ug', role: 'public_viewer', status: 'active', last_login: new Date(Date.now() - 7 * 86400000).toISOString(), created_at: new Date(Date.now() - 60 * 86400000).toISOString() },
  { id: 6, name: 'Robert Ssempijja', email: 'robert@awsmonitor.ug', role: 'analyst', status: 'invited', last_login: null, created_at: new Date(Date.now() - 2 * 86400000).toISOString() },
]

/* ── Station CRUD ── */

export async function fetchStations(): Promise<StationManagementData[]> {
  await new Promise((r) => setTimeout(r, 300 + Math.random() * 200))
  return MOCK_STATIONS.filter((s) => s.is_active)
}

export async function fetchAllStations(): Promise<StationManagementData[]> {
  await new Promise((r) => setTimeout(r, 200))
  return [...MOCK_STATIONS]
}

export async function createStation(data: Partial<StationManagementData>): Promise<StationManagementData> {
  await new Promise((r) => setTimeout(r, 400 + Math.random() * 200))
  const station: StationManagementData = {
    id: nextStationId++,
    name: data.name ?? 'New Station',
    station_code: data.station_code ?? `AWS-${String(nextStationId).padStart(3, '0')}`,
    location: data.location ?? '',
    latitude: data.latitude ?? 1.5,
    longitude: data.longitude ?? 32.5,
    status: 'online',
    connectivity: data.connectivity ?? 'gsm',
    expected_interval_minutes: data.expected_interval_minutes ?? 15,
    sensors: data.sensors ?? [],
    notes: data.notes ?? '',
    sim_id: data.sim_id ?? null,
    created_at: new Date().toISOString(),
    is_active: true,
  }
  MOCK_STATIONS.push(station)
  return station
}

export async function updateStation(id: number, data: Partial<StationManagementData>): Promise<StationManagementData> {
  await new Promise((r) => setTimeout(r, 300 + Math.random() * 200))
  const idx = MOCK_STATIONS.findIndex((s) => s.id === id)
  if (idx === -1) throw new Error('Station not found')
  MOCK_STATIONS[idx] = { ...MOCK_STATIONS[idx], ...data }
  return MOCK_STATIONS[idx]
}

export async function decommissionStation(id: number): Promise<void> {
  await new Promise((r) => setTimeout(r, 200))
  const idx = MOCK_STATIONS.findIndex((s) => s.id === id)
  if (idx === -1) throw new Error('Station not found')
  MOCK_STATIONS[idx].is_active = false
  MOCK_STATIONS[idx].status = 'offline'
}

export async function deleteStation(id: number): Promise<void> {
  await new Promise((r) => setTimeout(r, 300))
  const idx = MOCK_STATIONS.findIndex((s) => s.id === id)
  if (idx === -1) throw new Error('Station not found')
  MOCK_STATIONS.splice(idx, 1)
}

/* ── SIM CRUD ── */

export async function fetchSimAccounts(): Promise<SimAccount[]> {
  await new Promise((r) => setTimeout(r, 200))
  return [...MOCK_SIMS]
}

export async function createSimAccount(data: Partial<SimAccount>): Promise<SimAccount> {
  await new Promise((r) => setTimeout(r, 300))
  const sim: SimAccount = {
    id: nextSimId++,
    carrier: data.carrier ?? '',
    iccid: data.iccid ?? '',
    phone_number: data.phone_number ?? '',
    bundle_size_mb: data.bundle_size_mb ?? 500,
    usage_mb: 0,
    expiry_date: data.expiry_date ?? '',
    status: 'active',
    station_id: null,
  }
  MOCK_SIMS.push(sim)
  return sim
}

export async function assignSimToStation(simId: number, stationId: number): Promise<void> {
  await new Promise((r) => setTimeout(r, 200))
  const sim = MOCK_SIMS.find((s) => s.id === simId)
  if (!sim) throw new Error('SIM not found')
  const prev = MOCK_SIMS.find((s) => s.station_id === stationId)
  if (prev) prev.station_id = null
  sim.station_id = stationId
  const station = MOCK_STATIONS.find((s) => s.id === stationId)
  if (station) station.sim_id = simId
}

export async function unassignSimFromStation(simId: number): Promise<void> {
  await new Promise((r) => setTimeout(r, 200))
  const sim = MOCK_SIMS.find((s) => s.id === simId)
  if (!sim) throw new Error('SIM not found')
  const station = MOCK_STATIONS.find((s) => s.sim_id === simId)
  if (station) station.sim_id = null
  sim.station_id = null
}

/* ── User CRUD ── */

export async function fetchUsers(): Promise<UserAccount[]> {
  await new Promise((r) => setTimeout(r, 300 + Math.random() * 200))
  return [...MOCK_USERS]
}

export async function createUser(data: Partial<UserAccount>): Promise<UserAccount> {
  await new Promise((r) => setTimeout(r, 300 + Math.random() * 200))
  const user: UserAccount = {
    id: nextUserId++,
    name: data.name ?? '',
    email: data.email ?? '',
    role: data.role ?? 'analyst',
    status: 'invited',
    last_login: null,
    created_at: new Date().toISOString(),
  }
  MOCK_USERS.push(user)
  return user
}

export async function updateUser(id: number, data: Partial<UserAccount>): Promise<UserAccount> {
  await new Promise((r) => setTimeout(r, 300))
  const idx = MOCK_USERS.findIndex((u) => u.id === id)
  if (idx === -1) throw new Error('User not found')
  MOCK_USERS[idx] = { ...MOCK_USERS[idx], ...data }
  return MOCK_USERS[idx]
}

export async function disableUser(id: number): Promise<void> {
  await new Promise((r) => setTimeout(r, 200))
  const idx = MOCK_USERS.findIndex((u) => u.id === id)
  if (idx === -1) throw new Error('User not found')
  MOCK_USERS[idx].status = 'disabled'
}

export async function deleteUser(id: number): Promise<void> {
  await new Promise((r) => setTimeout(r, 200))
  const idx = MOCK_USERS.findIndex((u) => u.id === id)
  if (idx === -1) throw new Error('User not found')
  MOCK_USERS.splice(idx, 1)
}

/* ─────────────────────────────────────────────
   SIM Management — types & mock data
   ───────────────────────────────────────────── */

export interface TopUpRecord {
  id: number
  sim_id: number
  amount_mb: number
  added_by: string
  note: string
  created_at: string
  new_total_mb: number
}

export interface DailyUsage {
  date: string
  usage_mb: number
}

export interface SimManagementData {
  sim: SimAccount
  station_name: string | null
  station_id: number | null
  estimated_days_remaining: number | null
  projected_expiry_date: string | null
  forecast_confidence_note: string
  daily_usage: DailyUsage[]
  top_up_history: TopUpRecord[]
}

export interface SimFleetSummary {
  total_active: number
  expiring_soon_count: number
  expiring_soon_threshold_days: number
  expired_count: number
  total_remaining_mb: number
}

/* ── In-memory mock SIM management data ── */

let nextTopUpId = 100

const SIM_USERS = ['Sarah Kintu', 'James Opondo', 'Grace Nabatanzi']

function generateDailyUsage(baseDailyMb: number, days: number): DailyUsage[] {
  const now = Date.now()
  const result: DailyUsage[] = []
  for (let i = days; i >= 1; i--) {
    const date = new Date(now - i * 86400000).toISOString().slice(0, 10)
    const jitter = (Math.random() - 0.3) * baseDailyMb * 0.6
    const spike = Math.random() < 0.08 ? baseDailyMb * (1 + Math.random() * 2) : 0
    result.push({ date, usage_mb: parseFloat((baseDailyMb + jitter + spike).toFixed(2)) })
  }
  return result
}

function generateTopUpHistory(simId: number, bundleSize: number, totalTopUps: number): TopUpRecord[] {
  const history: TopUpRecord[] = []
  let runningTotal = bundleSize
  for (let i = 0; i < totalTopUps; i++) {
    const amount = 200 + Math.round(Math.random() * 800)
    runningTotal += amount
    history.push({
      id: nextTopUpId++,
      sim_id: simId,
      amount_mb: amount,
      added_by: SIM_USERS[i % SIM_USERS.length],
      note: i === 0 ? 'Monthly top-up' : 'Emergency top-up — low balance',
      created_at: new Date(Date.now() - (totalTopUps - i) * 25 * 86400000).toISOString(),
      new_total_mb: runningTotal,
    })
  }
  return history
}

function calcDaysRemaining(sim: SimAccount): number | null {
  if (sim.bundle_size_mb <= 0 || sim.status !== 'active') return null
  const remaining = sim.bundle_size_mb - sim.usage_mb
  if (remaining <= 0) return 0
  const dailyUsage = sim.usage_mb / 30
  if (dailyUsage <= 0) return null
  return Math.round(remaining / dailyUsage)
}

/* ── Lazy-init cache (module-level, survives within-session refreshes) ── */

let cachedSimMgmt: SimManagementData[] | null = null

function buildSimManagementData(): SimManagementData[] {
  return MOCK_SIMS.map((sim) => {
    const station = MOCK_STATIONS.find((s) => s.sim_id === sim.id)
    const baseDaily = sim.usage_mb > 0 ? sim.usage_mb / 30 : 5
    const days = sim.status === 'active' ? calcDaysRemaining(sim) : null
    const remaining = sim.bundle_size_mb - sim.usage_mb
    let projectedDate: string | null = null
    if (days !== null && days > 0 && remaining > 0) {
      projectedDate = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)
    }

    const confidenceNote =
      days === null
        ? 'Insufficient usage data to project depletion'
        : remaining <= 0
          ? 'Bundle is exhausted'
          : days <= 7
            ? 'Based on the last 7 days of usage — high confidence (near-term)'
            : 'Based on the last 30 days of usage — estimate may shift with seasonal changes'

    return {
      sim,
      station_name: station?.name ?? null,
      station_id: station?.id ?? null,
      estimated_days_remaining: days,
      projected_expiry_date: projectedDate,
      forecast_confidence_note: confidenceNote,
      daily_usage: generateDailyUsage(baseDaily, 60),
      top_up_history: generateTopUpHistory(sim.id, sim.bundle_size_mb, Math.floor(Math.random() * 4)),
    }
  })
}

function getSimManagementData(): SimManagementData[] {
  if (!cachedSimMgmt) cachedSimMgmt = buildSimManagementData()
  return cachedSimMgmt
}

const EXPIRING_SOON_THRESHOLD_DAYS = 7

/* ── Public API ── */

export async function fetchSimManagementData(): Promise<{
  sims: SimManagementData[]
  summary: SimFleetSummary
}> {
  await new Promise((r) => setTimeout(r, 250 + Math.random() * 150))
  const list = getSimManagementData()

  const active = list.filter((s) => s.sim.status === 'active')
  const totalActive = active.length
  const totalRemaining = active.reduce((sum, s) => sum + Math.max(0, s.sim.bundle_size_mb - s.sim.usage_mb), 0)
  const expiringSoon = active.filter(
    (s) => s.estimated_days_remaining !== null && s.estimated_days_remaining <= EXPIRING_SOON_THRESHOLD_DAYS && s.estimated_days_remaining >= 0,
  )
  const expired = list.filter(
    (s) =>
      s.estimated_days_remaining === 0 ||
      (s.sim.expiry_date && new Date(s.sim.expiry_date) < new Date()),
  )

  return {
    sims: list,
    summary: {
      total_active: totalActive,
      expiring_soon_count: expiringSoon.length,
      expiring_soon_threshold_days: EXPIRING_SOON_THRESHOLD_DAYS,
      expired_count: expired.length,
      total_remaining_mb: totalRemaining,
    },
  }
}

export async function topUpSim(
  simId: number,
  amountMb: number,
  note: string,
): Promise<SimManagementData> {
  await new Promise((r) => setTimeout(r, 400 + Math.random() * 200))

  const data = getSimManagementData()
  const entry = data.find((d) => d.sim.id === simId)
  if (!entry) throw new Error('SIM not found')
  if (entry.sim.status !== 'active') throw new Error('Cannot top up an inactive SIM')

  /* Update in-memory SIM account */
  const mockSim = MOCK_SIMS.find((s) => s.id === simId)
  if (mockSim) {
    mockSim.bundle_size_mb += amountMb
  }

  entry.sim.bundle_size_mb += amountMb
  const remaining = entry.sim.bundle_size_mb - entry.sim.usage_mb
  const newDays = remaining > 0
    ? Math.round(remaining / Math.max(1, entry.sim.usage_mb / 30))
    : 0

  const topUp: TopUpRecord = {
    id: nextTopUpId++,
    sim_id: simId,
    amount_mb: amountMb,
    added_by: 'Sarah Kintu',
    note,
    created_at: new Date().toISOString(),
    new_total_mb: entry.sim.bundle_size_mb,
  }

  entry.top_up_history = [...entry.top_up_history, topUp]
  entry.estimated_days_remaining = newDays
  entry.projected_expiry_date = newDays > 0
    ? new Date(Date.now() + newDays * 86400000).toISOString().slice(0, 10)
    : null

  return entry
}
