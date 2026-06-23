import { useMemo, useRef, useState } from 'react'
import type { PowerMetricType, PowerReading } from '../../services/api'
import { POWER_METRIC_CONFIG } from '../../services/api'

const PAD = { top: 24, bottom: 44, left: 55, right: 20 }
const SVG_W = 800
const SVG_H = 300

interface ChartSeries {
  metric: PowerMetricType
  readings: PowerReading[]
  color: string
}

interface PowerHistoricalChartProps {
  primary: ChartSeries
  secondary?: ChartSeries | null
  showSecondary?: boolean
  onToggleSecondary?: () => void
  isLoading?: boolean
}

interface TooltipData {
  x: number
  y: number
  value: number
  stationName: string
  time: string
  metric: PowerMetricType
  isAnomaly: boolean
  anomalyReason?: string
}

function buildLine(group: PowerReading[], start: number, end: number, sx: (t: number) => number, sy: (v: number) => number) {
  if (start >= end || start >= group.length) return ''
  const pts = group.slice(start, end).map((r) => {
    const x = sx(new Date(r.timestamp).getTime())
    const y = sy(r.value)
    return `${x},${y}`
  })
  return `M ${pts.join(' L ')}`
}

export function PowerHistoricalChart({ primary, secondary, showSecondary, onToggleSecondary, isLoading }: PowerHistoricalChartProps) {
  const cfg = POWER_METRIC_CONFIG[primary.metric]
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const allReadings = useMemo(() => {
    const combined = [...primary.readings]
    if (showSecondary && secondary) combined.push(...secondary.readings)
    return combined
  }, [primary.readings, secondary, showSecondary])

  const { groups, yMin, yMax, xMin, xMax, anomalies } = useMemo(() => {
    if (!primary.readings.length) {
      return { groups: [], yMin: 0, yMax: 100, xMin: 0, xMax: 1, anomalies: [] as PowerReading[] }
    }

    let yLo = Infinity, yHi = -Infinity
    let xLo = Infinity, xHi = -Infinity
    const anoms: PowerReading[] = []

    const series = [{ readings: primary.readings }]
    if (showSecondary && secondary) series.push({ readings: secondary.readings })

    for (const s of series) {
      for (const r of s.readings) {
        const t = new Date(r.timestamp).getTime()
        if (r.value < yLo) yLo = r.value
        if (r.value > yHi) yHi = r.value
        if (t < xLo) xLo = t
        if (t > xHi) xHi = t
        if (r.is_anomaly) anoms.push(r)
      }
    }

    const yPad = (yHi - yLo) * 0.1 || 5
    const yLoScaled = yLo - yPad
    const yHiScaled = yHi + yPad
    const chartW = SVG_W - PAD.left - PAD.right
    const chartH = SVG_H - PAD.top - PAD.bottom

    const sx = (t: number) => PAD.left + ((t - xLo) / (xHi - xLo)) * chartW
    const sy = (v: number) => PAD.top + chartH - ((v - yLoScaled) / (yHiScaled - yLoScaled)) * chartH

    const medianGap = xHi - xLo > 0 ? (xHi - xLo) / allReadings.length * 2 : 3 * 60 * 60 * 1000
    const gapThreshold = medianGap * 2.5

    const build = (readings: PowerReading[], color: string) => {
      const map = new Map<number, PowerReading[]>()
      for (const r of readings) {
        if (!map.has(r.station_id)) map.set(r.station_id, [])
        map.get(r.station_id)!.push(r)
      }
      for (const [, arr] of map) arr.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

      return Array.from(map.entries()).map(([stationId, group]) => {
        const segments: string[] = []
        let segStart = 0
        for (let i = 1; i < group.length; i++) {
          const gap = new Date(group[i].timestamp).getTime() - new Date(group[i - 1].timestamp).getTime()
          if (gap > gapThreshold) {
            segments.push(buildLine(group, segStart, i, sx, sy))
            segStart = i
          }
        }
        segments.push(buildLine(group, segStart, group.length, sx, sy))
        return { stationId, stationName: group[0].station_name, color, d: segments.join(' ') }
      })
    }

    const primaryLines = build(primary.readings, primary.color)
    const secondaryLines = showSecondary && secondary ? build(secondary.readings, secondary.color) : []

    return {
      groups: [...primaryLines, ...secondaryLines],
      yMin: yLoScaled,
      yMax: yHiScaled,
      xMin: xLo,
      xMax: xHi,
      anomalies: anoms,
    }
  }, [primary, secondary, showSecondary, allReadings.length])

  const chartW = SVG_W - PAD.left - PAD.right
  const chartH = SVG_H - PAD.top - PAD.bottom

  const yTicks = useMemo(() => {
    const range = yMax - yMin
    const rough = range / 5
    const mag = Math.pow(10, Math.floor(Math.log10(rough || 1)))
    const res = rough / mag
    let nice: number
    if (res <= 1.5) nice = mag
    else if (res <= 3.5) nice = 2 * mag
    else if (res <= 7.5) nice = 5 * mag
    else nice = 10 * mag
    const start = Math.ceil(yMin / nice) * nice
    const ticks: number[] = []
    for (let v = start; v <= yMax; v += nice) {
      ticks.push(parseFloat(v.toFixed(2)))
    }
    return ticks
  }, [yMin, yMax])

  const xTicks = useMemo(() => {
    if (xMax <= xMin) return [new Date(xMin)]
    const count = 6
    const step = (xMax - xMin) / count
    return Array.from({ length: count + 1 }, (_, i) => new Date(xMin + i * step))
  }, [xMin, xMax])

  function sxVal(t: number) { return PAD.left + ((t - xMin) / (xMax - xMin)) * chartW }
  function syVal(v: number) { return PAD.top + chartH - ((v - yMin) / (yMax - yMin)) * chartH }

  function findClosest(clientX: number) {
    if (!svgRef.current || !allReadings.length) return null
    const rect = svgRef.current.getBoundingClientRect()
    const mx = clientX - rect.left
    const xRange = xMax - xMin
    const mouseTime = xMin + ((mx - PAD.left) / chartW) * xRange

    let closest: PowerReading | null = null
    let closestDist = Infinity
    for (const r of allReadings) {
      const t = new Date(r.timestamp).getTime()
      const dist = Math.abs(t - mouseTime)
      if (dist < closestDist) {
        closestDist = dist
        closest = r
      }
    }
    return closest
  }

  function handlePointer(e: React.MouseEvent<SVGSVGElement>) {
    const closest = findClosest(e.clientX)
    if (!closest) return
    const x = sxVal(new Date(closest.timestamp).getTime())
    const y = syVal(closest.value)
    const time = new Date(closest.timestamp).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
    setTooltip({ x, y, value: closest.value, stationName: closest.station_name, time, metric: closest.metric, isAnomaly: closest.is_anomaly, anomalyReason: closest.anomaly_reason })
  }

  if (isLoading) {
    return (
      <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5" aria-hidden="true">
        <div className="mb-4 h-4 w-32 rounded-full bg-slate-200" />
        <div className="h-[260px] rounded-xl bg-slate-100" />
      </div>
    )
  }

  if (!primary.readings.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-midnight font-display">
          {cfg.label} — Historical
        </h3>
        <div className="flex h-[260px] items-center justify-center rounded-xl bg-slate-50">
          <p className="text-sm text-storm/40">No readings available for this selection</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-midnight font-display">
          {cfg.label} — Historical{' '}
          <span className="text-xs font-normal text-storm/40">({primary.readings.length} readings)</span>
        </h3>
        <div className="flex items-center gap-3">
          {secondary && (
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-[10px] text-storm/50 hover:text-storm/70">
              <input
                type="checkbox"
                checked={showSecondary ?? false}
                onChange={onToggleSecondary}
                className="h-3.5 w-3.5 rounded border-slate-300 text-midnight focus:ring-1 focus:ring-sky-soft"
              />
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: secondary.color }} aria-hidden="true" />
                {POWER_METRIC_CONFIG[secondary.metric].label}
              </span>
            </label>
          )}
          <span className="inline-flex items-center gap-1 text-[10px] text-storm/50">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: primary.color }} aria-hidden="true" />
            {cfg.label}
          </span>
        </div>
      </div>

      <div className="relative" style={{ maxWidth: '100%' }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="w-full select-none"
          style={{ height: 'auto', touchAction: 'none' }}
          onMouseMove={handlePointer}
          onMouseLeave={() => setTooltip(null)}
          onClick={handlePointer}
          role="img"
          aria-label={`${cfg.label} chart`}
        >
          {yTicks.map((v) => {
            const y = syVal(v)
            return (
              <g key={v}>
                <line x1={PAD.left} y1={y} x2={SVG_W - PAD.right} y2={y} stroke="#E2E8F0" strokeWidth="0.5" />
                <text x={PAD.left - 8} y={y + 3} textAnchor="end" fontSize="10" fill="#94A3B8">{v}</text>
              </g>
            )
          })}

          {xTicks.map((d, i) => {
            const x = sxVal(d.getTime())
            const label = d.toLocaleString(undefined, { month: 'short', day: 'numeric' })
            return (
              <g key={i}>
                <line x1={x} y1={PAD.top} x2={x} y2={PAD.top + chartH} stroke="#F1F5F9" strokeWidth="0.5" />
                <text x={x} y={SVG_H - 8} textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'} fontSize="10" fill="#94A3B8">{label}</text>
              </g>
            )
          })}

          <text x={14} y={PAD.top + chartH / 2} textAnchor="middle" fontSize="10" fill="#94A3B8" transform={`rotate(-90, 14, ${PAD.top + chartH / 2})`}>
            {cfg.unit}
          </text>

          {groups.map((g) => (
            <path key={`${g.stationId}-${g.color}`} d={g.d} fill="none" stroke={g.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          ))}

          {anomalies.map((r) => {
            const x = sxVal(new Date(r.timestamp).getTime())
            const y = syVal(r.value)
            return (
              <g key={`anom-${r.id}`}>
                <circle cx={x} cy={y} r="5" fill="#F59E0B" stroke="#FFFFFF" strokeWidth="1.5" />
                <circle cx={x} cy={y} r="2" fill="#FFFFFF" opacity="0.8" />
              </g>
            )
          })}

          {tooltip && (
            <line x1={tooltip.x} y1={PAD.top} x2={tooltip.x} y2={PAD.top + chartH} stroke="#94A3B8" strokeWidth="0.5" strokeDasharray="3,3" />
          )}
        </svg>

        {tooltip && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2"
            style={{
              left: `${(tooltip.x / SVG_W) * 100}%`,
              top: `${Math.min(tooltip.y / SVG_H, 0.85) * 100}%`,
            }}
          >
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg -translate-y-full">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-bold text-midnight font-display">
                  {tooltip.value}{POWER_METRIC_CONFIG[tooltip.metric]?.unit ?? ''}
                </span>
                {tooltip.isAnomaly && <span className="text-[10px] font-medium text-amber-600">Flagged</span>}
              </div>
              <p className="text-[10px] text-storm/50">{tooltip.stationName}</p>
              <p className="text-[10px] text-storm/40">{tooltip.time}</p>
              {tooltip.isAnomaly && tooltip.anomalyReason && (
                <p className="text-[10px] text-amber-600">{tooltip.anomalyReason}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
