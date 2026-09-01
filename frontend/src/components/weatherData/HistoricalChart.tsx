import { useMemo, useRef, useState } from 'react'
import type { SensorMetricKey, SensorReadingChart } from '../../types'
import { SENSOR_METRIC_CONFIG } from '../../types'

const SVG_W = 800
const SVG_H = 320

interface HistoricalChartProps {
  readings: SensorReadingChart[]
  metricKey: SensorMetricKey
  stationName?: string
  isLoading?: boolean
}

interface TooltipData {
  x: number
  y: number
  value?: number
  tempValue?: number | null
  humValue?: number | null
  time: string
}

function buildSeg(
  readings: SensorReadingChart[],
  key: keyof SensorReadingChart,
  from: number,
  to: number,
  sx: (t: number) => number,
  sy: (v: number) => number,
): string {
  const pts: string[] = []
  for (let i = from; i < to; i++) {
    const v = readings[i][key]
    if (typeof v !== 'number' || v === null || Number.isNaN(v)) continue
    pts.push(`${sx(new Date(readings[i].timestamp).getTime())},${sy(v)}`)
  }
  return pts.length ? `M ${pts.join(' L ')}` : ''
}

function buildPath(
  sorted: SensorReadingChart[],
  key: keyof SensorReadingChart,
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

function computeTicks(yLoS: number, yHiS: number) {
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
  return yTicksArr
}

export function HistoricalChart({ readings, metricKey, stationName, isLoading }: HistoricalChartProps) {
  const cfg = SENSOR_METRIC_CONFIG[metricKey]
  const isAtmospheric = metricKey === 'atmospheric'
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const pad = useMemo(() => ({
    top: 24,
    bottom: 52,
    left: 55,
    right: isAtmospheric ? 55 : 24,
  }), [isAtmospheric])

  const sorted = useMemo(
    () => [...readings].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
    [readings],
  )

  const computed = useMemo(() => {
    const cW = SVG_W - pad.left - pad.right
    const cH = SVG_H - pad.top - pad.bottom

    if (!sorted.length) {
      return {
        path: '', areaPath: '', tempPath: '', tempAreaPath: '', humPath: '', humAreaPath: '',
        yMin: 0, yMax: 1, xMin: 0, xMax: 1, yTicks: [], xTicks: [], yTicksTemp: [], yTicksHum: [],
        cW, cH,
        sx: (_t: number) => 0, sy: (_v: number) => 0, syTemp: (_v: number) => 0, syHum: (_v: number) => 0,
      }
    }

    let xLo = Infinity, xHi = -Infinity
    for (const r of sorted) {
      const t = new Date(r.timestamp).getTime()
      if (t < xLo) xLo = t
      if (t > xHi) xHi = t
    }
    const xRange = xHi - xLo || 1
    const sx = (t: number) => pad.left + ((t - xLo) / xRange) * cW
    const gapMs = (sorted.length > 1 ? (xHi - xLo) / sorted.length : 3 * 60 * 60 * 1000) * 2.5

    const xTicksArr = xHi > xLo
      ? Array.from({ length: 7 }, (_, i) => new Date(xLo + (i / 6) * xRange))
      : [new Date(xLo)]

    if (isAtmospheric) {
      // Dual-metric: Temperature & Humidity
      let tLo = Infinity, tHi = -Infinity
      let hLo = Infinity, hHi = -Infinity

      for (const r of sorted) {
        if (r.temperature !== null && typeof r.temperature === 'number') {
          if (r.temperature < tLo) tLo = r.temperature
          if (r.temperature > tHi) tHi = r.temperature
        }
        if (r.humidity !== null && typeof r.humidity === 'number') {
          if (r.humidity < hLo) hLo = r.humidity
          if (r.humidity > hHi) hHi = r.humidity
        }
      }

      if (!isFinite(tLo)) { tLo = 0; tHi = 40 }
      if (!isFinite(hLo)) { hLo = 0; hHi = 100 }

      const tPad = (tHi - tLo) * 0.1 || 2
      const tLoS = tLo - tPad
      const tHiS = tHi + tPad

      const hPad = (hHi - hLo) * 0.1 || 5
      const hLoS = Math.max(0, hLo - hPad)
      const hHiS = Math.min(100, hHi + hPad)

      const syTemp = (v: number) => pad.top + cH - ((v - tLoS) / (tHiS - tLoS || 1)) * cH
      const syHum = (v: number) => pad.top + cH - ((v - hLoS) / (hHiS - hLoS || 1)) * cH

      const tempPath = buildPath(sorted, 'temperature', sx, syTemp, gapMs)
      const humPath = buildPath(sorted, 'humidity', sx, syHum, gapMs)

      const bottomY = pad.top + cH
      let tempAreaPath = ''
      let humAreaPath = ''

      const firstTemp = sorted.find((r) => r.temperature !== null)
      const lastTemp = [...sorted].reverse().find((r) => r.temperature !== null)
      if (tempPath && firstTemp && lastTemp) {
        const x1 = sx(new Date(firstTemp.timestamp).getTime())
        const x2 = sx(new Date(lastTemp.timestamp).getTime())
        tempAreaPath = `${tempPath} L ${x2},${bottomY} L ${x1},${bottomY} Z`
      }

      const firstHum = sorted.find((r) => r.humidity !== null)
      const lastHum = [...sorted].reverse().find((r) => r.humidity !== null)
      if (humPath && firstHum && lastHum) {
        const x1 = sx(new Date(firstHum.timestamp).getTime())
        const x2 = sx(new Date(lastHum.timestamp).getTime())
        humAreaPath = `${humPath} L ${x2},${bottomY} L ${x1},${bottomY} Z`
      }

      const yTicksTemp = computeTicks(tLoS, tHiS)
      const yTicksHum = computeTicks(hLoS, hHiS)

      return {
        path: '', areaPath: '', tempPath, tempAreaPath, humPath, humAreaPath,
        yMin: tLoS, yMax: tHiS, xMin: xLo, xMax: xHi,
        yTicks: [], xTicks: xTicksArr, yTicksTemp, yTicksHum,
        cW, cH, sx, sy: syTemp, syTemp, syHum,
      }
    }

    // Single-metric computation
    let yLo = Infinity, yHi = -Infinity
    for (const r of sorted) {
      const v = r[metricKey]
      if (v !== null && typeof v === 'number') {
        if (v < yLo) yLo = v
        if (v > yHi) yHi = v
      }
    }

    if (!isFinite(yLo)) { yLo = 0; yHi = 1 }
    const yPad = (yHi - yLo) * 0.1 || 5
    const yLoS = yLo - yPad
    const yHiS = yHi + yPad

    const sy = (v: number) => pad.top + cH - ((v - yLoS) / (yHiS - yLoS || 1)) * cH
    const path = buildPath(sorted, metricKey, sx, sy, gapMs)

    let areaPath = ''
    if (path) {
      const bottomY = pad.top + cH
      const firstNonNull = sorted.find((r) => r[metricKey] !== null)
      const lastNonNull = [...sorted].reverse().find((r) => r[metricKey] !== null)
      if (firstNonNull && lastNonNull) {
        const x1 = sx(new Date(firstNonNull.timestamp).getTime())
        const x2 = sx(new Date(lastNonNull.timestamp).getTime())
        areaPath = `${path} L ${x2},${bottomY} L ${x1},${bottomY} Z`
      }
    }

    const yTicksArr = computeTicks(yLoS, yHiS)

    return {
      path, areaPath, tempPath: '', tempAreaPath: '', humPath: '', humAreaPath: '',
      yMin: yLoS, yMax: yHiS, xMin: xLo, xMax: xHi,
      yTicks: yTicksArr, xTicks: xTicksArr, yTicksTemp: [], yTicksHum: [],
      cW, cH, sx, sy, syTemp: sy, syHum: sy,
    }
  }, [sorted, metricKey, isAtmospheric, pad])

  const {
    path, areaPath, tempPath, tempAreaPath, humPath, humAreaPath,
    xMin, xMax, yTicks, xTicks, yTicksTemp, yTicksHum, cW, cH, sx, sy, syTemp, syHum,
  } = computed

  function handlePointer(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current || !sorted.length) return
    const rect = svgRef.current.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const mouseTime = xMin + ((mx - pad.left) / cW) * (xMax - xMin)
    let best: SensorReadingChart | null = null
    let bestDist = Infinity
    for (const r of sorted) {
      const dist = Math.abs(new Date(r.timestamp).getTime() - mouseTime)
      if (dist < bestDist) { bestDist = dist; best = r }
    }
    if (!best) return
    const t = new Date(best.timestamp).getTime()

    if (isAtmospheric) {
      const tempV = best.temperature
      const humV = best.humidity
      if (tempV === null && humV === null) return
      setTooltip({
        x: sx(t),
        y: tempV !== null ? syTemp(tempV) : pad.top + cH / 2,
        tempValue: tempV,
        humValue: humV,
        time: new Date(best.timestamp).toLocaleString(undefined, {
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
        }),
      })
    } else {
      const v = best[metricKey]
      if (v === null || typeof v !== 'number') return
      setTooltip({
        x: sx(t),
        y: sy(v),
        value: v,
        time: new Date(best.timestamp).toLocaleString(undefined, {
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
        }),
      })
    }
  }

  const titleText = stationName
    ? `${cfg.label} of ${stationName}`
    : `${cfg.label} — Historical`

  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-5" aria-hidden="true">
        <div className="mb-4 h-4 w-48 rounded-full bg-slate-200 skeleton-shimmer" />
        <div className="h-[270px] rounded-xl bg-slate-50 skeleton-shimmer" />
      </div>
    )
  }

  if (!sorted.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-midnight font-display">
          {titleText}
        </h3>
        <div className="flex h-[260px] items-center justify-center rounded-xl bg-slate-50">
          <p className="text-sm text-storm/40">No readings available for this selection</p>
        </div>
      </div>
    )
  }

  const gradientId = `grad-${metricKey}`

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-shadow duration-300 hover:shadow-xs">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-midnight font-display">
          {titleText}{' '}
          <span className="text-xs font-normal text-storm/40">({sorted.length} readings)</span>
        </h3>

        {/* Legend */}
        {isAtmospheric ? (
          <div className="flex items-center gap-3 text-[11px] font-medium text-storm/60">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-[#F97316]" aria-hidden="true" />
              <span>Temperature (°C)</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-[#0EA5E9]" aria-hidden="true" />
              <span>Humidity (%)</span>
            </span>
          </div>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-storm/50">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: cfg.color }} aria-hidden="true" />
            {cfg.label} ({cfg.unit})
          </span>
        )}
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
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={cfg.color} stopOpacity="0.2" />
              <stop offset="100%" stopColor={cfg.color} stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="grad-temp" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F97316" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#F97316" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="grad-hum" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0EA5E9" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#0EA5E9" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Grid lines and Left Y-Axis */}
          {isAtmospheric ? (
            <>
              {yTicksTemp.map((v) => {
                const y = syTemp(v)
                return (
                  <g key={`temp-${v}`}>
                    <line x1={pad.left} y1={y} x2={SVG_W - pad.right} y2={y} stroke="#F1F5F9" strokeWidth="0.5" />
                    <text x={pad.left - 8} y={y + 3} textAnchor="end" fontSize="10" fill="#F97316" fontFamily="Inter, sans-serif" fontWeight="500">
                      {v}°C
                    </text>
                  </g>
                )
              })}
              {yTicksHum.map((v) => {
                const y = syHum(v)
                return (
                  <g key={`hum-${v}`}>
                    <text x={SVG_W - pad.right + 8} y={y + 3} textAnchor="start" fontSize="10" fill="#0EA5E9" fontFamily="Inter, sans-serif" fontWeight="500">
                      {v}%
                    </text>
                  </g>
                )
              })}
            </>
          ) : (
            yTicks.map((v) => {
              const y = sy(v)
              return (
                <g key={v}>
                  <line x1={pad.left} y1={y} x2={SVG_W - pad.right} y2={y} stroke="#F1F5F9" strokeWidth="0.5" />
                  <text x={pad.left - 8} y={y + 3} textAnchor="end" fontSize="10" fill="#94A3B8" fontFamily="Inter, sans-serif">
                    {v}
                  </text>
                </g>
              )
            })
          )}

          {/* X-Axis Ticks */}
          {xTicks.map((d, i) => {
            const x = sx(d.getTime())
            const label = d.toLocaleString(undefined, { month: 'short', day: 'numeric' })
            return (
              <g key={i}>
                <line x1={x} y1={pad.top} x2={x} y2={pad.top + cH} stroke="#F8FAFC" strokeWidth="0.5" />
                <text x={x} y={pad.top + cH + 16} textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'} fontSize="10" fill="#94A3B8" fontFamily="Inter, sans-serif">
                  {label}
                </text>
              </g>
            )
          })}

          {/* Left Y-Axis Label */}
          <text
            x={14}
            y={pad.top + cH / 2}
            textAnchor="middle"
            fontSize="10"
            fontWeight="600"
            fill={isAtmospheric ? '#F97316' : '#64748B'}
            transform={`rotate(-90, 14, ${pad.top + cH / 2})`}
            fontFamily="Inter, sans-serif"
          >
            {isAtmospheric ? 'Temperature (°C)' : `${cfg.label} (${cfg.unit})`}
          </text>

          {/* Right Y-Axis Label (if atmospheric) */}
          {isAtmospheric && (
            <text
              x={SVG_W - 14}
              y={pad.top + cH / 2}
              textAnchor="middle"
              fontSize="10"
              fontWeight="600"
              fill="#0EA5E9"
              transform={`rotate(90, ${SVG_W - 14}, ${pad.top + cH / 2})`}
              fontFamily="Inter, sans-serif"
            >
              Humidity (%)
            </text>
          )}

          {/* X-Axis Label */}
          <text
            x={pad.left + cW / 2}
            y={SVG_H - 8}
            textAnchor="middle"
            fontSize="10"
            fontWeight="600"
            fill="#64748B"
            fontFamily="Inter, sans-serif"
          >
            Timestamp / Date
          </text>

          {/* Curves & Area Fills */}
          {isAtmospheric ? (
            <>
              {/* Humidity Area & Line */}
              {humAreaPath && <path d={humAreaPath} fill="url(#grad-hum)" className="transition-opacity duration-500" />}
              {humPath && (
                <path
                  d={humPath}
                  fill="none"
                  stroke="#0EA5E9"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  className="transition-all duration-300"
                />
              )}

              {/* Temperature Area & Line */}
              {tempAreaPath && <path d={tempAreaPath} fill="url(#grad-temp)" className="transition-opacity duration-500" />}
              {tempPath && (
                <path
                  d={tempPath}
                  fill="none"
                  stroke="#F97316"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  className="transition-all duration-300"
                />
              )}
            </>
          ) : (
            <>
              {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} className="transition-opacity duration-500" />}
              {path && (
                <path
                  d={path}
                  fill="none"
                  stroke={cfg.color}
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  className="transition-all duration-300"
                />
              )}
            </>
          )}

          {/* Tooltip guidelines / dots */}
          {tooltip && (
            <>
              <line x1={tooltip.x} y1={pad.top} x2={tooltip.x} y2={pad.top + cH} stroke="#CBD5E1" strokeWidth="0.5" strokeDasharray="3,3" />
              {isAtmospheric ? (
                <>
                  {tooltip.tempValue != null && (
                    <circle cx={tooltip.x} cy={syTemp(tooltip.tempValue)} r="4" fill="#F97316" stroke="white" strokeWidth="2" />
                  )}
                  {tooltip.humValue != null && (
                    <circle cx={tooltip.x} cy={syHum(tooltip.humValue)} r="4" fill="#0EA5E9" stroke="white" strokeWidth="2" />
                  )}
                </>
              ) : (
                <circle cx={tooltip.x} cy={tooltip.y} r="4" fill={cfg.color} stroke="white" strokeWidth="2" />
              )}
            </>
          )}
        </svg>

        {/* Floating Tooltip Box */}
        {tooltip && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2"
            style={{
              left: `${(tooltip.x / SVG_W) * 100}%`,
              top: `${Math.min(tooltip.y / SVG_H, 0.78) * 100}%`,
            }}
          >
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-elevation-3 -translate-y-full">
              {isAtmospheric ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-storm/60">Temperature:</span>
                    <span className="text-xs font-bold text-[#F97316] font-mono">
                      {tooltip.tempValue != null ? `${tooltip.tempValue} °C` : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-storm/60">Humidity:</span>
                    <span className="text-xs font-bold text-[#0EA5E9] font-mono">
                      {tooltip.humValue != null ? `${tooltip.humValue} %` : '—'}
                    </span>
                  </div>
                </div>
              ) : (
                <span className="text-sm font-bold text-midnight font-display">
                  {tooltip.value} {cfg.unit}
                </span>
              )}
              <p className="mt-1 text-[10px] text-storm/40">{tooltip.time}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
