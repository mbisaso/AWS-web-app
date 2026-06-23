import { useMemo, useState } from 'react'
import type { HistoricalReading, SensorType } from '../../services/api'
import { SENSOR_CONFIG } from '../../services/api'

const STATION_COLORS = [
  '#0EA5E9', '#F97316', '#22C55E', '#8B5CF6', '#E11D48',
  '#F59E0B', '#06B6D4', '#84CC16', '#D946EF', '#14B8A6',
]

const PAD = { top: 20, bottom: 40, left: 55, right: 20 }

interface HistoricalChartProps {
  readings: HistoricalReading[]
  sensorType: SensorType
  isLoading?: boolean
}

interface TooltipData {
  x: number
  y: number
  value: number
  label: string
  stationName?: string
  isAnomaly: boolean
  anomalyReason?: string
}

export function HistoricalChart({ readings, sensorType, isLoading }: HistoricalChartProps) {
  const cfg = SENSOR_CONFIG[sensorType]
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)
  const svgWidth = 800

  const grouped = useMemo(() => {
    const map = new Map<number, HistoricalReading[]>()
    for (const r of readings) {
      if (!map.has(r.station_id)) map.set(r.station_id, [])
      map.get(r.station_id)!.push(r)
    }
    map.forEach((arr) => arr.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()))
    return Array.from(map.entries())
  }, [readings])

  const { paths, yMin, yMax, xMin, xMax, anomalyPoints } = useMemo(() => {
    if (!readings.length) return { paths: [], yMin: 0, yMax: 100, xMin: 0, xMax: 1, anomalyPoints: [] as HistoricalReading[] }

    let yMinVal = Infinity, yMaxVal = -Infinity
    let xMinVal = Infinity, xMaxVal = -Infinity
    const anomalies: HistoricalReading[] = []

    for (const r of readings) {
      const t = new Date(r.timestamp).getTime()
      if (r.value < yMinVal) yMinVal = r.value
      if (r.value > yMaxVal) yMaxVal = r.value
      if (t < xMinVal) xMinVal = t
      if (t > xMaxVal) xMaxVal = t
      if (r.is_anomaly) anomalies.push(r)
    }

    const yPad = (yMaxVal - yMinVal) * 0.1 || 5
    const yMinScaled = yMinVal - yPad
    const yMaxScaled = yMaxVal + yPad

    const chartW = svgWidth - PAD.left - PAD.right
    const chartH = 320 - PAD.top - PAD.bottom

    const sx = (t: number) => PAD.left + ((t - xMinVal) / (xMaxVal - xMinVal)) * chartW
    const sy = (v: number) => PAD.top + chartH - ((v - yMinScaled) / (yMaxScaled - yMinScaled)) * chartH

    const medianInterval = xMaxVal - xMinVal > 0
      ? (xMaxVal - xMinVal) / readings.length * 2
      : 3 * 60 * 60 * 1000
    const gapThreshold = medianInterval * 2.5

    const resultPaths: { stationId: number; stationName: string; color: string; d: string; areaD: string }[] = []

    grouped.forEach(([stationId, group], idx) => {
      const color = STATION_COLORS[idx % STATION_COLORS.length]
      const segments: { line: string; area: string }[] = []
      let segmentStart = 0

      for (let i = 1; i < group.length; i++) {
        const gap = new Date(group[i].timestamp).getTime() - new Date(group[i - 1].timestamp).getTime()
        if (gap > gapThreshold) {
          segments.push(buildSegment(group, segmentStart, i, sx, sy, chartH))
          segmentStart = i
        }
      }
      segments.push(buildSegment(group, segmentStart, group.length, sx, sy, chartH))

      const d = segments.map((s) => s.line).join(' ')
      const areaD = segments.map((s) => s.area).join(' ')

      resultPaths.push({ stationId, stationName: group[0].station_name, color, d, areaD })
    })

    return {
      paths: resultPaths,
      yMin: yMinScaled,
      yMax: yMaxScaled,
      xMin: xMinVal,
      xMax: xMaxVal,
      anomalyPoints: anomalies,
    }
  }, [readings, svgWidth, grouped])

  const yTicks = useMemo(() => {
    const range = yMax - yMin
    const roughStep = range / 5
    const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)))
    const residual = roughStep / magnitude
    let niceStep: number
    if (residual <= 1.5) niceStep = magnitude
    else if (residual <= 3.5) niceStep = 2 * magnitude
    else if (residual <= 7.5) niceStep = 5 * magnitude
    else niceStep = 10 * magnitude

    const ticks: number[] = []
    const start = Math.ceil(yMin / niceStep) * niceStep
    for (let v = start; v <= yMax; v += niceStep) {
      ticks.push(parseFloat(v.toFixed(2)))
    }
    return ticks
  }, [yMin, yMax])

  const chartW = svgWidth - PAD.left - PAD.right
  const chartH = 320 - PAD.top - PAD.bottom

  function buildSegment(
    group: HistoricalReading[],
    start: number,
    end: number,
    sx: (t: number) => number,
    sy: (v: number) => number,
    ch: number,
  ) {
    if (start >= end || start >= group.length) return { line: '', area: '' }
    const slice = group.slice(start, end)
    const lineParts = slice.map((r) => {
      const x = sx(new Date(r.timestamp).getTime())
      const y = sy(r.value)
      return `${x},${y}`
    })
    const lineD = `M ${lineParts.join(' L ')}`
    const bottom = PAD.top + ch
    const first = lineParts[0]
    const last = lineParts[lineParts.length - 1]
    const areaD = `M ${first} L ${lineParts.slice(1).join(' L ')} L ${last.split(',')[0]},${bottom} L ${first.split(',')[0]},${bottom} Z`
    return { line: lineD, area: areaD }
  }

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = e.currentTarget
    const rect = svg.getBoundingClientRect()
    const mx = e.clientX - rect.left
    if (!readings.length) return

    const chartW = svgWidth - PAD.left - PAD.right
    const xRange = xMax - xMin
    const mouseTime = xMin + ((mx - PAD.left) / chartW) * xRange

    let closest: HistoricalReading | null = null
    let closestDist = Infinity
    for (const r of readings) {
      const t = new Date(r.timestamp).getTime()
      const dist = Math.abs(t - mouseTime)
      if (dist < closestDist) {
        closestDist = dist
        closest = r
      }
    }
    if (!closest) return

    const x = sxVal(new Date(closest.timestamp).getTime())
    const y = syVal(closest.value)

    setTooltip({
      x, y,
      value: closest.value,
      label: `${closest.sensor_type}: ${closest.value}${closest.unit}`,
      stationName: closest.station_name,
      isAnomaly: closest.is_anomaly,
      anomalyReason: closest.anomaly_reason,
    })
  }

  function sxVal(t: number) { return PAD.left + ((t - xMin) / (xMax - xMin)) * chartW }
  function syVal(v: number) { return PAD.top + chartH - ((v - yMin) / (yMax - yMin)) * chartH }

  if (isLoading) {
    return (
      <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5" aria-hidden="true">
        <div className="mb-4 h-4 w-32 rounded-full bg-slate-200" />
        <div className="h-[280px] rounded-xl bg-slate-100" />
      </div>
    )
  }

  if (!readings.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-midnight font-display">
          {cfg.label} — Historical
        </h3>
        <div className="flex h-[280px] items-center justify-center rounded-xl bg-slate-50">
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
          <span className="text-xs font-normal text-storm/40">({readings.length} readings)</span>
        </h3>
        {grouped.length > 1 && (
          <div className="flex flex-wrap gap-3">
            {grouped.map(([id, group], idx) => (
              <span key={id} className="inline-flex items-center gap-1 text-[10px] text-storm/50">
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: STATION_COLORS[idx % STATION_COLORS.length] }} />
                {group[0].station_name.split(' ').slice(0, 2).join(' ')}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="relative" style={{ maxWidth: '100%' }}>
        <svg
          viewBox={`0 0 ${svgWidth} 320`}
          className="w-full select-none"
          style={{ height: 'auto', touchAction: 'none' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setTooltip(null)}
          role="img"
          aria-label={`${cfg.label} chart`}
        >
          {/* Grid + Y axis */}
          {yTicks.map((v) => {
            const y = syVal(v)
            return (
              <g key={v}>
                <line x1={PAD.left} y1={y} x2={svgWidth - PAD.right} y2={y} stroke="#E2E8F0" strokeWidth="0.5" />
                <text x={PAD.left - 6} y={y + 3} textAnchor="end" fontSize="10" fill="#94A3B8">
                  {v}
                </text>
              </g>
            )
          })}

          {/* Y axis label */}
          <text x={12} y={PAD.top + chartH / 2} textAnchor="middle" fontSize="10" fill="#94A3B8" transform={`rotate(-90, 12, ${PAD.top + chartH / 2})`}>
            {cfg.unit}
          </text>

          {/* Data area + lines */}
          {paths.map((p) => (
            <g key={p.stationId}>
              <path d={p.areaD} fill={p.color} opacity="0.08" />
              <path d={p.d} fill="none" stroke={p.color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
            </g>
          ))}

          {/* Data points */}
          {grouped.map(([id, group], gIdx) => (
            <g key={`pts-${id}`}>
              {group.map((r, i) => {
                if (i % 4 !== 0) return null
                const x = sxVal(new Date(r.timestamp).getTime())
                const y = syVal(r.value)
                return <circle key={r.id} cx={x} cy={y} r="2" fill={STATION_COLORS[gIdx % STATION_COLORS.length]} opacity="0.4" />
              })}
            </g>
          ))}

          {/* Anomaly markers */}
          {anomalyPoints.map((r) => {
            const x = sxVal(new Date(r.timestamp).getTime())
            const y = syVal(r.value)
            const isHovered = tooltip?.isAnomaly && Math.abs(tooltip.x - x) < 5 && Math.abs(tooltip.y - y) < 5
            return (
              <g key={`anom-${r.id}`}>
                <polygon
                  points={`${x},${y - 7} ${x + 5},${y} ${x},${y + 7} ${x - 5},${y}`}
                  fill="#F59E0B"
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                  opacity={isHovered ? 1 : 0.85}
                  className="motion-reduce:animate-none"
                />
              </g>
            )
          })}
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full"
            style={{
              left: `${(tooltip.x / svgWidth) * 100}%`,
              top: `${(tooltip.y / 320) * 100}%`,
            }}
          >
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg">
              <p className="text-xs font-semibold text-midnight">
                {tooltip.value}{cfg.unit}
              </p>
              {tooltip.stationName && grouped.length > 1 && (
                <p className="text-[10px] text-storm/50">{tooltip.stationName}</p>
              )}
              <p className="text-[10px] text-storm/40">{tooltip.label.split(':')[0]}</p>
              {tooltip.isAnomaly && (
                <p className="mt-0.5 text-[10px] font-medium text-amber-600">
                  ⚑ {tooltip.anomalyReason || 'Flagged'}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
