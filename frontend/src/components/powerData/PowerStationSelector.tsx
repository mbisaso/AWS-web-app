import type { PowerMetricType, StationReading } from '../../services/api'
import { POWER_METRIC_CONFIG } from '../../services/api'
import { StationDropdown } from '../shared/StationDropdown'
import { DateRangePicker } from '../shared/DateRangePicker'

const POWER_METRICS = Object.keys(POWER_METRIC_CONFIG) as PowerMetricType[]

interface PowerStationSelectorProps {
  stations: StationReading[]
  selectedStationId: number | null
  onStationChange: (id: number | null) => void
  selectedMetric: PowerMetricType
  onMetricChange: (metric: PowerMetricType) => void
  dateFrom: string
  dateTo: string
  onDateChange: (from: string, to: string) => void
}

export function PowerStationSelector({
  stations,
  selectedStationId,
  onStationChange,
  selectedMetric,
  onMetricChange,
  dateFrom,
  dateTo,
  onDateChange,
}: PowerStationSelectorProps) {
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

      <div className="flex flex-wrap gap-1" role="tablist" aria-label="Power metric">
        {POWER_METRICS.map((metric) => {
          const cfg = POWER_METRIC_CONFIG[metric]
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
