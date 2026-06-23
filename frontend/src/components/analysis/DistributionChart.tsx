import { useMemo } from 'react'
import type { HistoricalReading, SensorType } from '../../services/api'
import { SENSOR_CONFIG } from '../../services/api'

const PAD = { top: 20, bottom: 40, left: 55, right: 20 }
const SVG_W = 600
const SVG_H = 350

const EXPECTED_RANGES: Partial<Record<SensorType, { min: number; max: number }>> = {
  temperature: { min: 10, max: 40 },
  humidity: { min: 20, max: 90 },
  rainfall: { min: 0, max: 50 },
  wind_speed: { min: 0, max: 20 },
  wind_direction: { min: 0, max: 360 },
  atmospheric_pressure: { min: 990, max: 1040 },
  solar_radiation: { min: 0, max: 1000 },
}

interface DistributionChartProps {
  readings: HistoricalReading[]
  sensorType: SensorType
  isLoading?: boolean
}

export function DistributionChart({ readings, sensorType, isLoading }: DistributionChartProps) {
  const cfg = SENSOR_CONFIG[sensorType]

  const { bins, binWidth, rangeMin, rangeMax, total } = useMemo(() => {
    if (!readings.length) return { bins: [] as { x0: number; count: number }[], binWidth: 0, rangeMin: 0, rangeMax: 0, total: 0 }

    const values = readings.map((r) => r.value)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min || 1
    const binCount = Math.min(15, Math.max(5, Math.round(Math.sqrt(values.length))))
    const width = range / binCount
    const result = Array.from({ length: binCount }, (_, i) => ({
      x0: min + i * width,
      count: 0,
    }))
    for (const v of values) {
      const idx = Math.min(binCount - 1, Math.floor((v - min) / width))
      result[idx].count++
    }
    return { bins: result, binWidth: width, rangeMin: min, rangeMax: max, total: values.length }
  }, [readings])

  const maxCount = Math.max(...bins.map((b) => b.count), 1)
  const expectedRange = EXPECTED_RANGES[sensorType]

  const chartW = SVG_W - PAD.left - PAD.right
  const chartH = SVG_H - PAD.top - PAD.bottom

  const yTicks = useMemo(() => {
    const rough = maxCount / 5
    const mag = Math.pow(10, Math.floor(Math.log10(rough || 1)))
    const res = rough / mag
    let nice = mag
    if (res > 1.5) nice = 2 * mag
    if (res > 3.5) nice = 5 * mag
    if (res > 7.5) nice = 10 * mag
    const start = 0
    const ticks: number[] = []
    for (let v = start; v <= maxCount; v += nice) ticks.push(v)
    return ticks
  }, [maxCount])

  function barX(v: number) { return PAD.left + ((v - (rangeMin - binWidth * 0.1)) / (rangeMax - rangeMin + binWidth * 0.2)) * chartW }

  if (isLoading) {
    return (
      <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5" aria-hidden="true">
        <div className="mb-4 h-4 w-36 rounded-full bg-slate-200" />
        <div className="h-[300px] rounded-xl bg-slate-100" />
      </div>
    )
  }

  if (!bins.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-midnight font-display">{cfg.label} — Distribution</h3>
        <div className="flex h-[300px] items-center justify-center rounded-xl bg-slate-50">
          <p className="text-sm text-storm/40">No readings available for this selection</p>
        </div>
      </div>
    )
  }

  const expectedMinX = expectedRange ? barX(expectedRange.min) : null
  const expectedMaxX = expectedRange ? barX(expectedRange.max) : null

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-midnight font-display">
          {cfg.label} — Distribution{' '}
          <span className="text-xs font-normal text-storm/40">({total} readings · {bins.length} bins)</span>
        </h3>
        {expectedRange && (
          <span className="text-[10px] text-emerald-600">Expected range: {expectedRange.min}–{expectedRange.max}{cfg.unit}</span>
        )}
      </div>

      <div className="relative" style={{ maxWidth: '100%' }}>
        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full select-none" style={{ height: 'auto' }}
          role="img" aria-label={`Histogram of ${cfg.label} readings`}>
          {yTicks.map((v) => {
            const y = PAD.top + chartH - (v / maxCount) * chartH
            return (
              <g key={v}>
                <line x1={PAD.left} y1={y} x2={SVG_W - PAD.right} y2={y} stroke="#E2E8F0" strokeWidth="0.5" />
                <text x={PAD.left - 8} y={y + 3} textAnchor="end" fontSize="10" fill="#94A3B8">{v}</text>
              </g>
            )
          })}

          <text x={PAD.left + chartW / 2} y={SVG_H - 6} textAnchor="middle" fontSize="10" fill="#94A3B8">{cfg.label} ({cfg.unit})</text>

          {/* Expected range band */}
          {expectedRange && expectedMinX !== null && expectedMaxX !== null && (
            <rect x={expectedMinX} y={PAD.top} width={expectedMaxX - expectedMinX} height={chartH} fill="#22C55E" opacity="0.08" rx="2" aria-label={`Expected range: ${expectedRange.min}–${expectedRange.max}${cfg.unit}`} />
          )}

          {/* Grid line for expected min/max */}
          {expectedRange && (
            <>
              {expectedMinX !== null && <line x1={expectedMinX} y1={PAD.top} x2={expectedMinX} y2={PAD.top + chartH} stroke="#22C55E" strokeWidth="0.5" strokeDasharray="3,2" />}
              {expectedMaxX !== null && <line x1={expectedMaxX} y1={PAD.top} x2={expectedMaxX} y2={PAD.top + chartH} stroke="#22C55E" strokeWidth="0.5" strokeDasharray="3,2" />}
            </>
          )}

          {/* Bars */}
          {bins.map((bin, i) => {
            const x = barX(bin.x0)
            const w = Math.max(1, barX(bin.x0 + binWidth) - x - 1)
            const h = (bin.count / maxCount) * chartH
            const y = PAD.top + chartH - h
            const outsideRange = expectedRange && (bin.x0 + binWidth < expectedRange.min || bin.x0 > expectedRange.max)
            return (
              <g key={i}>
                <rect x={x} y={y} width={w} height={h} fill={outsideRange ? '#F59E0B' : '#0EA5E9'} opacity="0.7" rx="1" aria-label={`${bin.x0.toFixed(1)}–${(bin.x0 + binWidth).toFixed(1)}: ${bin.count}`} />
              </g>
            )
          })}

          {/* X-axis labels (show a subset) */}
          {bins.filter((_, i) => i % Math.max(1, Math.floor(bins.length / 6)) === 0).map((bin, _, arr) => {
            const x = barX(bin.x0 + binWidth / 2)
            const label = arr.length > 1 ? bin.x0.toFixed(0) : ''
            return label ? <text key={bin.x0} x={x} y={SVG_H - 22} textAnchor="middle" fontSize="9" fill="#94A3B8">{label}</text> : null
          })}
        </svg>
      </div>
    </div>
  )
}
