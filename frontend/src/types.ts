export type StationOperationalStatus = 'full' | 'partial' | 'down'

export interface StationSummary {
  id: number
  stationId: string
  name: string
  expectedIntervalMinutes: number
  status: StationOperationalStatus
  lastUpdated: string
}

// One sensor's verdict from the sensor-fault model.
//   flag   0 = OK, 1 = faulty
//   reason 'ok' | 'anomaly' | 'stuck' | 'rain_rate' (and spike/drift/jitter in tests)
//   score  margin past the sensor's threshold (null for rule-based verdicts)
export interface SensorVerdict {
  flag: 0 | 1
  score: number | null
  reason: string
}

export interface StationHealthDetails {
  last_reading_id?: number
  as_of?: string | null
  faulty_sensors?: string[]
  sensors?: Record<string, SensorVerdict>
}

export interface StationStatus {
  status: StationOperationalStatus
  last_updated: string
  computed_by: string
  details: StationHealthDetails
}

export interface Station {
  id: number
  station_id: string
  name: string
  location: string
  latitude: number | null
  longitude: number | null
  expected_interval_minutes: number
  phone_number: string
  sensors: string[]
  notes: string
  created_at: string
  status: StationStatus | null
}

export interface StationDetailResponse {
  station: Station
  latest_reading: SensorReadingLatest | null
}

// Full reading - used for history/detail views
export interface SensorReading {
  id: number
  station_code: string
  timestamp: string
  received_at: string
  pressure: number | null
  temperature: number | null
  humidity: number | null
  solar_radiation: number | null
  soil_moisture: number | null
  rain: number | null
  wind_speed: number | null
  wind_direction: number | null
  volt_batt: number | null
  volt_solar: number | null
  battery_temp: number | null
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
  solar_radiation: number | null
  soil_moisture: number | null
  volt_batt: number | null
  volt_solar: number | null
  curr_batt: number | null
  curr_solar: number | null
}

// Weather chart - time series
export interface SensorReadingChart {
  timestamp: string
  temperature: number | null
  humidity: number | null
  pressure: number | null
  wind_speed: number | null
  wind_direction: number | null
  rain: number | null
  solar_radiation: number | null
  soil_moisture: number | null
  volt_batt: number | null
  volt_solar: number | null
  battery_temp: number | null
  curr_batt: number | null
  curr_solar: number | null
  pv: number | null
}

// Power chart - time series, power fields only
export interface PowerChart {
  timestamp: string
  volt_batt: number | null
  volt_solar: number | null
  battery_temp: number | null
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

export type SensorMetricKey =
  | 'temperature'
  | 'humidity'
  | 'pressure'
  | 'wind_speed'
  | 'wind_direction'
  | 'rain'
  | 'solar_radiation'
  | 'soil_moisture'

export const SENSOR_METRIC_CONFIG: Record<SensorMetricKey, { label: string; unit: string; color: string }> = {
  temperature:     { label: 'Temperature',     unit: '°C',   color: '#F97316' },
  humidity:        { label: 'Humidity',        unit: '%',    color: '#0EA5E9' },
  pressure:        { label: 'Atm. Pressure',   unit: 'hPa',  color: '#8B5CF6' },
  wind_speed:      { label: 'Wind Speed',      unit: 'm/s',  color: '#22C55E' },
  wind_direction:  { label: 'Wind Direction',  unit: '°',    color: '#94A3B8' },
  rain:            { label: 'Rainfall',        unit: 'mm',   color: '#38BDF8' },
  solar_radiation: { label: 'Solar Radiation', unit: 'W/m²', color: '#F59E0B' },
  soil_moisture:   { label: 'Soil Moisture',   unit: '%',    color: '#84CC16' },
}

export type PowerMetricKey =
  | 'volt_batt'
  | 'volt_solar'
  | 'battery_temp'
  | 'curr_batt'
  | 'curr_solar'

export const POWER_METRIC_CONFIG: Record<PowerMetricKey, { label: string; unit: string; color: string }> = {
  volt_batt:    { label: 'Battery Voltage', unit: 'V',  color: '#0EA5E9' },
  volt_solar:   { label: 'Solar Voltage',   unit: 'V',  color: '#F59E0B' },
  battery_temp: { label: 'Battery Temp',    unit: '°C', color: '#EF4444' },
  curr_batt:    { label: 'Battery Current', unit: 'A',  color: '#F97316' },
  curr_solar:   { label: 'Solar Current',   unit: 'A',  color: '#EAB308' },
}

export type AnalysisMetricKey = SensorMetricKey | PowerMetricKey | 'pv'

export const ANALYSIS_METRIC_CONFIG: Record<AnalysisMetricKey, { label: string; unit: string; color: string }> = {
  ...SENSOR_METRIC_CONFIG,
  ...POWER_METRIC_CONFIG,
  volt_solar: { label: 'Vpv (Solar Voltage)', unit: 'V', color: '#F59E0B' },
  curr_solar: { label: 'Iv (Solar Current)',  unit: 'A', color: '#EAB308' },
  pv:         { label: 'Pv (Solar Power)',    unit: 'W', color: '#EF4444' },
}

export interface TaggedSensorReading extends SensorReadingChart {
  stationId: string
  stationName: string
}

export interface MetricReading {
  station_id: string
  station_name: string
  timestamp: string
  value: number
}

export interface StatsResult {
  average: number
  min: number
  max: number
  std_dev: number
  count: number
  trend: 'rising' | 'falling' | 'stable'
  percent_change: number | null
  sparkline: number[]
}

// Benchmarking — AWS station readings vs UNMA reference data
export interface BenchmarkReading {
  timestamp: string
  value: number
  source: string
}

export interface AwsReading {
  timestamp: string
  value: number
}

export interface BenchmarkStats {
  aws_avg: number | null
  aws_min: number | null
  aws_max: number | null
  benchmark_avg: number | null
  benchmark_min: number | null
  benchmark_max: number | null
  mean_absolute_error: number | null
  correlation: number | null
}

export interface BenchmarkData {
  station_id: string
  hours: number
  metric: string
  aws_readings: AwsReading[]
  benchmark_readings: BenchmarkReading[]
  stats: BenchmarkStats
}