import type { Station, AnalysisMetricKey } from '../../types'
import { ANALYSIS_METRIC_CONFIG } from '../../types'
import { DateRangePicker } from '../shared/DateRangePicker'

type ViewMode = 'trends' | 'comparison' | 'correlation' | 'distribution'

const METRIC_KEYS = Object.keys(ANALYSIS_METRIC_CONFIG) as AnalysisMetricKey[]

const VIEW_TABS: { key: ViewMode; label: string }[] = [
  { key: 'trends', label: 'Trends' },
  { key: 'comparison', label: 'Comparison' },
  { key: 'correlation', label: 'Correlation' },
  { key: 'distribution', label: 'Distribution' },
]

interface AnalysisControlsProps {
  stations: Station[]
  selectedStationIds: string[]
  onStationIdsChange: (ids: string[]) => void
  selectedMetricKey: AnalysisMetricKey
  onMetricKeyChange: (key: AnalysisMetricKey) => void
  correlationMetricB: AnalysisMetricKey
  onCorrelationMetricBChange: (key: AnalysisMetricKey) => void
  dateFrom: string
  dateTo: string
  onDateChange: (from: string, to: string) => void
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
}

export function AnalysisControls({
  stations,
  selectedStationIds,
  onStationIdsChange,
  selectedMetricKey,
  onMetricKeyChange,
  correlationMetricB,
  onCorrelationMetricBChange,
  dateFrom,
  dateTo,
  onDateChange,
  viewMode,
  onViewModeChange,
}: AnalysisControlsProps) {
  const allSelected = selectedStationIds.length === 0

  function toggleStation(id: string) {
    if (allSelected) {
      onStationIdsChange([id])
    } else {
      const next = selectedStationIds.includes(id)
        ? selectedStationIds.filter((sid) => sid !== id)
        : [...selectedStationIds, id]
      onStationIdsChange(next.length === stations.length ? [] : next)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:flex-wrap">
        <div className="min-w-0 flex-1">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-storm/40">Station</p>
          <div
            className="flex gap-1 overflow-x-auto pb-1"
            role="tablist"
            aria-label="Select stations"
          >
            {stations.map((s) => {
              const isActive = allSelected || selectedStationIds.includes(s.station_id)
              return (
                <button
                  key={s.station_id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => toggleStation(s.station_id)}
                  className={`shrink-0 cursor-pointer rounded-xl px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-midnight text-white shadow-xs'
                      : 'bg-white text-storm/60 hover:text-storm hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {s.name}
                </button>
              )
            })}
          </div>
        </div>

        <DateRangePicker dateFrom={dateFrom} dateTo={dateTo} onChange={onDateChange} />

        <div className="sm:ml-auto">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-storm/40">View</p>
          <div className="flex gap-1" role="tablist" aria-label="Analysis view mode">
            {VIEW_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={viewMode === tab.key}
                onClick={() => onViewModeChange(tab.key)}
                className={`cursor-pointer rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
                  viewMode === tab.key
                    ? 'bg-midnight text-white shadow-xs'
                    : 'bg-white text-storm/60 hover:text-storm hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-storm/40">
          {viewMode === 'correlation' ? 'Primary metric' : 'Metric'}
        </p>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Sensor metric">
          {METRIC_KEYS.map((key) => {
            const cfg = ANALYSIS_METRIC_CONFIG[key]
            const isActive = selectedMetricKey === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => onMetricKeyChange(key)}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-midnight text-white shadow-xs'
                    : 'bg-white text-storm/60 hover:bg-slate-100 hover:text-storm border border-slate-200'
                }`}
                aria-pressed={isActive}
              >
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: cfg.color }} aria-hidden="true" />
                {cfg.label}
              </button>
            )
          })}
        </div>
      </div>

      {viewMode === 'correlation' && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-storm/40">Secondary metric</p>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Secondary sensor metric">
            {METRIC_KEYS.map((key) => {
              const cfg = ANALYSIS_METRIC_CONFIG[key]
              const isActive = correlationMetricB === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onCorrelationMetricBChange(key)}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-ocean text-white shadow-xs'
                      : 'bg-white text-storm/60 hover:bg-slate-100 hover:text-storm border border-slate-200'
                  }`}
                  aria-pressed={isActive}
                >
                  <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: cfg.color }} aria-hidden="true" />
                  {cfg.label}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
