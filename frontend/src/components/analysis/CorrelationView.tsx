import { useMemo, useRef, useState } from 'react'
import type { HistoricalReading, SensorType } from '../../services/api'
import { SENSOR_CONFIG } from '../../services/api'

const PAD = { top: 24, bottom: 44, left: 55, right: 20 }
const SVG_W = 600
const SVG_H = 450

function pearsonR(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length)
  if (n < 3) return 0
  const sx = x.slice(0, n).reduce((a, b) => a + b, 0)
  const sy = y.slice(0, n).reduce((a, b) => a + b, 0)
  const sxx = x.slice(0, n).reduce((a, b) => a + b * b, 0)
  const syy = y.slice(0, n).reduce((a, b) => a + b * b, 0)
  const sxy = x.slice(0, n).reduce((a, b, i) => a + b * y[i], 0)
  const denom = Math.sqrt((n * sxx - sx * sx) * (n * syy - sy * sy))
  return denom === 0 ? 0 : (n * sxy - sx * sy) / denom
}

function linearRegression(x: number[], y: number[]) {
  const n = Math.min(x.length, y.length)
  if (n < 3) return { slope: 0, intercept: 0 }
  const mx = x.slice(0, n).reduce((a, b) => a + b, 0) / n
  const my = y.slice(0, n).reduce((a, b) => a + b, 0) / n
  let num = 0, den = 0
  for (let i = 0; i < n; i++) {
    num += (x[i] - mx) * (y[i] - my)
    den += (x[i] - mx) ** 2
  }
  const slope = den === 0 ? 0 : num / den
  return { slope, intercept: my - slope * mx }
}

function correlationLabel(r: number): string {
  const abs = Math.abs(r)
  if (abs >= 0.9) return 'Very strong'
  if (abs >= 0.7) return 'Strong'
  if (abs >= 0.5) return 'Moderate'
  if (abs >= 0.3) return 'Weak'
  return 'Very weak'
}

interface CorrelationViewProps {
  readingsA: HistoricalReading[]
  readingsB: HistoricalReading[]
  sensorTypeA: SensorType
  sensorTypeB: SensorType
  isLoading?: boolean
}

interface TooltipData {
  x: number
  y: number
  valA: number
  valB: number
  stationName: string
  time: string
}

export function CorrelationView({ readingsA, readingsB, sensorTypeA, sensorTypeB, isLoading }: CorrelationViewProps) {
  const cfgA = SENSOR_CONFIG[sensorTypeA]
  const cfgB = SENSOR_CONFIG[sensorTypeB]
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const minLen = Math.min(readingsA.length, readingsB.length)

  const { points, xMin, xMax, yMin, yMax, r, regLine, label } = useMemo(() => {
    if (minLen < 3) return { points: [], xMin: 0, xMax: 1, yMin: 0, yMax: 1, r: 0, regLine: '', label: 'Insufficient data' }

    const paired: { x: number; y: number; name: string; time: string }[] = []
    for (let i = 0; i < minLen; i++) {
      if (readingsA[i].station_id === readingsB[i].station_id) {
        paired.push({
          x: readingsA[i].value,
          y: readingsB[i].value,
          name: readingsA[i].station_name,
          time: readingsA[i].timestamp,
        })
      }
    }

    if (paired.length < 3) return { points: [], xMin: 0, xMax: 1, yMin: 0, yMax: 1, r: 0, regLine: '', label: 'Insufficient data' }

    const xVals = paired.map((p) => p.x)
    const yVals = paired.map((p) => p.y)
    const xLo = Math.min(...xVals)
    const xHi = Math.max(...xVals)
    const yLo = Math.min(...yVals)
    const yHi = Math.max(...yVals)
    const xPad = (xHi - xLo) * 0.1 || 1
    const yPad = (yHi - yLo) * 0.1 || 1
    const rVal = pearsonR(xVals, yVals)
    const { slope, intercept } = linearRegression(xVals, yVals)

    const chartW = SVG_W - PAD.left - PAD.right
    const chartH = SVG_H - PAD.top - PAD.bottom
    const sx = (v: number) => PAD.left + ((v - (xLo - xPad)) / (xHi - xLo + 2 * xPad)) * chartW
    const sy = (v: number) => PAD.top + chartH - ((v - (yLo - yPad)) / (yHi - yLo + 2 * yPad)) * chartH

    const lineX1 = xLo - xPad
    const lineX2 = xHi + xPad
    const lineY1 = slope * lineX1 + intercept
    const lineY2 = slope * lineX2 + intercept
    const reg = `M ${sx(lineX1)},${sy(lineY1)} L ${sx(lineX2)},${sy(lineY2)}`

    return {
      points: paired.map((p) => ({ cx: sx(p.x), cy: sy(p.y), name: p.name, time: p.time, xVal: p.x, yVal: p.y })),
      xMin: xLo - xPad, xMax: xHi + xPad,
      yMin: yLo - yPad, yMax: yHi + xPad,
      r: rVal,
      regLine: reg,
      label: `${correlationLabel(rVal)} ${rVal >= 0 ? 'positive' : 'negative'} correlation`,
    }
  }, [readingsA, readingsB, minLen])

  const chartW = SVG_W - PAD.left - PAD.right
  const chartH = SVG_H - PAD.top - PAD.bottom

  function sxVal(v: number) { return PAD.left + ((v - xMin) / (xMax - xMin)) * chartW }
  function syVal(v: number) { return PAD.top + chartH - ((v - yMin) / (yMax - yMin)) * chartH }

  const xTicks = useMemo(() => {
    const rough = (xMax - xMin) / 5
    const mag = Math.pow(10, Math.floor(Math.log10(rough || 1)))
    const res = rough / mag
    let nice = mag
    if (res > 1.5) nice = 2 * mag
    if (res > 3.5) nice = 5 * mag
    if (res > 7.5) nice = 10 * mag
    const start = Math.ceil(xMin / nice) * nice
    const ticks: number[] = []
    for (let v = start; v <= xMax; v += nice) ticks.push(v)
    return ticks
  }, [xMin, xMax])

  const yTicks = useMemo(() => {
    const rough = (yMax - yMin) / 5
    const mag = Math.pow(10, Math.floor(Math.log10(rough || 1)))
    const res = rough / mag
    let nice = mag
    if (res > 1.5) nice = 2 * mag
    if (res > 3.5) nice = 5 * mag
    if (res > 7.5) nice = 10 * mag
    const start = Math.ceil(yMin / nice) * nice
    const ticks: number[] = []
    for (let v = start; v <= yMax; v += nice) ticks.push(v)
    return ticks
  }, [yMin, yMax])

  function handlePointer(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current || !points.length) return
    const rect = svgRef.current.getBoundingClientRect()
    const mx = (e.clientX - rect.left) / rect.width * SVG_W
    const my = (e.clientY - rect.top) / rect.height * SVG_H
    let closest = points[0]
    let closestDist = Infinity
    for (const p of points) {
      const d = Math.sqrt((p.cx - mx) ** 2 + (p.cy - my) ** 2)
      if (d < closestDist) { closestDist = d; closest = p }
    }
    if (closestDist > 30) { setTooltip(null); return }
    const time = new Date(closest.time).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    setTooltip({ x: closest.cx, y: closest.cy, valA: closest.xVal, valB: closest.yVal, stationName: closest.name, time })
  }

  if (isLoading) {
    return (
      <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5" aria-hidden="true">
        <div className="mb-4 h-4 w-40 rounded-full bg-slate-200" />
        <div className="h-[400px] rounded-xl bg-slate-100" />
      </div>
    )
  }

  if (minLen < 3 || points.length < 3) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-midnight font-display">Correlation</h3>
        <div className="flex h-[400px] items-center justify-center rounded-xl bg-slate-50 flex-col gap-2">
          <p className="text-sm text-storm/40">Select 2 sensor types with data to view correlation</p>
          <p className="text-xs text-storm/30">Correlation needs paired readings across two sensors</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-midnight font-display">
          Correlation: {cfgA.label} vs {cfgB.label}
        </h3>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[10px] text-storm/50">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: cfgA.color }} aria-hidden="true" />
            {cfgA.label}
          </span>
          <span className="text-storm/20">vs</span>
          <span className="inline-flex items-center gap-1 text-[10px] text-storm/50">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: cfgB.color }} aria-hidden="true" />
            {cfgB.label}
          </span>
        </div>
      </div>

      {/* Correlation coefficient display */}
      <div className="mb-4 rounded-xl bg-slate-50 px-4 py-3">
        <p className="text-lg font-bold text-midnight font-display">{r.toFixed(3)}</p>
        <p className="text-xs text-storm/50">{label} · {points.length} paired readings</p>
      </div>

      <div className="relative" style={{ maxWidth: '100%' }}>
        <svg ref={svgRef} viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full select-none" style={{ height: 'auto', touchAction: 'none' }}
          onMouseMove={handlePointer} onMouseLeave={() => setTooltip(null)}
          role="img" aria-label={`Scatter plot of ${cfgA.label} vs ${cfgB.label}`}>
          {xTicks.map((v) => {
            const x = sxVal(v)
            return <g key={`x${v}`}>
              <line x1={x} y1={PAD.top} x2={x} y2={PAD.top + chartH} stroke="#F1F5F9" strokeWidth="0.5" />
              <text x={x} y={SVG_H - 8} textAnchor="middle" fontSize="9" fill="#94A3B8">{v}</text>
            </g>
          })}
          {yTicks.map((v) => {
            const y = syVal(v)
            return <g key={`y${v}`}>
              <line x1={PAD.left} y1={y} x2={SVG_W - PAD.right} y2={y} stroke="#E2E8F0" strokeWidth="0.5" />
              <text x={PAD.left - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#94A3B8">{v}</text>
            </g>
          })}
          <text x={PAD.left + chartW / 2} y={SVG_H - 6} textAnchor="middle" fontSize="10" fill="#94A3B8">{cfgA.label} ({cfgA.unit})</text>
          <text x={12} y={PAD.top + chartH / 2} textAnchor="middle" fontSize="10" fill="#94A3B8" transform={`rotate(-90, 12, ${PAD.top + chartH / 2})`}>{cfgB.label} ({cfgB.unit})</text>

          {/* Regression line */}
          <path d={regLine} fill="none" stroke="#E11D48" strokeWidth="2" strokeDasharray="5,3" />

          {/* Scatter dots */}
          {points.map((p, i) => (
            <circle key={i} cx={p.cx} cy={p.cy} r="3.5" fill="#0EA5E9" opacity="0.55" stroke="#FFFFFF" strokeWidth="0.5" />
          ))}
        </svg>

        {tooltip && (
          <div className="pointer-events-none absolute z-10 -translate-x-1/2" style={{ left: `${(tooltip.x / SVG_W) * 100}%`, top: `${(tooltip.y / SVG_H) * 100}%` }}>
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg -translate-y-full">
              <p className="text-xs text-storm/50">{tooltip.stationName}</p>
              <p className="text-xs font-semibold text-midnight tabular-nums">{cfgA.label}: {tooltip.valA}{cfgA.unit}</p>
              <p className="text-xs font-semibold text-midnight tabular-nums">{cfgB.label}: {tooltip.valB}{cfgB.unit}</p>
              <p className="text-[10px] text-storm/40">{tooltip.time}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
