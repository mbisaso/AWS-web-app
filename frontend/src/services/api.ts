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
  message: string
  timestamp: string
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

const ALERT_DEFS: Omit<Alert, 'id'>[] = [
  {
    type: 'station_offline',
    severity: 'critical',
    station_name: 'AWS-027 · Karamoja Basin',
    message: 'No transmission received for over 3 hours. Battery may be depleted.',
    timestamp: minutesAgo(12),
  },
  {
    type: 'sensor_anomaly',
    severity: 'warning',
    station_name: 'AWS-014 · Lake Victoria East',
    message: 'Humidity sensor reporting erratic values (78% → 94% in 5 minutes).',
    timestamp: minutesAgo(28),
  },
  {
    type: 'sim_expiring',
    severity: 'warning',
    station_name: 'AWS-035 · Moroto Drylands',
    message: 'GSM SIM card expires in 14 days. Please arrange replacement.',
    timestamp: minutesAgo(55),
  },
  {
    type: 'low_battery',
    severity: 'warning',
    station_name: 'AWS-022 · Gulu Savannah',
    message: 'Battery voltage at 11.8V — below nominal operating range (12.0–14.2V).',
    timestamp: minutesAgo(104),
  },
  {
    type: 'threshold_breach',
    severity: 'info',
    station_name: 'AWS-019 · Kasese Highlands',
    message: 'Rainfall exceeded 24h threshold: 48.2mm recorded (limit: 40mm).',
    timestamp: minutesAgo(185),
  },
  {
    type: 'station_offline',
    severity: 'critical',
    station_name: 'AWS-035 · Moroto Drylands',
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
