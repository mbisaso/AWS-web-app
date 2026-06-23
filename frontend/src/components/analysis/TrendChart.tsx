import { useMemo, useRef, useState } from 'react'
import type { HistoricalReading, SensorType } from '../../services/api'
import { SENSOR_CONFIG } from '../../services/api'

const STATION_COLORS = [
  '#0EA5E9', '#F97316', '#22C55E', '#8B5CF6', '#E11D48',
  '#F59E0B', '#06B6D4', '#84CC16', '#D946EF', '#14B8A6',
]

const PAD = { top: 24, bottom: 44, left: 55, right: 20 }
const SVG_W = 800
const SVG_H = 300

function movingAverage(values: number[], window: number): (number | null)[] {
  const result: (number | null)[] = []
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - window + 1)
    const slice = values.slice(start, i + 1)
    result.push(slice.length > 0 ? slice.reduce((a, b) => a + b, 0) / slice.length : null)
  }
  return result
}

function buildLine(readings: { timestamp: string; value: number }[], start: number, end: number, sx: (t: number) => number, sy: (v: number) => number) {
  if (start >= end || start >= readings.length) return ''
  const pts = readings.slice(start, end).map((r) => {
    const x = sx(new Date(r.timestamp).getTime())
    const y = sy(r.value)
    return `${x},${y}`
  })
  return `M ${pts.join(' L ')}`
}

export interface TrendChartProps {
  readings: HistoricalReading[]
  sensorType: SensorType
  showMovingAverage: boolean
  onToggleMovingAverage: () => void
  isLoading?: boolean
}

interface TooltipData {
  x: number
  y: number
  value: number
  stationName: string
  time: string
}

export function TrendChart({ readings, sensorType, showMovingAverage, onToggleMovingAverage, isLoading }: TrendChartProps) {
  const cfg = SENSOR_CONFIG[sensorType]
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const { lines, maLines, yMin, yMax, xMin, xMax } = useMemo(() => {
    if (!readings.length) return { lines: [], maLines: [], yMin: 0, yMax: 100, xMin: 0, xMax: 1 }

    const grouped = new Map<number, HistoricalReading[]>()
    for (const r of readings) {
      if (!grouped.has(r.station_id)) grouped.set(r.station_id, [])
      grouped.get(r.station_id)!.push(r)
    }
    for (const [, arr] of grouped) arr.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

    let yLo = Infinity, yHi = -Infinity
    let xLo = Infinity, xHi = -Infinity
    for (const r of readings) {
      const t = new Date(r.timestamp).getTime()
      if (r.value < yLo) yLo = r.value
      if (r.value > yHi) yHi = r.value
      if (t < xLo) xLo = t
      if (t > xHi) xHi = t
    }

    const yPad = (yHi - yLo) * 0.1 || 5
    const yLoScaled = yLo - yPad
    const yHiScaled = yHi + yPad
    const chartW = SVG_W - PAD.left - PAD.right
    const chartH = SVG_H - PAD.top - PAD.bottom
    const sx = (t: number) => PAD.left + ((t - xLo) / (xHi - xLo)) * chartW
    const sy = (v: number) => PAD.top + chartH - ((v - yLoScaled) / (yHiScaled - yLoScaled)) * chartH
    const medianGap = xHi - xLo > 0 ? (xHi - xLo) / readings.length * 2 : 3 * 60 * 60 * 1000
    const gapThreshold = medianGap * 2.5

    const resultLines: { stationId: number; stationName: string; color: string; d: string }[] = []
    const resultMaLines: { stationId: number; color: string; d: string }[] = []

    Array.from(grouped.entries()).forEach(([stationId, group], idx) => {
      const color = STATION_COLORS[idx % STATION_COLORS.length]
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
      resultLines.push({ stationId, stationName: group[0].station_name, color, d: segments.join(' ') })

      if (showMovingAverage) {
        const window = Math.max(3, Math.floor(group.length / 10))
        const maVals = movingAverage(group.map((r) => r.value), window)
        const maReadings = group.map((r, i) => ({ timestamp: r.timestamp, value: maVals[i] ?? 0 }))
        const maSegments: string[] = []
        let maStart = 0
        for (let i = 1; i < maReadings.length; i++) {
          const gap = new Date(maReadings[i].timestamp).getTime() - new Date(maReadings[i - 1].timestamp).getTime()
          if (gap > gapThreshold || maVals[i] === null || maVals[i - 1] === null) {
            maSegments.push(buildLine(maReadings, maStart, i, sx, sy))
            maStart = i
          }
        }
        maSegments.push(buildLine(maReadings, maStart, maReadings.length, sx, sy))
        resultMaLines.push({ stationId, color, d: maSegments.join(' ') })
      }
    })

    return { lines: resultLines, maLines: resultMaLines, yMin: yLoScaled, yMax: yHiScaled, xMin: xLo, xMax: xHi }
  }, [readings, showMovingAverage])

  const chartW = SVG_W - PAD.left - PAD.right
  const chartH = SVG_H - PAD.top - PAD.bottom

  const yTicks = useMemo(() => {
    const range = yMax - yMin
    const rough = range / 5
    const mag = Math.pow(10, Math.floor(Math.log10(rough || 1)))
    const res = rough / mag
    let nice = mag
    if (res > 1.5) nice = 2 * mag
    if (res > 3.5) nice = 5 * mag
    if (res > 7.5) nice = 10 * mag
    const start = Math.ceil(yMin / nice) * nice
    const ticks: number[] = []
    for (let v = start; v <= yMax; v += nice) ticks.push(parseFloat(v.toFixed(2)))
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

  function handlePointer(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current || !readings.length) return
    const rect = svgRef.current.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const xRange = xMax - xMin
    const mouseTime = xMin + ((mx - PAD.left) / chartW) * xRange
    let closest: HistoricalReading | null = null
    let closestDist = Infinity
    for (const r of readings) {
      const t = new Date(r.timestamp).getTime()
      const dist = Math.abs(t - mouseTime)
      if (dist < closestDist) { closestDist = dist; closest = r }
    }
    if (!closest) return
    const x = sxVal(new Date(closest.timestamp).getTime())
    const y = syVal(closest.value)
    const time = new Date(closest.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    setTooltip({ x, y, value: closest.value, stationName: closest.station_name, time })
  }

  if (isLoading) {
    return (
      <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5" aria-hidden="true">
        <div className="mb-4 h-4 w-32 rounded-full bg-slate-200" />
        <div className="h-[260px] rounded-xl bg-slate-100" />
      </div>
    )
  }

  if (!readings.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-midnight font-display">{cfg.label} — Trends</h3>
        <div className="flex h-[260px] items-center justify-center rounded-xl bg-slate-50">
          <p className="text-sm text-storm/40">No readings available for this selection</p>
        </div>
      </div>
    )
  }

  const stationNames = [...new Set(readings.map((r) => r.station_name))]

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-midnight font-display">
          {cfg.label} — Trends{' '}
          <span className="text-xs font-normal text-storm/40">({readings.length} readings)</span>
        </h3>
        <div className="flex items-center gap-3">
          {readings.length >= 6 && (
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-[10px] text-storm/50 hover:text-storm/70">
              <input
                type="checkbox"
                checked={showMovingAverage}
                onChange={onToggleMovingAverage}
                className="h-3.5 w-3.5 rounded border-slate-300 text-midnight focus:ring-1 focus:ring-sky-soft"
              />
              Moving avg
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            {stationNames.map((name, i) => (
              <span key={name} className="inline-flex items-center gap-1 text-[10px] text-storm/50">
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: STATION_COLORS[i % STATION_COLORS.length] }} aria-hidden="true" />
                {name.split(' ').slice(0, 2).join(' ')}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="relative" style={{ maxWidth: '100%' }}>
        <svg ref={svgRef} viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full select-none" style={{ height: 'auto', touchAction: 'none' }}
          onMouseMove={handlePointer} onMouseLeave={() => setTooltip(null)} onClick={handlePointer}
          role="img" aria-label={`${cfg.label} trend chart`}>
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
          <text x={14} y={PAD.top + chartH / 2} textAnchor="middle" fontSize="10" fill="#94A3B8" transform={`rotate(-90, 14, ${PAD.top + chartH / 2})`}>{cfg.unit}</text>

          {/* Moving average lines (behind main lines) */}
          {showMovingAverage && maLines.map((ml) => (
            <path key={`ma-${ml.stationId}`} d={ml.d} fill="none" stroke={ml.color} strokeWidth="1.5" strokeDasharray="4,3" opacity="0.6" />
          ))}

          {/* Main lines */}
          {lines.map((l) => (
            <path key={l.stationId} d={l.d} fill="none" stroke={l.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          ))}

          {tooltip && <line x1={tooltip.x} y1={PAD.top} x2={tooltip.x} y2={PAD.top + chartH} stroke="#94A3B8" strokeWidth="0.5" strokeDasharray="3,3" />}
        </svg>

        {tooltip && (
          <div className="pointer-events-none absolute z-10 -translate-x-1/2" style={{ left: `${(tooltip.x / SVG_W) * 100}%`, top: `${Math.min(tooltip.y / SVG_H, 0.85) * 100}%` }}>
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg -translate-y-full">
              <p className="text-sm font-bold text-midnight font-display">{tooltip.value}{cfg.unit}</p>
              <p className="text-[10px] text-storm/50">{tooltip.stationName}</p>
              <p className="text-[10px] text-storm/40">{tooltip.time}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
