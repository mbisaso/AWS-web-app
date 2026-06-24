export type StationOperationalStatus = 'full' | 'partial' | 'down'

export interface StationSummary {
  id: number
  stationId: string
  name: string
  expectedIntervalMinutes: number
  status: StationOperationalStatus
  lastUpdated: string
}

export interface StationStatus {
  status: StationOperationalStatus
  last_updated: string
  computed_by: string
  details: Record<string, unknown>
}

export interface Station {
  id: number
  station_id: string
  name: string
  location: string
  latitude: number | null
  longitude: number | null
  expected_interval_minutes: number
  status: StationStatus | null
}

// Full reading - used for history/detail views
export interface SensorReading {
  id: number
  station_code: string
  timestamp: string
  received_at: string
  pressure: number | null
  altitude: number | null
  temperature: number | null
  humidity: number | null
  light: number | null
  soil_moisture: number | null
  rain: number | null
  wind_speed: number | null
  wind_direction: number | null
  volt_3v3: number | null
  volt_5v: number | null
  volt_batt: number | null
  volt_solar: number | null
  volt_dc: number | null
  curr_batt: number | null
  curr_solar: number | null
}

// Compact reading - dashboard "current conditions" panel
export interface SensorReadingLatest {
  station_code: string
  timestamp: string
  received_at: string
  temperature: number | null
  humidity: number | null
  pressure: number | null
  wind_speed: number | null
  wind_direction: number | null
  rain: number | null
  light: number | null
  soil_moisture: number | null
  volt_batt: number | null
  volt_solar: number | null
  curr_batt: number | null
  curr_solar: number | null
}

// Weather chart - time series, no power fields
export interface SensorReadingChart {
  timestamp: string
  temperature: number | null
  humidity: number | null
  pressure: number | null
  wind_speed: number | null
  wind_direction: number | null
  rain: number | null
  light: number | null
  soil_moisture: number | null
}

// Power chart - time series, power fields only
export interface PowerChart {
  timestamp: string
  volt_3v3: number | null
  volt_5v: number | null
  volt_batt: number | null
  volt_solar: number | null
  volt_dc: number | null
  curr_batt: number | null
  curr_solar: number | null
}

// Every endpoint wraps its payload like this
export interface ApiEnvelope<T> {
  success: boolean
  message: string
  data: T
}

export type UserRole = 'admin' | 'meteorologist' | 'viewer' | 'farmer'

export interface LoginResult {
  access: string
  refresh: string
  username: string
  role: UserRole
}

export type PowerMetricKey =
  | 'volt_3v3'
  | 'volt_5v'
  | 'volt_batt'
  | 'volt_solar'
  | 'volt_dc'
  | 'curr_batt'
  | 'curr_solar'

export const POWER_METRIC_CONFIG: Record<PowerMetricKey, { label: string; unit: string; color: string }> = {
  volt_batt:  { label: 'Battery Voltage', unit: 'V', color: '#0EA5E9' },
  volt_solar: { label: 'Solar Voltage',   unit: 'V', color: '#F59E0B' },
  volt_3v3:   { label: '3.3V Rail',       unit: 'V', color: '#22C55E' },
  volt_5v:    { label: '5V Rail',         unit: 'V', color: '#8B5CF6' },
  volt_dc:    { label: 'DC Voltage',      unit: 'V', color: '#94A3B8' },
  curr_batt:  { label: 'Battery Current', unit: 'A', color: '#F97316' },
  curr_solar: { label: 'Solar Current',   unit: 'A', color: '#EAB308' },
}