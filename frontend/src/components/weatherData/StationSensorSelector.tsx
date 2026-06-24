import type { SensorType, StationReading } from '../../services/api'
import { SENSOR_CONFIG } from '../../services/api'
import { DateRangePicker } from '../shared/DateRangePicker'

const SENSOR_TYPES = Object.keys(SENSOR_CONFIG) as SensorType[]

interface StationSensorSelectorProps {
  stations: StationReading[]
  selectedStationId: number | null
  onStationChange: (id: number | null) => void
  selectedSensor: SensorType
  onSensorChange: (sensor: SensorType) => void
  dateFrom: string
  dateTo: string
  onDateChange: (from: string, to: string) => void
}

export function StationSensorSelector({
  stations,
  selectedStationId,
  onStationChange,
  selectedSensor,
  onSensorChange,
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
            onChange={(e) => onStationChange(e.target.value ? Number(e.target.value) : null)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-midnight transition-colors focus:border-sky-200 focus:ring-2 focus:ring-sky-soft focus:outline-none"
          >
            <option value="">All stations</option>
            {stations.map((s) => (
              <option key={s.id} value={s.id}>
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
        {SENSOR_TYPES.map((type) => {
          const cfg = SENSOR_CONFIG[type]
          const isActive = selectedSensor === type
          return (
            <button
              key={type}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSensorChange(type)}
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
