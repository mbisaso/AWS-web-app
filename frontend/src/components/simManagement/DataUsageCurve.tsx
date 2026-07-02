import { useMemo } from 'react'
import type { DailyUsage } from '../../services/api'

interface DataUsageCurveProps {
  used: number
  total: number
  dailyUsage: DailyUsage[]
}

export function DataUsageCurve({ used, total, dailyUsage }: DataUsageCurveProps) {
  const pct = total > 0 ? Math.min(100, Math.max(0, (used / total) * 100)) : 0
  const remaining = Math.max(0, total - used)

  const curveColor =
    pct >= 90 ? '#E11D48'
    : pct >= 70 ? '#F59E0B'
    : '#22C55E'


  const curvePoints = useMemo(() => {
    if (!dailyUsage.length) return null
    const vals = dailyUsage.map((d) => d.usage_mb)
    const max = Math.max(...vals, 1)
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length
    const width = 600
    const height = 160
    const pad = { top: 16, bottom: 28, left: 0, right: 0 }
    const chartW = width - pad.left - pad.right
    const chartH = height - pad.top - pad.bottom

    const points = vals.map((v, i) => ({
      x: pad.left + (i / Math.max(1, vals.length - 1)) * chartW,
      y: pad.top + chartH - (v / (max * 1.2)) * chartH,
    }))

    const avgY = pad.top + chartH - (avg / (max * 1.2)) * chartH

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
    const areaPath = points.length > 1
      ? `${linePath} L ${points[points.length - 1].x} ${pad.top + chartH} L ${points[0].x} ${pad.top + chartH} Z`
      : ''

    const smoothPath = points.length > 2
      ? points.map((p, i) => {
          if (i === 0) return `M ${p.x} ${p.y}`
          const prev = points[i - 1]
          const cpx1 = prev.x + (p.x - prev.x) / 2
          const cpy1 = prev.y
          const cpx2 = prev.x + (p.x - prev.x) / 2
          const cpy2 = p.y
          return `C ${cpx1} ${cpy1} ${cpx2} ${cpy2} ${p.x} ${p.y}`
        }).join(' ')
      : linePath

    return { points, linePath, areaPath, smoothPath, avgY, avg, width, height }
  }, [dailyUsage])

  const trend = useMemo(() => {
    if (!dailyUsage.length || dailyUsage.length < 3) return 'stable'
    const recent = dailyUsage.slice(-7).reduce((s, d) => s + d.usage_mb, 0) / 7
    const older = dailyUsage.slice(0, 7).reduce((s, d) => s + d.usage_mb, 0) / 7
    if (recent > older * 1.15) return 'increasing'
    if (recent < older * 0.85) return 'decreasing'
    return 'stable'
  }, [dailyUsage])

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
      <div className="flex flex-wrap items-center gap-6 sm:gap-10">
        {/* ── Big percentage ring ── */}
        <div className="relative flex shrink-0 items-center justify-center">
          <svg width="88" height="88" viewBox="0 0 88 88" className="-rotate-90">
            <circle cx="44" cy="44" r="38" fill="none" stroke="#F1F5F9" strokeWidth="6" />
            <circle
              cx="44" cy="44" r="38"
              fill="none"
              stroke={curveColor}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 38}`}
              strokeDashoffset={`${2 * Math.PI * 38 * (1 - pct / 100)}`}
              className="transition-all duration-700 motion-reduce:duration-0"
            />
          </svg>
          <span className="absolute text-xl font-bold font-display tabular-nums text-midnight">
            {pct.toFixed(0)}%
          </span>
        </div>

        {/* ── Stats ── */}
        <div className="flex flex-1 flex-wrap gap-x-6 gap-y-1 text-sm">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-storm/40">Used</p>
            <p className="font-semibold tabular-nums text-midnight">{used.toLocaleString()} MB</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-storm/40">Remaining</p>
            <p className={`font-semibold tabular-nums ${remaining <= 0 ? 'text-rose' : remaining < total * 0.1 ? 'text-amber' : 'text-midnight'}`}>
              {remaining.toLocaleString()} MB
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-storm/40">Total bundle</p>
            <p className="font-semibold tabular-nums text-midnight">{total.toLocaleString()} MB</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-storm/40">Trend</p>
            <p className={`flex items-center gap-1 font-semibold tabular-nums ${
              trend === 'increasing' ? 'text-rose'
              : trend === 'decreasing' ? 'text-emerald'
              : 'text-storm/60'
            }`}>
              {trend === 'increasing' && (
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M23 18 13.5 8.5l-5 5L1 6" />
                  <path d="M17 18h6v-6" />
                </svg>
              )}
              {trend === 'decreasing' && (
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M23 6 13.5 15.5l-5-5L1 18" />
                  <path d="M17 6h6v6" />
                </svg>
              )}
              {trend === 'stable' && (
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M1 12h22" />
                </svg>
              )}
              {trend.charAt(0).toUpperCase() + trend.slice(1)}
            </p>
          </div>
        </div>
      </div>

      {/* ── Usage curve sparkline ── */}
      {curvePoints && curvePoints.points.length > 1 && (
        <div className="mt-4">
          <svg
            viewBox={`0 0 ${curvePoints.width} ${curvePoints.height}`}
            className="w-full h-20"
            role="img"
            aria-label="Data usage trend curve"
          >
            <defs>
              <linearGradient id="curveFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={curveColor} stopOpacity="0.2" />
                <stop offset="100%" stopColor={curveColor} stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* Area fill */}
            {curvePoints.areaPath && (
              <path d={curvePoints.areaPath} fill="url(#curveFill)" />
            )}

            {/* Smooth curve line */}
            <path
              d={curvePoints.smoothPath}
              fill="none"
              stroke={curveColor}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Average line */}
            <line
              x1="0"
              x2={curvePoints.width}
              y1={curvePoints.avgY}
              y2={curvePoints.avgY}
              stroke="#CBD5E1"
              strokeWidth="1"
              strokeDasharray="3 3"
            />

            {/* End dot */}
            <circle
              cx={curvePoints.points[curvePoints.points.length - 1].x}
              cy={curvePoints.points[curvePoints.points.length - 1].y}
              r="3"
              fill="white"
              stroke={curveColor}
              strokeWidth="2"
            />

            {/* Usage percentage markers on the curve */}
            {[25, 50, 75].map((marker) => {
              const idx = Math.round((marker / 100) * (curvePoints.points.length - 1))
              if (idx >= curvePoints.points.length) return null
              const pt = curvePoints.points[idx]
              return (
                <g key={marker}>
                  <circle cx={pt.x} cy={pt.y} r="2" fill="#CBD5E1" />
                </g>
              )
            })}
          </svg>

          {/* Time labels */}
          <div className="mt-1 flex justify-between text-[10px] text-storm/30">
            <span>{dailyUsage.length > 0 ? new Date(dailyUsage[0].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}</span>
            <span>Usage trend (30 days)</span>
            <span>{dailyUsage.length > 0 ? new Date(dailyUsage[dailyUsage.length - 1].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}</span>
          </div>
        </div>
      )}
    </div>
  )
}
