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
