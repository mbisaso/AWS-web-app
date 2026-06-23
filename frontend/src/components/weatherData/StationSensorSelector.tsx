import type { SensorType, StationReading } from '../../services/api'
import { SENSOR_CONFIG } from '../../services/api'
import { StationDropdown } from '../shared/StationDropdown'
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
        <StationDropdown
          stations={stations}
          selectedStationId={selectedStationId}
          onChange={onStationChange}
        />
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
