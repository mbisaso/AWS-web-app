import { useEffect, useRef, useState } from 'react'
import type { AnalysisStats, SensorType } from '../../services/api'
import { SENSOR_CONFIG } from '../../services/api'

interface StatSummaryCardProps {
  stats: AnalysisStats | null
  sensorType: SensorType
  stationName: string
  isLoading?: boolean
}

function Sparkline({ values, color, height }: { values: number[]; color: string; height: number }) {
  if (values.length < 2) return null
  const w = 80
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${height - ((v - min) / range) * height}`).join(' ')
  return (
    <svg width={w} height={height} className="shrink-0" aria-hidden="true">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function AnimatedNumber({ value, decimals }: { value: number; decimals?: number }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef<number | null>(null)
  const prefersReduced = useRef(false)

  useEffect(() => {
    prefersReduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  useEffect(() => {
    if (prefersReduced.current) {
      setDisplay(value)
      return
    }
    const start = performance.now()
    const duration = 600
    const from = display
    const to = value

    function tick(now: number) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - (1 - progress) * (1 - progress)
      setDisplay(from + (to - from) * eased)
      if (progress < 1) ref.current = requestAnimationFrame(tick)
    }

    ref.current = requestAnimationFrame(tick)
    return () => { if (ref.current) cancelAnimationFrame(ref.current) }
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  return <>{decimals !== undefined ? display.toFixed(decimals) : Math.round(display)}</>
}

function Skeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5" aria-hidden="true">
      <div className="mb-3 h-3 w-16 rounded-full bg-slate-200" />
      <div className="mb-2 h-7 w-20 rounded-lg bg-slate-200" />
      <div className="h-3 w-24 rounded-full bg-slate-100" />
    </div>
  )
}

export function StatSummaryCard({ stats, sensorType, stationName, isLoading }: StatSummaryCardProps) {
  const cfg = SENSOR_CONFIG[sensorType]

  if (isLoading) return <Skeleton />

  if (!stats) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-storm/40">{stationName}</p>
        <p className="mt-1 text-[10px] text-storm/30">{cfg.label}</p>
        <p className="mt-3 text-xl font-bold text-storm/30 font-display">—</p>
        <p className="mt-0.5 text-xs text-storm/30">No data</p>
      </div>
    )
  }

  const trendColor = stats.trend === 'rising' ? '#22C55E' : stats.trend === 'falling' ? '#E11D48' : '#94A3B8'
  const trendLabel = stats.trend === 'rising' ? 'Rising' : stats.trend === 'falling' ? 'Falling' : 'Stable'

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-storm/40">{stationName}</p>
          <p className="text-[10px] text-storm/30">{cfg.label} · {stats.count} readings</p>
        </div>
        <Sparkline values={stats.sparkline} color={trendColor} height={24} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div>
          <span className="text-storm/40">Avg</span>
          <p className="font-semibold tabular-nums text-midnight">
            <AnimatedNumber value={stats.average} decimals={1} />{cfg.unit}
          </p>
        </div>
        <div>
          <span className="text-storm/40">Std dev</span>
          <p className="font-semibold tabular-nums text-midnight">
            <AnimatedNumber value={stats.std_dev} decimals={2} />
          </p>
        </div>
        <div>
          <span className="text-storm/40">Min</span>
          <p className="font-semibold tabular-nums text-midnight">
            <AnimatedNumber value={stats.min} decimals={1} />{cfg.unit}
          </p>
        </div>
        <div>
          <span className="text-storm/40">Max</span>
          <p className="font-semibold tabular-nums text-midnight">
            <AnimatedNumber value={stats.max} decimals={1} />{cfg.unit}
          </p>
        </div>
      </div>

      {/* Trend indicator */}
      <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{
            backgroundColor: stats.trend === 'rising' ? '#dcfce7' : stats.trend === 'falling' ? '#ffe4e6' : '#f1f5f9',
            color: stats.trend === 'rising' ? '#16a34a' : stats.trend === 'falling' ? '#e11d48' : '#64748b',
          }}
        >
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {stats.trend === 'rising' ? (
              <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></>
            ) : stats.trend === 'falling' ? (
              <><polyline points="23 18 13.5 8.5 8.5 13.5 1 6" /><polyline points="17 18 23 18 23 12" /></>
            ) : (
              <line x1="1" y1="12" x2="23" y2="12" />
            )}
          </svg>
          {trendLabel}
        </span>
        {stats.percent_change !== null && (
          <span className="text-[10px] text-storm/40">
            {stats.percent_change > 0 ? '+' : ''}{stats.percent_change}%
          </span>
        )}
      </div>

      {/* Compared to baseline */}
      {stats.compared_to_baseline && (
        <div className="mt-2 rounded-xl bg-sky-50 px-3 py-2">
          <p className="text-[10px] font-medium text-sky-700">
            {stats.compared_to_baseline.pct_above > 0 ? '+' : ''}{stats.compared_to_baseline.pct_above}% vs baseline
          </p>
          <p className="text-[10px] text-sky-500/70">
            Baseline: {stats.compared_to_baseline.baseline_value}{cfg.unit}
          </p>
        </div>
      )}
    </div>
  )
}
