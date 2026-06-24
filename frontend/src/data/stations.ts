import type { StationSummary } from '../types'

export const mockStationSummaries: StationSummary[] = [
  { id: 1, stationId: 'AWS-001', name: 'Rukungiri Ridge', expectedIntervalMinutes: 15, status: 'full', lastUpdated: '2 min ago' },
  { id: 14, stationId: 'AWS-014', name: 'Lake Victoria East', expectedIntervalMinutes: 15, status: 'partial', lastUpdated: '11 min ago' },
  { id: 27, stationId: 'AWS-027', name: 'Karamoja Basin', expectedIntervalMinutes: 30, status: 'down', lastUpdated: '42 min ago' },
  { id: 31, stationId: 'AWS-031', name: 'Mount Elgon Gate', expectedIntervalMinutes: 15, status: 'full', lastUpdated: '5 min ago' },
]