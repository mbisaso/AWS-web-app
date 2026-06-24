import type { SensorMetricKey, Station } from '../../types'
import { SENSOR_METRIC_CONFIG } from '../../types'
import { DateRangePicker } from '../shared/DateRangePicker'

const SENSOR_METRICS = Object.keys(SENSOR_METRIC_CONFIG) as SensorMetricKey[]

interface StationSensorSelectorProps {
  stations: Station[]
  selectedStationId: string | null
  onStationChange: (id: string | null) => void
  selectedMetric: SensorMetricKey
  onMetricChange: (metric: SensorMetricKey) => void
  dateFrom: string
  dateTo: string
  onDateChange: (from: string, to: string) => void
}

export function StationSensorSelector({
  stations,
  selectedStationId,
  onStationChange,
  selectedMetric,
  onMetricChange,
  dateFrom,
  dateTo,
  onDateChange,
}: StationSensorSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="min-w-0 sm:w-56">
          <label htmlFor="weather-station-select" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-storm/40">
            Station
          </label>
          <select
            id="weather-station-select"
            value={selectedStationId ?? ''}
            onChange={(e) => onStationChange(e.target.value || null)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-midnight transition-colors focus:border-sky-200 focus:ring-2 focus:ring-sky-soft focus:outline-none"
          >
            <option value="" disabled>— Select a station —</option>
            {stations.map((s) => (
              <option key={s.station_id} value={s.station_id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <DateRangePicker
          dateFrom={dateFrom}
          dateTo={dateTo}
          onChange={onDateChange}
        />
      </div>

      <div className="flex flex-wrap gap-1" role="tablist" aria-label="Sensor type">
        {SENSOR_METRICS.map((metric) => {
          const cfg = SENSOR_METRIC_CONFIG[metric]
          const isActive = selectedMetric === metric
          return (
            <button
              key={metric}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onMetricChange(metric)}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                isActive
                  ? 'bg-midnight text-white shadow-xs'
                  : 'bg-white text-storm/60 hover:bg-slate-100 hover:text-storm border border-slate-200'
              }`}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: cfg.color }}
                aria-hidden="true"
              />
              {cfg.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
