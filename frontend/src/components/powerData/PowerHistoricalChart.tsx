import { useMemo, useRef, useState } from 'react'
import type { PowerChart, PowerMetricKey } from '../../types'
import { POWER_METRIC_CONFIG } from '../../types'

const PAD = { top: 24, bottom: 52, left: 55, right: 24 }
const SVG_W = 800
const SVG_H = 320

interface PowerHistoricalChartProps {
  readings: PowerChart[]
  primaryKey: PowerMetricKey
  secondaryKey?: PowerMetricKey | null
  showSecondary?: boolean
  onToggleSecondary?: () => void
  stationName?: string
  isLoading?: boolean
}

interface TooltipData {
  x: number
  y: number
  items: { label: string; value: number | null; unit: string; color: string }[]
  time: string
}

function buildSeg(
  readings: PowerChart[],
  key: keyof PowerChart,
  from: number,
  to: number,
  sx: (t: number) => number,
  sy: (v: number) => number,
): string {
  const pts: string[] = []
  for (let i = from; i < to; i++) {
    const v = readings[i][key]
    if (typeof v !== 'number' || isNaN(v)) continue
    pts.push(`${sx(new Date(readings[i].timestamp).getTime())},${sy(v)}`)
  }
  return pts.length ? `M ${pts.join(' L ')}` : ''
}

function buildPath(
  sorted: PowerChart[],
  key: keyof PowerChart,
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

export function PowerHistoricalChart({
  readings,
  primaryKey,
  secondaryKey,
  showSecondary,
  onToggleSecondary,
  stationName,
  isLoading,
}: PowerHistoricalChartProps) {
  const cfg = POWER_METRIC_CONFIG[primaryKey]
  const secondaryCfg = secondaryKey ? POWER_METRIC_CONFIG[secondaryKey] : null
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const isBatteryDynamics = primaryKey === 'battery_dynamics'
  const isSolarDynamics = primaryKey === 'solar_dynamics'

  const sorted = useMemo(
    () => [...readings].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
    [readings],
  )

  const computed = useMemo(() => {
    const cW = SVG_W - PAD.left - PAD.right
    const cH = SVG_H - PAD.top - PAD.bottom

    if (!sorted.length) {
      return { paths: [], yMin: 0, yMax: 1, xMin: 0, xMax: 1, yTicks: [], xTicks: [], cW, cH }
    }

    let yLo = Infinity, yHi = -Infinity
    let xLo = Infinity, xHi = -Infinity

    let targetKeys: (keyof PowerChart)[] = []
    if (isBatteryDynamics) {
      targetKeys = ['volt_batt', 'curr_batt', 'battery_temp']
    } else if (isSolarDynamics) {
      targetKeys = ['volt_solar', 'curr_solar']
    } else {
      targetKeys = [primaryKey, ...(showSecondary && secondaryKey ? [secondaryKey] : [])]
    }

    for (const r of sorted) {
      const t = new Date(r.timestamp).getTime()
      if (t < xLo) xLo = t
      if (t > xHi) xHi = t
      for (const k of targetKeys) {
        const v = r[k]
        if (typeof v === 'number' && !isNaN(v)) {
          if (v < yLo) yLo = v
          if (v > yHi) yHi = v
        }
      }
    }

    if (!isFinite(yLo)) { yLo = 0; yHi = 1 }
    const yPad = (yHi - yLo) * 0.1 || 1
    const yLoS = yLo - yPad
    const yHiS = yHi + yPad
    const xRange = xHi - xLo || 1

    const sx = (t: number) => PAD.left + ((t - xLo) / xRange) * cW
    const sy = (v: number) => PAD.top + cH - ((v - yLoS) / (yHiS - yLoS)) * cH

    const gapMs = (sorted.length > 1 ? (xHi - xLo) / sorted.length : 3 * 60 * 60 * 1000) * 2.5

    const paths: { key: keyof PowerChart; path: string; color: string; label: string; unit: string; fill?: boolean }[] = []

    if (isBatteryDynamics) {
      paths.push({
        key: 'volt_batt',
        path: buildPath(sorted, 'volt_batt', sx, sy, gapMs),
        color: '#0EA5E9',
        label: 'Battery Voltage',
        unit: 'V',
      })
      paths.push({
        key: 'curr_batt',
        path: buildPath(sorted, 'curr_batt', sx, sy, gapMs),
        color: '#F97316',
        label: 'Battery Current',
        unit: 'A',
      })
      paths.push({
        key: 'battery_temp',
        path: buildPath(sorted, 'battery_temp', sx, sy, gapMs),
        color: '#EF4444',
        label: 'Battery Temp',
        unit: '°C',
      })
    } else if (isSolarDynamics) {
      paths.push({
        key: 'volt_solar',
        path: buildPath(sorted, 'volt_solar', sx, sy, gapMs),
        color: '#F59E0B',
        label: 'Solar Voltage',
        unit: 'V',
      })
      paths.push({
        key: 'curr_solar',
        path: buildPath(sorted, 'curr_solar', sx, sy, gapMs),
        color: '#EAB308',
        label: 'Solar Current',
        unit: 'A',
      })
    } else {
      paths.push({
        key: primaryKey,
        path: buildPath(sorted, primaryKey, sx, sy, gapMs),
        color: cfg.color,
        label: cfg.label,
        unit: cfg.unit,
        fill: true,
      })
      if (showSecondary && secondaryKey && secondaryCfg) {
        paths.push({
          key: secondaryKey,
          path: buildPath(sorted, secondaryKey, sx, sy, gapMs),
          color: secondaryCfg.color,
          label: secondaryCfg.label,
          unit: secondaryCfg.unit,
        })
      }
    }

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
      paths,
      yMin: yLoS, yMax: yHiS, xMin: xLo, xMax: xHi,
      yTicks: yTicksArr, xTicks: xTicksArr, cW, cH,
    }
  }, [sorted, primaryKey, secondaryKey, showSecondary, isBatteryDynamics, isSolarDynamics, cfg, secondaryCfg])

  const { paths, yMin, yMax, xMin, xMax, yTicks, xTicks, cW, cH } = computed

  function sxVal(t: number) { return PAD.left + ((t - xMin) / (xMax - xMin || 1)) * cW }
  function syVal(v: number) { return PAD.top + cH - ((v - yMin) / (yMax - yMin || 1)) * cH }

  function handlePointer(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current || !sorted.length) return
    const rect = svgRef.current.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const mouseTime = xMin + ((mx - PAD.left) / cW) * (xMax - xMin)
    let best: PowerChart | null = null
    let bestDist = Infinity
    for (const r of sorted) {
      const dist = Math.abs(new Date(r.timestamp).getTime() - mouseTime)
      if (dist < bestDist) { bestDist = dist; best = r }
    }
    if (!best) return

    const items: TooltipData['items'] = []
    if (isBatteryDynamics) {
      items.push({ label: 'Battery Voltage', value: best.volt_batt, unit: 'V', color: '#0EA5E9' })
      items.push({ label: 'Battery Current', value: best.curr_batt, unit: 'A', color: '#F97316' })
      items.push({ label: 'Battery Temp', value: best.battery_temp, unit: '°C', color: '#EF4444' })
    } else if (isSolarDynamics) {
      items.push({ label: 'Solar Voltage', value: best.volt_solar, unit: 'V', color: '#F59E0B' })
      items.push({ label: 'Solar Current', value: best.curr_solar, unit: 'A', color: '#EAB308' })
    } else {
      const pv = best[primaryKey]
      if (typeof pv === 'number') {
        items.push({ label: cfg.label, value: pv, unit: cfg.unit, color: cfg.color })
      }
      if (showSecondary && secondaryKey && secondaryCfg) {
        const sv = best[secondaryKey]
        if (typeof sv === 'number') {
          items.push({ label: secondaryCfg.label, value: sv, unit: secondaryCfg.unit, color: secondaryCfg.color })
        }
      }
    }

    if (!items.length) return
    const t = new Date(best.timestamp).getTime()
    const firstVal = items.find((it) => it.value !== null)?.value
    setTooltip({
      x: sxVal(t),
      y: firstVal !== undefined && firstVal !== null ? syVal(firstVal) : PAD.top + cH / 2,
      items,
      time: new Date(best.timestamp).toLocaleString(undefined, {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      }),
    })
  }

  const titleText = stationName
    ? `${cfg.label} of ${stationName}`
    : `${cfg.label} — Historical`

  const yAxisLabel = isBatteryDynamics
    ? 'Battery Voltage (V) / Current (A) / Temp (°C)'
    : isSolarDynamics
    ? 'Solar Voltage (V) / Current (A)'
    : `${cfg.label} (${cfg.unit})`

  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-5" aria-hidden="true">
        <div className="mb-4 h-4 w-32 rounded-full bg-slate-200 skeleton-shimmer" />
        <div className="h-[270px] rounded-xl bg-slate-50 skeleton-shimmer" />
      </div>
    )
  }

  if (!sorted.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-midnight font-display">{titleText}</h3>
        <div className="flex h-[260px] items-center justify-center rounded-xl bg-slate-50">
          <p className="text-sm text-storm/40">No readings available for this selection</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-shadow duration-300 hover:shadow-xs">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-midnight font-display">
          {titleText}{' '}
          <span className="text-xs font-normal text-storm/40">({sorted.length} readings)</span>
        </h3>
        <div className="flex flex-wrap items-center gap-3">
          {isBatteryDynamics ? (
            <>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-storm/70">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#0EA5E9' }} aria-hidden="true" />
                Battery Voltage (V)
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-storm/70">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#F97316' }} aria-hidden="true" />
                Battery Current (A)
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-storm/70">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#EF4444' }} aria-hidden="true" />
                Battery Temp (°C)
              </span>
            </>
          ) : isSolarDynamics ? (
            <>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-storm/70">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#F59E0B' }} aria-hidden="true" />
                Solar Voltage (V)
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-storm/70">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#EAB308' }} aria-hidden="true" />
                Solar Current (A)
              </span>
            </>
          ) : (
            <>
              {secondaryCfg && (
                <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] text-storm/60 hover:text-storm">
                  <input
                    type="checkbox"
                    checked={showSecondary ?? false}
                    onChange={onToggleSecondary}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-midnight focus:ring-1 focus:ring-sky-soft cursor-pointer"
                  />
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: secondaryCfg.color }} aria-hidden="true" />
                    {secondaryCfg.label}
                  </span>
                </label>
              )}
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-storm/50">
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: cfg.color }} aria-hidden="true" />
                {cfg.label} ({cfg.unit})
              </span>
            </>
          )}
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
          <defs>
            <linearGradient id={`grad-power-${primaryKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={cfg.color} stopOpacity="0.15" />
              <stop offset="100%" stopColor={cfg.color} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {yTicks.map((v) => {
            const y = syVal(v)
            return (
              <g key={v}>
                <line x1={PAD.left} y1={y} x2={SVG_W - PAD.right} y2={y} stroke="#F1F5F9" strokeWidth="0.5" />
                <text x={PAD.left - 8} y={y + 3} textAnchor="end" fontSize="10" fill="#94A3B8" fontFamily="Inter, sans-serif">{v}</text>
              </g>
            )
          })}
          {xTicks.map((d, i) => {
            const x = sxVal(d.getTime())
            const label = d.toLocaleString(undefined, { month: 'short', day: 'numeric' })
            return (
              <g key={i}>
                <line x1={x} y1={PAD.top} x2={x} y2={PAD.top + cH} stroke="#F8FAFC" strokeWidth="0.5" />
                <text x={x} y={PAD.top + cH + 16} textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'} fontSize="10" fill="#94A3B8" fontFamily="Inter, sans-serif">{label}</text>
              </g>
            )
          })}

          {/* Left Y-Axis Label */}
          <text
            x={14}
            y={PAD.top + cH / 2}
            textAnchor="middle"
            fontSize="10"
            fontWeight="600"
            fill="#64748B"
            transform={`rotate(-90, 14, ${PAD.top + cH / 2})`}
            fontFamily="Inter, sans-serif"
          >
            {yAxisLabel}
          </text>

          {/* X-Axis Label */}
          <text
            x={PAD.left + cW / 2}
            y={SVG_H - 8}
            textAnchor="middle"
            fontSize="10"
            fontWeight="600"
            fill="#64748B"
            fontFamily="Inter, sans-serif"
          >
            Timestamp / Date
          </text>

          {paths.map((p) => (
            <g key={String(p.key)}>
              {p.fill && p.path && (
                (() => {
                  const firstPt = p.path.match(/M\s+([\d.]+),/)?.[1]
                  const lastPt = [...p.path.matchAll(/([\d.]+),[\d.]+(?:\s|$)/g)].pop()?.[1]
                  const bottomY = PAD.top + cH
                  const areaPath = firstPt && lastPt
                    ? `${p.path} L ${lastPt},${bottomY} L ${firstPt},${bottomY} Z`
                    : ''
                  return areaPath ? <path d={areaPath} fill={`url(#grad-power-${primaryKey})`} /> : null
                })()
              )}
              {p.path && (
                <path
                  d={p.path}
                  fill="none"
                  stroke={p.color}
                  strokeWidth="2.25"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}
            </g>
          ))}

          {tooltip && (
            <>
              <line x1={tooltip.x} y1={PAD.top} x2={tooltip.x} y2={PAD.top + cH} stroke="#CBD5E1" strokeWidth="0.5" strokeDasharray="3,3" />
              {tooltip.items.map((it) => (
                it.value !== null && typeof it.value === 'number' ? (
                  <circle
                    key={it.label}
                    cx={tooltip.x}
                    cy={syVal(it.value)}
                    r="4"
                    fill={it.color}
                    stroke="white"
                    strokeWidth="2"
                  />
                ) : null
              ))}
            </>
          )}
        </svg>

        {tooltip && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2"
            style={{
              left: `${(tooltip.x / SVG_W) * 100}%`,
              top: `${Math.min(tooltip.y / SVG_H, 0.78) * 100}%`,
            }}
          >
            <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-elevation-3 -translate-y-full min-w-[160px]">
              <p className="mb-1 text-[10px] font-medium text-storm/40">{tooltip.time}</p>
              <div className="space-y-1">
                {tooltip.items.map((it) => (
                  <div key={it.label} className="flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: it.color }} />
                      <span className="font-medium text-storm/70">{it.label}:</span>
                    </div>
                    <span className="font-bold text-midnight font-display tabular-nums">
                      {it.value != null ? `${it.value} ${it.unit}` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
