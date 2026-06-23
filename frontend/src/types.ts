export type StationOperationalStatus = 'full' | 'partial' | 'down'

export interface Station {
  id: number
  stationId: string
  name: string
  latitude?: number
  longitude?: number
  expectedIntervalMinutes: number
}

export interface StationSummary extends Station {
  status: StationOperationalStatus
  lastUpdated: string
}

// TODO: confirm these field names against the real SensorReading model
// (audit says 17+ fields — temp, humidity, pressure, wind, voltage rails, current)
export interface SensorReading {
  id: number
  stationCode: string
  timestamp: string
  temperature?: number | null
  humidity?: number | null
  pressure?: number | null
  windSpeed?: number | null
  batteryVoltage?: number | null
  panelVoltage?: number | null
  current?: number | null
}

export type UserRole = 'admin' | 'meteorologist' | 'viewer' | 'farmer'