import { useMemo, useRef, useState } from 'react'
import type { SensorMetricKey, SensorReadingChart } from '../../types'
import { SENSOR_METRIC_CONFIG } from '../../types'

const PAD = { top: 24, bottom: 44, left: 55, right: 20 }
const SVG_W = 800
const SVG_H = 300

interface HistoricalChartProps {
  readings: SensorReadingChart[]
  metricKey: SensorMetricKey
  isLoading?: boolean
}

interface TooltipData {
  x: number
  y: number
  value: number
  time: string
}

function buildSeg(
  readings: SensorReadingChart[],
  key: SensorMetricKey,
  from: number,
  to: number,
  sx: (t: number) => number,
  sy: (v: number) => number,
): string {
  const pts: string[] = []
  for (let i = from; i < to; i++) {
    const v = readings[i][key]
    if (v === null) continue
    pts.push(`${sx(new Date(readings[i].timestamp).getTime())},${sy(v)}`)
  }
  return pts.length ? `M ${pts.join(' L ')}` : ''
}

function buildPath(
  sorted: SensorReadingChart[],
  key: SensorMetricKey,
  sx: (t: number) => number,
  sy: (v: number) => number,
  gapMs: number,
): string {
  if (!sorted.length) return ''
  const segs: string[] = []
  let start = 0
  for (let i = 1; i < sorted.length; i++) {
    const gap = new Date(sorted[i].timestamp).getTime() - new Date(sorted[i - 1].timestamp).getTime()
    if (gap > gapMs) {
      segs.push(buildSeg(sorted, key, start, i, sx, sy))
      start = i
    }
  }
  segs.push(buildSeg(sorted, key, start, sorted.length, sx, sy))
  return segs.filter(Boolean).join(' ')
}

export function HistoricalChart({ readings, metricKey, isLoading }: HistoricalChartProps) {
  const cfg = SENSOR_METRIC_CONFIG[metricKey]
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const sorted = useMemo(
    () => [...readings].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
    [readings],
  )

  const computed = useMemo(() => {
    const cW = SVG_W - PAD.left - PAD.right
    const cH = SVG_H - PAD.top - PAD.bottom

    if (!sorted.length) {
      return { path: '', yMin: 0, yMax: 1, xMin: 0, xMax: 1, yTicks: [], xTicks: [], cW, cH }
    }

    let yLo = Infinity, yHi = -Infinity
    let xLo = Infinity, xHi = -Infinity

    for (const r of sorted) {
      const t = new Date(r.timestamp).getTime()
      if (t < xLo) xLo = t
      if (t > xHi) xHi = t
      const v = r[metricKey]
      if (v !== null) {
        if (v < yLo) yLo = v
        if (v > yHi) yHi = v
      }
    }

    if (!isFinite(yLo)) { yLo = 0; yHi = 1 }
    const yPad = (yHi - yLo) * 0.1 || 5
    const yLoS = yLo - yPad
    const yHiS = yHi + yPad
    const xRange = xHi - xLo || 1

    const sx = (t: number) => PAD.left + ((t - xLo) / xRange) * cW
    const sy = (v: number) => PAD.top + cH - ((v - yLoS) / (yHiS - yLoS)) * cH

    const gapMs = (sorted.length > 1 ? (xHi - xLo) / sorted.length : 3 * 60 * 60 * 1000) * 2.5

    const range = yHiS - yLoS
    const rough = range / 5
    const mag = Math.pow(10, Math.floor(Math.log10(rough || 1)))
    const res = rough / mag
    let nice = mag
    if (res > 7.5) nice = 10 * mag
    else if (res > 3.5) nice = 5 * mag
    else if (res > 1.5) nice = 2 * mag
    const yTicksArr: number[] = []
    for (let v = Math.ceil(yLoS / nice) * nice; v <= yHiS; v += nice) {
      yTicksArr.push(parseFloat(v.toFixed(2)))
    }

    const xTicksArr = xHi > xLo
      ? Array.from({ length: 7 }, (_, i) => new Date(xLo + (i / 6) * xRange))
      : [new Date(xLo)]

    return {
      path: buildPath(sorted, metricKey, sx, sy, gapMs),
      yMin: yLoS, yMax: yHiS, xMin: xLo, xMax: xHi,
      yTicks: yTicksArr, xTicks: xTicksArr, cW, cH,
    }
  }, [sorted, metricKey])

  const { path, yMin, yMax, xMin, xMax, yTicks, xTicks, cW, cH } = computed

  function sxVal(t: number) { return PAD.left + ((t - xMin) / (xMax - xMin || 1)) * cW }
  function syVal(v: number) { return PAD.top + cH - ((v - yMin) / (yMax - yMin || 1)) * cH }

  function handlePointer(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current || !sorted.length) return
    const rect = svgRef.current.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const mouseTime = xMin + ((mx - PAD.left) / cW) * (xMax - xMin)
    let best: SensorReadingChart | null = null
    let bestDist = Infinity
    for (const r of sorted) {
      const dist = Math.abs(new Date(r.timestamp).getTime() - mouseTime)
      if (dist < bestDist) { bestDist = dist; best = r }
    }
    if (!best) return
    const v = best[metricKey]
    if (v === null) return
    const t = new Date(best.timestamp).getTime()
    setTooltip({
      x: sxVal(t),
      y: syVal(v),
      value: v,
      time: new Date(best.timestamp).toLocaleString(undefined, {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      }),
    })
  }

  if (isLoading) {
    return (
      <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5" aria-hidden="true">
        <div className="mb-4 h-4 w-32 rounded-full bg-slate-200" />
        <div className="h-[260px] rounded-xl bg-slate-100" />
      </div>
    )
  }

  if (!sorted.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-midnight font-display">{cfg.label} — Historical</h3>
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
          <span className="text-xs font-normal text-storm/40">({sorted.length} readings)</span>
        </h3>
        <span className="inline-flex items-center gap-1 text-[10px] text-storm/50">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: cfg.color }} aria-hidden="true" />
          {cfg.label}
        </span>
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
                <line x1={x} y1={PAD.top} x2={x} y2={PAD.top + cH} stroke="#F1F5F9" strokeWidth="0.5" />
                <text x={x} y={SVG_H - 8} textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'} fontSize="10" fill="#94A3B8">{label}</text>
              </g>
            )
          })}
          <text x={14} y={PAD.top + cH / 2} textAnchor="middle" fontSize="10" fill="#94A3B8" transform={`rotate(-90, 14, ${PAD.top + cH / 2})`}>
            {cfg.unit}
          </text>
          {path && (
            <path d={path} fill="none" stroke={cfg.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          )}
          {tooltip && (
            <line x1={tooltip.x} y1={PAD.top} x2={tooltip.x} y2={PAD.top + cH} stroke="#94A3B8" strokeWidth="0.5" strokeDasharray="3,3" />
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
              <span className="text-sm font-bold text-midnight font-display">
                {tooltip.value}{cfg.unit}
              </span>
              <p className="text-[10px] text-storm/40">{tooltip.time}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
