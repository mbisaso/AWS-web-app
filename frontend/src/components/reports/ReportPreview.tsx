import type { ReportConfig } from '../../services/api'
import { REPORT_TYPE_LABELS } from '../../services/api'

interface ReportPreviewProps {
  config: ReportConfig
  stationNames: string
}

export function ReportPreview({ config, stationNames }: ReportPreviewProps) {
  const csvDisabledSections = config.format === 'csv'
    ? ['station_locations', 'weather_chart_temperature', 'weather_chart_rainfall', 'power_chart', 'weather_chart'].filter((id) => config.metrics.includes(id))
    : []

  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-soft/30 p-5 shadow-xs">
      <div className="flex items-center gap-2 mb-3">
        <svg className="h-4 w-4 text-sky-deep" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
          <path d="M12 18v-6" />
          <path d="M9 15l3-3 3 3" />
        </svg>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-deep">
          Report preview
        </p>
      </div>

      <div className="space-y-2 text-sm">
        <Row label="Report type" value={REPORT_TYPE_LABELS[config.type]} />
        <Row label="Format" value={config.format.toUpperCase()} />
        <Row label="Stations" value={stationNames} />
        <Row label="Date range" value={`${config.date_from} → ${config.date_to}`} />
        <Row
          label="Sections"
          value={`${config.metrics.length} section${config.metrics.length !== 1 ? 's' : ''} selected`}
        />
      </div>

      {csvDisabledSections.length > 0 && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-[11px] font-medium text-amber-700">
            {csvDisabledSections.length} section{csvDisabledSections.length !== 1 ? 's' : ''} not available in CSV format{csvDisabledSections.length === 1 ? ' (chart/visual only)' : ' (charts/visual only)'} and will be omitted.
          </p>
        </div>
      )}

      {config.date_from >= config.date_to && (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3">
          <p className="text-[11px] font-medium text-rose-700">
            The date range may contain no data — consider selecting a wider range.
          </p>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-storm/40 w-20">
        {label}
      </span>
      <span className="text-xs text-midnight">{value}</span>
    </div>
  )
}
