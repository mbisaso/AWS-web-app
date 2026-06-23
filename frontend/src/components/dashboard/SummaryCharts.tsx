import { type StationReading } from '../../services/api'

interface SummaryChartsProps {
  stations: StationReading[]
  onlineCount: number
  offlineCount: number
  partialCount: number
}

export function SummaryCharts({
  stations,
  onlineCount,
  offlineCount,
  partialCount,
}: SummaryChartsProps) {
  const total = stations.length
  const hasData = total > 0

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* ── Donut: status distribution ── */}
      <section
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
        aria-label="Station status distribution"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-storm/40">
          Network health
        </p>
        <h3 className="mt-1 text-base font-semibold text-midnight font-display">
          Status distribution
        </h3>

        <div className="mt-4 flex items-center gap-6">
          {/* Donut */}
          <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
            {hasData ? (
              <svg viewBox="0 0 120 120" className="h-28 w-28 -rotate-90" role="img" aria-label={`${onlineCount} online, ${partialCount} partial, ${offlineCount} offline`}>
                {/* Background ring */}
                <circle cx="60" cy="60" r="48" fill="none" stroke="#F1F5F9" strokeWidth="10" />
                {/* Online */}
                <DonutArc
                  r={48}
                  ratio={onlineCount / total}
                  offset={0}
                  color="#22C55E"
                />
                {/* Partial */}
                <DonutArc
                  r={48}
                  ratio={partialCount / total}
                  offset={onlineCount / total}
                  color="#F59E0B"
                />
                {/* Offline */}
                <DonutArc
                  r={48}
                  ratio={offlineCount / total}
                  offset={(onlineCount + partialCount) / total}
                  color="#E11D48"
                />
              </svg>
            ) : (
              <div className="flex h-28 w-28 items-center justify-center rounded-full bg-slate-50">
                <span className="text-xs text-storm/30">No data</span>
              </div>
            )}

            {/* Center label */}
            <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
              <div className="text-center">
                <p className="text-xl font-bold text-midnight font-display">{total}</p>
                <p className="text-[10px] font-medium text-storm/40">stations</p>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="space-y-2.5">
            <LegendItem color="#22C55E" label="Online" count={onlineCount} percentage={total > 0 ? Math.round(onlineCount / total * 100) : 0} />
            <LegendItem color="#F59E0B" label="Partial" count={partialCount} percentage={total > 0 ? Math.round(partialCount / total * 100) : 0} />
            <LegendItem color="#E11D48" label="Offline" count={offlineCount} percentage={total > 0 ? Math.round(offlineCount / total * 100) : 0} />
          </div>
        </div>
      </section>

      {/* ── Temperature bar chart ── */}
      <section
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
        aria-label="Station temperature comparison"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-storm/40">
          Sensors
        </p>
        <h3 className="mt-1 text-base font-semibold text-midnight font-display">
          Temperature by station
        </h3>

        <div className="mt-4 space-y-3">
          {stations
            .filter((s) => s.temperature)
            .slice(0, 8)
            .map((station, _, arr) => {
              const maxTemp = Math.max(...arr.map((s) => s.temperature?.value ?? 0))
              const tempVal = station.temperature!.value
              const barWidth = maxTemp > 0 ? (tempVal / maxTemp) * 100 : 0
              const barColor =
                station.status === 'online'
                  ? 'bg-emerald'
                  : station.status === 'partial'
                    ? 'bg-amber'
                    : 'bg-rose'

              return (
                <div key={station.id} className="flex items-center gap-3">
                  <span className="w-28 truncate text-xs font-medium text-storm/70">
                    {station.name}
                  </span>
                  <div className="flex-1">
                    <div className="h-5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${barColor} transition-all duration-700 ease-out`}
                        style={{ width: `${barWidth}%` }}
                        role="progressbar"
                        aria-valuenow={tempVal}
                        aria-valuemin={0}
                        aria-valuemax={maxTemp}
                        aria-label={`${station.name}: ${tempVal}°C`}
                      />
                    </div>
                  </div>
                  <span className="w-14 text-right text-xs font-semibold tabular-nums text-midnight">
                    {tempVal.toFixed(1)}°C
                  </span>
                </div>
              )
            })}

          {stations.filter((s) => s.temperature).length === 0 && (
            <div className="flex flex-col items-center py-6">
              <span className="text-xs text-storm/30">No temperature data available</span>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

/* ── Sub-components ── */

function DonutArc({
  r,
  ratio,
  offset,
  color,
}: {
  r: number
  ratio: number
  offset: number
  color: string
}) {
  const circumference = 2 * Math.PI * r
  const dashLength = ratio * circumference
  const gap = circumference - dashLength
  const dashOffset = -offset * circumference

  if (ratio === 0) return null

  return (
    <circle
      cx="60"
      cy="60"
      r={r}
      fill="none"
      stroke={color}
      strokeWidth="10"
      strokeDasharray={`${Math.max(dashLength, 1)} ${Math.max(gap, 1)}`}
      strokeDashoffset={dashOffset}
      strokeLinecap="round"
      className="transition-all duration-700"
    />
  )
}

function LegendItem({
  color,
  label,
  count,
  percentage,
}: {
  color: string
  label: string
  count: number
  percentage: number
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <span className="text-xs font-medium text-storm/60">{label}</span>
      <span className="ml-auto text-xs font-semibold tabular-nums text-midnight">
        {count}
        <span className="text-storm/40"> ({percentage}%)</span>
      </span>
    </div>
  )
}
