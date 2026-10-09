import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { AwsReading, BenchmarkData, BenchmarkDataset, BenchmarkReading, BenchmarkStats, SensorMetricKey, Station } from '../types'
import { SENSOR_METRIC_CONFIG } from '../types'
import { deleteBenchmarkDataset, fetchBenchmarkDatasets, fetchStations, importBenchmarkCSV } from '../api/stations'
import { useBenchmarkData } from '../hooks/useBenchmarkData'
import { useAuth } from '../context/AuthContext'
import { DashboardSidebar } from '../components/dashboard/DashboardSidebar'
import { DateRangePicker } from '../components/shared/DateRangePicker'

const BENCHMARK_METRICS: SensorMetricKey[] = [
  'temperature',
  'humidity',
  'rain',
  'wind_speed',
  'wind_direction',
]
const AWS_SERIES_COLOR = '#2563EB' // Vibrant Blue
const BENCHMARK_SERIES_COLOR = '#D97706' // Warm Amber

function daysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/* ── Dual-line comparison chart (AWS vs UNMA Reference) ── */

const PAD = { top: 24, bottom: 52, left: 55, right: 24 }
const SVG_W = 800
const SVG_H = 320

interface Point {
  timestamp: string
  value: number
}

interface TooltipData {
  x: number
  awsY: number | null
  awsValue: number | null
  benchY: number | null
  benchValue: number | null
  time: string
  timeDeltaMin?: number | null
}

function buildSeg(
  points: Point[],
  from: number,
  to: number,
  sx: (t: number) => number,
  sy: (v: number) => number,
): string {
  const pts: string[] = []
  for (let i = from; i < to; i++) {
    pts.push(`${sx(new Date(points[i].timestamp).getTime())},${sy(points[i].value)}`)
  }
  return pts.length ? `M ${pts.join(' L ')}` : ''
}

function buildPath(
  sorted: Point[],
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
      segs.push(buildSeg(sorted, start, i, sx, sy))
      start = i
    }
  }
  segs.push(buildSeg(sorted, start, sorted.length, sx, sy))
  return segs.filter(Boolean).join(' ')
}

function BenchmarkChart({
  awsReadings,
  benchmarkReadings,
  metricKey,
  referenceLocation,
  stationLabel,
  resolution,
  onResolutionChange,
}: {
  awsReadings: AwsReading[]
  benchmarkReadings: BenchmarkReading[]
  metricKey: SensorMetricKey
  referenceLocation?: string
  stationLabel?: string
  resolution: 'hourly' | 'raw'
  onResolutionChange: (res: 'hourly' | 'raw') => void
}) {
  const cfg = SENSOR_METRIC_CONFIG[metricKey]
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const awsSorted = useMemo(
    () => [...awsReadings].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
    [awsReadings],
  )
  const benchSorted = useMemo(
    () => [...benchmarkReadings].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
    [benchmarkReadings],
  )

  const hasData = awsSorted.length > 0 || benchSorted.length > 0

  const computed = useMemo(() => {
    const cW = SVG_W - PAD.left - PAD.right
    const cH = SVG_H - PAD.top - PAD.bottom

    if (!hasData) {
      return { awsPath: '', benchPath: '', yMin: 0, yMax: 1, xMin: 0, xMax: 1, yTicks: [], xTicks: [], cW, cH }
    }

    let yLo = Infinity, yHi = -Infinity
    let xLo = Infinity, xHi = -Infinity

    for (const r of [...awsSorted, ...benchSorted]) {
      const t = new Date(r.timestamp).getTime()
      if (t < xLo) xLo = t
      if (t > xHi) xHi = t
      if (r.value < yLo) yLo = r.value
      if (r.value > yHi) yHi = r.value
    }

    if (!isFinite(yLo)) { yLo = 0; yHi = 1 }
    const yPad = (yHi - yLo) * 0.1 || 5
    const yLoS = yLo - yPad
    const yHiS = yHi + yPad
    const xRange = xHi - xLo || 1

    const sx = (t: number) => PAD.left + ((t - xLo) / xRange) * cW
    const sy = (v: number) => PAD.top + cH - ((v - yLoS) / (yHiS - yLoS)) * cH

    const combinedLen = awsSorted.length + benchSorted.length || 1
    const gapMs = Math.max((xRange / combinedLen) * 3, 2.5 * 3600 * 1000)

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
      awsPath: buildPath(awsSorted, sx, sy, gapMs),
      benchPath: buildPath(benchSorted, sx, sy, gapMs),
      yMin: yLoS, yMax: yHiS, xMin: xLo, xMax: xHi,
      yTicks: yTicksArr, xTicks: xTicksArr, cW, cH,
    }
  }, [awsSorted, benchSorted, hasData])

  const { awsPath, benchPath, yMin, yMax, xMin, xMax, yTicks, xTicks, cW, cH } = computed

  function sxVal(t: number) { return PAD.left + ((t - xMin) / (xMax - xMin || 1)) * cW }
  function syVal(v: number) { return PAD.top + cH - ((v - yMin) / (yMax - yMin || 1)) * cH }

  function closest(points: Point[], mouseTime: number): Point | null {
    let best: Point | null = null
    let bestDist = Infinity
    for (const p of points) {
      const dist = Math.abs(new Date(p.timestamp).getTime() - mouseTime)
      if (dist < bestDist) { bestDist = dist; best = p }
    }
    return best
  }

  function handlePointer(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current || !hasData) return
    const rect = svgRef.current.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const mouseTime = xMin + ((mx - PAD.left) / cW) * (xMax - xMin)

    const bestAws = closest(awsSorted, mouseTime)
    const bestBench = closest(benchSorted, mouseTime)
    if (!bestAws && !bestBench) return

    let refPoint: Point
    if (bestAws && bestBench) {
      const distAws = Math.abs(new Date(bestAws.timestamp).getTime() - mouseTime)
      const distBench = Math.abs(new Date(bestBench.timestamp).getTime() - mouseTime)
      refPoint = distAws <= distBench ? bestAws : bestBench
    } else {
      refPoint = (bestAws ?? bestBench)!
    }

    const refTime = new Date(refPoint.timestamp).getTime()

    // In hourly mode, readings are aligned to clock hour (±30m).
    // In raw mode, only match if the reading is genuinely at this timestamp (≤ 10m).
    const maxToleranceMs = resolution === 'hourly' ? 30 * 60 * 1000 : 10 * 60 * 1000

    const matchedAws =
      bestAws && Math.abs(new Date(bestAws.timestamp).getTime() - refTime) <= maxToleranceMs
        ? bestAws
        : null

    const matchedBench =
      bestBench && Math.abs(new Date(bestBench.timestamp).getTime() - refTime) <= maxToleranceMs
        ? bestBench
        : null

    if (!matchedAws && !matchedBench) {
      setTooltip(null)
      return
    }

    setTooltip({
      x: sxVal(refTime),
      awsY: matchedAws ? syVal(matchedAws.value) : null,
      awsValue: matchedAws ? matchedAws.value : null,
      benchY: matchedBench ? syVal(matchedBench.value) : null,
      benchValue: matchedBench ? matchedBench.value : null,
      time: new Date(refTime).toLocaleString(undefined, {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      }),
    })
  }

  if (!hasData) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-midnight font-display">
          {cfg.label}({cfg.unit}) | AWS({stationLabel || 'Station'}) vs UNMA({referenceLocation || 'Reference'})
        </h3>
        <div className="flex h-[260px] items-center justify-center rounded-xl bg-slate-50">
          <p className="text-sm text-storm/40">Data not available for selected date</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
        <div>
          <h3 className="text-sm font-semibold text-midnight font-display">
            {cfg.label}({cfg.unit}) | AWS({stationLabel || 'Station'}) vs UNMA({referenceLocation || 'Reference'})
          </h3>
          <p className="mt-0.5 text-[11px] text-storm/40">
            {resolution === 'hourly'
              ? 'Synchronized 1-hour interval ranges (nearest hour ±30m)'
              : 'Showing raw telemetry points at actual recording timestamps'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Resolution Toggle: Hourly Synchronized vs Raw */}
          <div className="flex items-center rounded-xl bg-slate-100 p-0.5 border border-slate-200/80 shadow-2xs">
            <button
              type="button"
              onClick={() => onResolutionChange('hourly')}
              className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                resolution === 'hourly'
                  ? 'bg-white text-midnight shadow-2xs'
                  : 'text-storm/60 hover:text-midnight'
              }`}
            >
              Hourly Synchronized (1h)
            </button>
            <button
              type="button"
              onClick={() => onResolutionChange('raw')}
              className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                resolution === 'raw'
                  ? 'bg-white text-midnight shadow-2xs'
                  : 'text-storm/60 hover:text-midnight'
              }`}
            >
              Raw Telemetry
            </button>
          </div>

          <div className="hidden sm:block h-4 w-px bg-slate-200" aria-hidden="true" />

          {/* Series Badges */}
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 border border-blue-200/80 shadow-2xs">
              <span className="inline-block h-1 w-3.5 rounded-full bg-blue-600" aria-hidden="true" />
              <span>AWS Station Data</span>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 border border-amber-200/80 shadow-2xs">
              <span className="inline-block h-1 w-3.5 rounded-full bg-amber-600" aria-hidden="true" />
              <span>UNMA({referenceLocation || 'Reference'})</span>
            </div>
          </div>
        </div>
      </div>

      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="w-full cursor-crosshair select-none"
          onMouseMove={handlePointer}
          onMouseLeave={() => setTooltip(null)}
          aria-label="Comparison chart"
          role="img"
        >
          {/* Grid lines */}
          {yTicks.map((v) => {
            const y = syVal(v)
            return (
              <g key={v}>
                <line x1={PAD.left} y1={y} x2={SVG_W - PAD.right} y2={y} stroke="#F1F5F9" strokeWidth="0.5" />
                <text x={PAD.left - 8} y={y + 3} textAnchor="end" fontSize="10" fill="#94A3B8" fontFamily="Inter, sans-serif">
                  {v}
                </text>
              </g>
            )
          })}

          {/* X-Axis Ticks */}
          {xTicks.map((d, i) => {
            const x = sxVal(d.getTime())
            const label = d.toLocaleString(undefined, { timeZone: 'Africa/Kampala', month: 'short', day: 'numeric' })
            return (
              <g key={i}>
                <line x1={x} y1={PAD.top} x2={x} y2={PAD.top + cH} stroke="#F8FAFC" strokeWidth="0.5" />
                <text
                  x={x}
                  y={PAD.top + cH + 16}
                  textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'}
                  fontSize="11"
                  fill="#64748B"
                  fontFamily="Inter, sans-serif"
                  fontWeight="500"
                >
                  {label}
                </text>
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
            {cfg.label} ({cfg.unit})
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

          {/* Benchmark line (solid Warm Amber) */}
          {benchPath && (
            <path
              d={benchPath}
              fill="none"
              stroke={BENCHMARK_SERIES_COLOR}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* AWS line (solid Vibrant Blue) */}
          {awsPath && (
            <path
              d={awsPath}
              fill="none"
              stroke={AWS_SERIES_COLOR}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Tooltip cursor */}
          {tooltip && (
            <>
              <line
                x1={tooltip.x}
                y1={PAD.top}
                x2={tooltip.x}
                y2={PAD.top + cH}
                stroke="#CBD5E1"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              {tooltip.awsY !== null && (
                <circle cx={tooltip.x} cy={tooltip.awsY} r="4.5" fill={AWS_SERIES_COLOR} stroke="white" strokeWidth="2" />
              )}
              {tooltip.benchY !== null && (
                <circle cx={tooltip.x} cy={tooltip.benchY} r="4.5" fill={BENCHMARK_SERIES_COLOR} stroke="white" strokeWidth="2" />
              )}
            </>
          )}
        </svg>

        {tooltip && (
          <div
            className="pointer-events-none absolute top-2 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-md backdrop-blur-xs font-mono"
            style={{
              left: Math.min(Math.max(tooltip.x - 60, PAD.left), SVG_W - PAD.right - 140),
            }}
          >
            <p className="text-[10px] text-storm/40 mb-1">{tooltip.time}</p>
            {tooltip.awsValue !== null ? (
              <p className="flex items-center gap-2 text-blue-700 font-bold">
                <span className="inline-block h-2 w-2 rounded-full bg-blue-600" />
                AWS: {tooltip.awsValue.toFixed(2)} {cfg.unit}
              </p>
            ) : (
              <p className="flex items-center gap-2 text-storm/40 font-medium">
                <span className="inline-block h-2 w-2 rounded-full bg-slate-300" />
                AWS: —
              </p>
            )}
            {tooltip.benchValue !== null ? (
              <p className="flex items-center gap-2 text-amber-700 font-bold">
                <span className="inline-block h-2 w-2 rounded-full bg-amber-600" />
                UNMA({referenceLocation || 'Reference'}): {tooltip.benchValue.toFixed(2)} {cfg.unit}
              </p>
            ) : (
              <p className="flex items-center gap-2 text-storm/40 font-medium">
                <span className="inline-block h-2 w-2 rounded-full bg-slate-300" />
                UNMA({referenceLocation || 'Reference'}): —
              </p>
            )}
            <p className="text-[10px] text-storm/50 mt-1 border-t border-slate-100 pt-1">
              Diff:{' '}
              {tooltip.awsValue !== null && tooltip.benchValue !== null ? (
                <span className="font-bold text-midnight">
                  {(tooltip.awsValue - tooltip.benchValue >= 0 ? '+' : '') +
                    (tooltip.awsValue - tooltip.benchValue).toFixed(2)}{' '}
                  {cfg.unit}
                </span>
              ) : (
                <span className="text-storm/40">—</span>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Statistics summary cards ── */

function StatCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      <p className="text-xs font-semibold uppercase tracking-wider text-storm/40">{title}</p>
      {children}
    </div>
  )
}

function StatComparisonCards({
  metricKey,
  stats,
}: {
  metricKey: SensorMetricKey
  stats: BenchmarkData['stats']
}) {
  const cfg = SENSOR_METRIC_CONFIG[metricKey]
  const unit = cfg.unit

  const fmt = (v: number | null | undefined, u = '') =>
    v === null || v === undefined ? '—' : `${v.toFixed(2)}${u ? ` ${u}` : ''}`

  const corr = stats.correlation

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard title="Average (Mean)">
        <div className="mt-2 flex items-baseline justify-between">
          <div>
            <p className="text-[10px] text-storm/40 uppercase tracking-wider font-medium">AWS Station</p>
            <p className="text-xl font-bold font-display" style={{ color: AWS_SERIES_COLOR }}>{fmt(stats.aws_avg, unit)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-storm/40 uppercase tracking-wider font-medium">Reference (UNMA)</p>
            <p className="text-xl font-bold font-display" style={{ color: BENCHMARK_SERIES_COLOR }}>{fmt(stats.benchmark_avg, unit)}</p>
          </div>
        </div>
        {stats.bias !== null && stats.bias !== undefined && (
          <p className="mt-1.5 text-[10px] text-storm/50 border-t border-slate-100 pt-1">
            Bias (AWS − Ref):{' '}
            <strong className={stats.bias > 0 ? 'text-amber-600' : stats.bias < 0 ? 'text-blue-600' : 'text-slate-600'}>
              {(stats.bias > 0 ? '+' : '') + stats.bias.toFixed(2)} {unit}
            </strong>
          </p>
        )}
      </StatCard>

      <StatCard title="Observed Range (Min – Max)">
        <div className="mt-2 flex items-baseline justify-between">
          <div>
            <p className="text-[10px] text-storm/40 uppercase tracking-wider font-medium">AWS Station</p>
            <p className="text-sm font-bold text-blue-700 font-display">
              {fmt(stats.aws_min, unit)} – {fmt(stats.aws_max, unit)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-storm/40 uppercase tracking-wider font-medium">Reference (UNMA)</p>
            <p className="text-sm font-bold text-amber-700 font-display">
              {fmt(stats.benchmark_min, unit)} – {fmt(stats.benchmark_max, unit)}
            </p>
          </div>
        </div>
        <p className="mt-1.5 text-[10px] text-storm/40 border-t border-slate-100 pt-1">
          Minimum and maximum observed values
        </p>
      </StatCard>

      <StatCard title="Mean Absolute Error (MAE)">
        <p className="mt-2 text-xl font-bold text-midnight font-display">{fmt(stats.mean_absolute_error, unit)}</p>
        <p className="mt-1 text-[10px] text-storm/40">
          Average error magnitude between paired readings {stats.pair_count ? `(${stats.pair_count} pairs)` : ''}
        </p>
      </StatCard>

      <StatCard title="Pearson Correlation Score">
        <p className="mt-2 text-xl font-bold text-midnight font-display">
          {corr === null ? '—' : corr.toFixed(2)}
        </p>
        <p className="mt-1 text-[10px] text-storm/40">
          Agreement between AWS & Reference (-1.0 to +1.0)
        </p>
      </StatCard>
    </div>
  )
}

/* ── Benchmark CSV import panel ── */

interface ImportStatus {
  kind: 'success' | 'error'
  message: string
}

function BenchmarkImportPanel({
  onImportSuccess,
}: {
  onImportSuccess: (dataset: BenchmarkDataset) => void
}) {
  const [source, setSource] = useState('UNMA')
  const [location, setLocation] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [status, setStatus] = useState<ImportStatus | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!status) return
    const timer = setTimeout(() => setStatus(null), 6000)
    return () => clearTimeout(timer)
  }, [status])

  async function handleImport(e: React.FormEvent) {
    e.preventDefault()
    if (!file || isUploading) return
    if (!location.trim()) {
      setStatus({ kind: 'error', message: 'Please specify the location for this benchmark dataset.' })
      return
    }

    setIsUploading(true)
    setStatus(null)
    try {
      const result = await importBenchmarkCSV(file, location.trim(), source.trim() || 'UNMA')
      setStatus({
        kind: 'success',
        message: `Successfully imported ${result.imported} rows (${result.skipped} skipped). Data stored and ready for benchmarking.`,
      })
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      onImportSuccess(result.dataset)
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Failed to import CSV',
      })
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-midnight font-display">Import Reference Data</h3>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
            Admin only
          </span>
        </div>
        <p className="text-xs text-storm/40">Upload official UNMA or benchmark CSV files</p>
      </div>

      <form onSubmit={handleImport} className="grid grid-cols-1 gap-4 sm:grid-cols-12 sm:items-end">
        {/* CSV File Input */}
        <div className="sm:col-span-5">
          <label htmlFor="benchmark-file" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-storm/40">
            CSV File <span className="text-rose-500">*</span>
          </label>
          <input
            id="benchmark-file"
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-700 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-midnight file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-ocean"
          />
        </div>

        {/* Location Input */}
        <div className="sm:col-span-3">
          <label htmlFor="benchmark-location" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-storm/40">
            Location <span className="text-rose-500">*</span>
          </label>
          <input
            id="benchmark-location"
            type="text"
            placeholder="e.g. Entebbe"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-midnight focus:border-sky-300 focus:outline-none"
          />
        </div>

        {/* Source Authority */}
        <div className="sm:col-span-2">
          <label htmlFor="benchmark-source" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-storm/40">
            Source
          </label>
          <input
            id="benchmark-source"
            type="text"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-midnight focus:border-sky-300 focus:outline-none"
          />
        </div>

        {/* Upload Button */}
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={!file || !location.trim() || isUploading}
            className="w-full cursor-pointer rounded-xl bg-midnight px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-ocean disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isUploading ? 'Uploading...' : 'Upload & Ingest'}
          </button>
        </div>
      </form>

      {status && (
        <div
          className={`mt-3 rounded-xl p-3 text-xs ${
            status.kind === 'success'
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          {status.message}
        </div>
      )}
    </section>
  )
}

/* ── Time-bucket resampling (Hourly alignment) ── */

function resampleToHourly(
  awsReadings: AwsReading[],
  benchReadings: BenchmarkReading[],
  metricKey: SensorMetricKey,
): {
  resampledAws: AwsReading[]
  resampledBenchmark: BenchmarkReading[]
  hourlyStats: BenchmarkStats
} {
  const HOUR_MS = 60 * 60 * 1000

  // 1. Group AWS readings into nearest hour buckets (±30 min)
  const awsBuckets = new Map<number, number[]>()
  for (const r of awsReadings) {
    const t = new Date(r.timestamp).getTime()
    if (isNaN(t) || r.value === null || r.value === undefined) continue
    const bucketTime = Math.round(t / HOUR_MS) * HOUR_MS
    const list = awsBuckets.get(bucketTime) ?? []
    list.push(r.value)
    awsBuckets.set(bucketTime, list)
  }

  // 2. Group UNMA readings into nearest hour buckets (±30 min)
  const benchBuckets = new Map<number, { values: number[]; source: string }>()
  for (const r of benchReadings) {
    const t = new Date(r.timestamp).getTime()
    if (isNaN(t) || r.value === null || r.value === undefined) continue
    const bucketTime = Math.round(t / HOUR_MS) * HOUR_MS
    const entry = benchBuckets.get(bucketTime) ?? { values: [], source: r.source || 'UNMA' }
    entry.values.push(r.value)
    benchBuckets.set(bucketTime, entry)
  }

  function aggregate(values: number[]): number {
    if (values.length === 0) return 0
    if (metricKey === 'rain') {
      const s = values.reduce((a, b) => a + b, 0)
      return Math.round(s * 100) / 100
    }
    if (metricKey === 'wind_direction') {
      let sinSum = 0, cosSum = 0
      for (const deg of values) {
        const rad = (deg * Math.PI) / 180
        sinSum += Math.sin(rad)
        cosSum += Math.cos(rad)
      }
      const avgRad = Math.atan2(sinSum / values.length, cosSum / values.length)
      let avgDeg = (avgRad * 180) / Math.PI
      if (avgDeg < 0) avgDeg += 360
      return Math.round(avgDeg)
    }
    const s = values.reduce((a, b) => a + b, 0)
    return Math.round((s / values.length) * 100) / 100
  }

  const resampledAws: AwsReading[] = Array.from(awsBuckets.entries())
    .map(([timeMs, vals]) => ({
      timestamp: new Date(timeMs).toISOString(),
      value: aggregate(vals),
    }))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  const resampledBenchmark: BenchmarkReading[] = Array.from(benchBuckets.entries())
    .map(([timeMs, entry]) => ({
      timestamp: new Date(timeMs).toISOString(),
      value: aggregate(entry.values),
      source: entry.source,
    }))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  // Compute matched pairs where both AWS and Benchmark exist in the same hour
  const pairs: [number, number][] = []
  for (const [timeMs, awsVals] of awsBuckets.entries()) {
    const benchEntry = benchBuckets.get(timeMs)
    if (benchEntry && benchEntry.values.length > 0) {
      pairs.push([aggregate(awsVals), aggregate(benchEntry.values)])
    }
  }

  const awsVals = resampledAws.map((r) => r.value)
  const benchVals = resampledBenchmark.map((r) => r.value)

  const aws_avg = awsVals.length > 0 ? Math.round((awsVals.reduce((a, b) => a + b, 0) / awsVals.length) * 100) / 100 : null
  const benchmark_avg = benchVals.length > 0 ? Math.round((benchVals.reduce((a, b) => a + b, 0) / benchVals.length) * 100) / 100 : null
  const bias = aws_avg !== null && benchmark_avg !== null ? Math.round((aws_avg - benchmark_avg) * 100) / 100 : null

  const aws_min = awsVals.length > 0 ? Math.min(...awsVals) : null
  const aws_max = awsVals.length > 0 ? Math.max(...awsVals) : null
  const benchmark_min = benchVals.length > 0 ? Math.min(...benchVals) : null
  const benchmark_max = benchVals.length > 0 ? Math.max(...benchVals) : null

  let mae: number | null = null
  if (pairs.length > 0) {
    const errorSum = pairs.reduce((sum, [a, b]) => sum + Math.abs(a - b), 0)
    mae = Math.round((errorSum / pairs.length) * 1000) / 1000
  }

  let correlation: number | null = null
  if (pairs.length >= 2) {
    const n = pairs.length
    let sumX = 0, sumY = 0, sumX2 = 0, sumY2 = 0, sumXY = 0
    for (const [x, y] of pairs) {
      sumX += x
      sumY += y
      sumX2 += x * x
      sumY2 += y * y
      sumXY += x * y
    }
    const numerator = n * sumXY - sumX * sumY
    const denom = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))
    if (denom > 0) {
      correlation = Math.round((numerator / denom) * 1000) / 1000
    }
  }

  const hourlyStats: BenchmarkStats = {
    aws_avg,
    aws_min,
    aws_max,
    benchmark_avg,
    benchmark_min,
    benchmark_max,
    bias,
    mean_absolute_error: mae,
    correlation,
    pair_count: pairs.length,
  }

  return { resampledAws, resampledBenchmark, hourlyStats }
}

/* ── Content container ── */

function BenchmarkContent({
  stationId,
  stationLabel,
  metricKey,
  datasetId,
  referenceLocation,
  dateFrom,
  dateTo,
  onRetryReady,
}: {
  stationId: string
  stationLabel?: string
  metricKey: SensorMetricKey
  datasetId: number | null
  referenceLocation?: string
  dateFrom: string
  dateTo: string
  onRetryReady: (retry: () => void) => void
}) {
  const [resolution, setResolution] = useState<'hourly' | 'raw'>('hourly')

  const { data, isLoading, error, retry } = useBenchmarkData({
    stationId,
    metric: metricKey,
    datasetId,
    dateFrom,
    dateTo,
  })

  useEffect(() => {
    onRetryReady(retry)
  }, [retry, onRetryReady])

  const { resampledAws, resampledBenchmark, hourlyStats } = useMemo(() => {
    return resampleToHourly(
      data?.aws_readings ?? [],
      data?.benchmark_readings ?? [],
      metricKey,
    )
  }, [data?.aws_readings, data?.benchmark_readings, metricKey])

  const displayAws = resolution === 'hourly' ? resampledAws : (data?.aws_readings ?? [])
  const displayBench = resolution === 'hourly' ? resampledBenchmark : (data?.benchmark_readings ?? [])
  const displayStats = resolution === 'hourly' ? (hourlyStats ?? data?.stats) : data?.stats

  if (isLoading && !data) {
    return (
      <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5" aria-hidden="true">
        <div className="mb-4 h-4 w-32 rounded-full bg-slate-200" />
        <div className="h-[260px] rounded-xl bg-slate-100" />
      </div>
    )
  }

  return (
    <>
      {error && (
        <div className="mb-6 flex items-center gap-4 rounded-2xl border border-rose-200 bg-rose-50/50 p-4">
          <svg className="h-5 w-5 shrink-0 text-rose" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="10" r="10" />
            <path d="M12 8v4" />
            <circle cx="12" cy="16" r="0.5" fill="currentColor" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-rose-700">Failed to load benchmark comparison</p>
            <p className="text-xs text-rose-500/70">{error}</p>
          </div>
          <button
            type="button"
            onClick={retry}
            className="shrink-0 cursor-pointer rounded-full bg-rose-100 px-4 py-1.5 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-200"
          >
            Retry
          </button>
        </div>
      )}

      {data && (data.benchmark_readings.length === 0 || data.aws_readings.length === 0) ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center px-4">
          <svg className="mb-3 h-10 w-10 text-storm/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 17H4v-4M4 13l6-6 4 4 6-6M15 3h6v6" />
          </svg>
          <p className="text-sm font-semibold text-storm/60">
            {data.benchmark_readings.length === 0 && data.aws_readings.length === 0
              ? 'Data not available for selected date'
              : data.benchmark_readings.length === 0
              ? 'No reference readings match this period'
              : 'No AWS station readings match this period'}
          </p>
          <p className="mt-1 max-w-md text-xs text-storm/40">
            {data.benchmark_readings.length === 0 && data.aws_readings.length === 0
              ? `Neither AWS station readings nor imported reference data are available for ${dateFrom === dateTo ? dateFrom : `${dateFrom} to ${dateTo}`}.`
              : data.benchmark_readings.length === 0
              ? `The selected dataset does not have data between ${dateFrom} and ${dateTo}, or the chosen metric was not included in the uploaded CSV. Try selecting a dataset from the dropdown above to automatically align the benchmarking period.`
              : `The AWS station has no readings recorded between ${dateFrom} and ${dateTo}.`}
          </p>
        </div>
      ) : (
        <>
          <section aria-label="Benchmark chart" className="mb-6">
            <BenchmarkChart
              awsReadings={displayAws}
              benchmarkReadings={displayBench}
              metricKey={metricKey}
              referenceLocation={referenceLocation}
              stationLabel={stationLabel}
              resolution={resolution}
              onResolutionChange={setResolution}
            />
          </section>

          {displayStats && (
            <section aria-label="Benchmark statistics">
              <StatComparisonCards metricKey={metricKey} stats={displayStats} />
            </section>
          )}
        </>
      )}
    </>
  )
}

/* ── Main Benchmark Page ── */

export function BenchmarkPage() {
  const { role } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const [stations, setStations] = useState<Station[]>([])
  const [datasets, setDatasets] = useState<BenchmarkDataset[]>([])
  const [stationsLoading, setStationsLoading] = useState(true)
  const [datasetsLoading, setDatasetsLoading] = useState(true)

  const retryRef = useRef<(() => void) | null>(null)

  const urlStation = searchParams.get('station')
  const urlMetric = searchParams.get('metric') as SensorMetricKey | null
  const urlDataset = searchParams.get('dataset')
  const urlDateFrom = searchParams.get('from')
  const urlDateTo = searchParams.get('to')

  const [stationId, setStationId] = useState<string | null>(urlStation)
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | null>(
    urlDataset ? Number(urlDataset) : null,
  )
  const [metricKey, setMetricKey] = useState<SensorMetricKey>(
    urlMetric && BENCHMARK_METRICS.includes(urlMetric) ? urlMetric : 'temperature',
  )
  const [dateFrom, setDateFrom] = useState(urlDateFrom ?? daysAgo(7))
  const [dateTo, setDateTo] = useState(urlDateTo ?? today())

  // Initial load: Stations and Datasets
  useEffect(() => {
    fetchStations()
      .then((data) => {
        setStations(data)
        if (!stationId && data.length > 0) {
          setStationId(data[0].station_id)
        }
      })
      .finally(() => setStationsLoading(false))

    fetchBenchmarkDatasets()
      .then((data) => {
        setDatasets(data)
      })
      .finally(() => setDatasetsLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [isDeletingDataset, setIsDeletingDataset] = useState(false)

  // Handle explicit station selection
  const handleStationChange = useCallback((id: string | null) => {
    setStationId(id)
  }, [])

  // Enhancement 1: When dataset changes, auto-align date range to the last 7 days of the dataset (counting backwards from dateTo)
  const handleDatasetChange = useCallback((id: number | null) => {
    setSelectedDatasetId(id)
    if (id) {
      const ds = datasets.find((d) => d.id === id)
      if (ds?.end_date) {
        const toStr = ds.end_date.slice(0, 10)
        const toD = new Date(toStr)
        const fromD = new Date(toD.getTime() - 7 * 24 * 60 * 60 * 1000)
        const startStr = ds.start_date ? ds.start_date.slice(0, 10) : null
        const finalFromStr = startStr && fromD < new Date(startStr) ? startStr : fromD.toISOString().slice(0, 10)
        setDateFrom(finalFromStr)
        setDateTo(toStr)
      }
    }
  }, [datasets])

  // Delete dataset from database
  const handleDeleteDataset = useCallback(async (id: number) => {
    const ds = datasets.find((d) => d.id === id)
    const label = ds ? (ds.name || `${ds.source} - ${ds.location}`) : 'this dataset'
    if (!window.confirm(`Are you sure you want to remove "${label}" from the database? All its imported reference data will be permanently deleted.`)) {
      return
    }

    setIsDeletingDataset(true)
    try {
      await deleteBenchmarkDataset(id)
      setDatasets((prev) => prev.filter((d) => d.id !== id))
      setSelectedDatasetId(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete dataset')
    } finally {
      setIsDeletingDataset(false)
    }
  }, [datasets])

  // Sync URL search params
  useEffect(() => {
    const next = new URLSearchParams()
    if (stationId) next.set('station', stationId)
    if (selectedDatasetId) next.set('dataset', String(selectedDatasetId))
    if (metricKey !== 'temperature') next.set('metric', metricKey)
    if (dateFrom) next.set('from', dateFrom)
    if (dateTo) next.set('to', dateTo)
    setSearchParams(next, { replace: true })
  }, [stationId, selectedDatasetId, metricKey, dateFrom, dateTo, setSearchParams])

  const handleDateChange = useCallback((from: string, to: string) => {
    setDateFrom(from)
    setDateTo(to)
  }, [])

  const handleRetryReady = useCallback((retry: () => void) => {
    retryRef.current = retry
  }, [])

  // On successful import, reload datasets and auto-select new one (defaulting to last 7 days)
  const handleImportSuccess = useCallback(async (newDataset: BenchmarkDataset) => {
    try {
      const refreshed = await fetchBenchmarkDatasets()
      setDatasets(refreshed)
      setSelectedDatasetId(newDataset.id)
      if (newDataset.end_date) {
        const toStr = newDataset.end_date.slice(0, 10)
        const toD = new Date(toStr)
        const fromD = new Date(toD.getTime() - 7 * 24 * 60 * 60 * 1000)
        const startStr = newDataset.start_date ? newDataset.start_date.slice(0, 10) : null
        const finalFromStr = startStr && fromD < new Date(startStr) ? startStr : fromD.toISOString().slice(0, 10)
        setDateFrom(finalFromStr)
        setDateTo(toStr)
      }
      retryRef.current?.()
    } catch (e) {
      console.error('Failed to refresh datasets after import:', e)
    }
  }, [])

  const activeDataset = useMemo(
    () => datasets.find((d) => d.id === selectedDatasetId) ?? null,
    [datasets, selectedDatasetId],
  )

  const activeStation = useMemo(
    () => stations.find((s) => s.station_id === stationId) ?? null,
    [stations, stationId],
  )

  return (
    <div className="flex min-h-screen flex-col bg-mist lg:h-screen lg:flex-row">
      <DashboardSidebar />

      <main className="relative flex-1 min-w-0 overflow-y-auto px-5 py-5 sm:px-6 lg:px-8 lg:py-6">
        {/* ── Page Header ── */}
        <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-midnight to-ocean p-6 shadow-md sm:p-8">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Benchmarking</p>
            <h1 className="text-2xl font-semibold text-white font-display sm:text-3xl">
              AWS Station vs UNMA Reference Data
            </h1>
          </div>
        </div>

        {/* ── Admin CSV Import Panel ── */}
        {role === 'admin' && (
          <BenchmarkImportPanel onImportSuccess={handleImportSuccess} />
        )}

        {/* ── Controls Section ── */}
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-end">
            {/* Station dropdown */}
            <div className="lg:col-span-4">
              <label htmlFor="station-select" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-storm/40">
                AWS Station
              </label>
              <select
                id="station-select"
                value={stationId ?? ''}
                onChange={(e) => handleStationChange(e.target.value || null)}
                disabled={stationsLoading}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-midnight transition-colors focus:border-sky-300 focus:outline-none"
              >
                <option value="">Select an AWS station...</option>
                {stations.map((s) => (
                  <option key={s.station_id} value={s.station_id}>
                    {s.name} ({s.station_id}){s.location ? ` — ${s.location}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Benchmark Reference Dataset dropdown */}
            <div className="lg:col-span-4">
              <label htmlFor="dataset-select" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-storm/40">
                Reference Dataset / Location
              </label>
              <div className="relative flex items-center">
                <select
                  id="dataset-select"
                  value={selectedDatasetId ? String(selectedDatasetId) : ''}
                  onChange={(e) => handleDatasetChange(e.target.value ? Number(e.target.value) : null)}
                  disabled={datasetsLoading || isDeletingDataset}
                  className={`w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-midnight transition-colors focus:border-sky-300 focus:outline-none ${
                    selectedDatasetId ? 'pr-9' : ''
                  }`}
                >
                  <option value="" disabled>
                    {datasets.length === 0 ? 'No imported datasets found' : 'Select an imported reference CSV...'}
                  </option>
                  {datasets.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name || `${d.source} - ${d.location}`} ({d.row_count} rows)
                    </option>
                  ))}
                </select>

                {/* X button to remove selected CSV from database */}
                {selectedDatasetId && (
                  <button
                    type="button"
                    onClick={() => handleDeleteDataset(selectedDatasetId)}
                    disabled={isDeletingDataset}
                    title="Remove this CSV and its data from the database"
                    className="absolute right-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-storm/70 transition-colors hover:bg-rose-100 hover:text-rose-600 cursor-pointer text-[11px] font-bold"
                    aria-label="Remove selected dataset from database"
                  >
                    {isDeletingDataset ? '…' : '✕'}
                  </button>
                )}
              </div>
            </div>

            {/* Benchmarking Period (Date Range) */}
            <div className="lg:col-span-4">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-storm/40">
                Benchmarking Period
              </label>
              <DateRangePicker
                dateFrom={dateFrom}
                dateTo={dateTo}
                onChange={handleDateChange}
              />
            </div>
          </div>

          {/* Active Dataset Coverage Badge */}
          {activeDataset && (
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 border border-slate-200/60 px-3.5 py-2 text-xs text-storm/70">
              <span className="font-semibold text-midnight">Active Reference:</span>
              <span className="rounded-md bg-sky-100 px-2 py-0.5 font-medium text-sky-800">
                {activeDataset.source} — {activeDataset.location}
              </span>
              <span>•</span>
              <span>
                Available Date Span: <strong className="text-midnight">{activeDataset.start_date?.slice(0, 10) ?? 'N/A'}</strong> to <strong className="text-midnight">{activeDataset.end_date?.slice(0, 10) ?? 'N/A'}</strong>
              </span>
              <span>•</span>
              <span>{activeDataset.row_count} readings recorded</span>
            </div>
          )}

          {/* 5 Core Benchmark Metrics */}
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-storm/40">
              Select Metric to Benchmark
            </p>
            <div className="flex flex-wrap gap-2">
              {BENCHMARK_METRICS.map((key) => {
                const isSelected = metricKey === key
                const cfg = SENSOR_METRIC_CONFIG[key]
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setMetricKey(key)}
                    className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-midnight text-white shadow-xs'
                        : 'bg-slate-100 text-storm/70 hover:bg-slate-200'
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                    {cfg.label} ({cfg.unit})
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        {/* ── Visual Comparison & Statistics ── */}
        {!stationId ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-20 px-4 text-center">
            <svg className="mb-4 h-12 w-12 text-storm/20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <p className="text-sm font-semibold text-storm/50">Select an AWS station to begin benchmarking</p>
            <p className="mt-1 text-xs text-storm/30">Choose a station from the dropdown above to compare against UNMA reference data.</p>
          </div>
        ) : datasetsLoading ? (
          <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5" aria-hidden="true">
            <div className="mb-4 h-4 w-32 rounded-full bg-slate-200" />
            <div className="h-[260px] rounded-xl bg-slate-100" />
          </div>
        ) : datasets.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-20 px-4 text-center shadow-xs">
            <svg className="mb-3 h-10 w-10 text-amber-500/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
            <p className="text-sm font-semibold text-midnight">
              Please import a reference CSV to start the benchmarking.
            </p>
            <p className="mt-1 max-w-md text-xs text-storm/40">
              No reference datasets have been imported yet. Use the upload panel below to import a UNMA CSV file.
            </p>
          </div>
        ) : !selectedDatasetId ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-20 px-4 text-center shadow-xs">
            <svg className="mb-3 h-10 w-10 text-blue-500/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 14 14" />
            </svg>
            <p className="text-sm font-semibold text-midnight">
              Please select a CSV from the imported CSVs to start the benchmarking
            </p>
            <p className="mt-1 max-w-md text-xs text-storm/40">
              Select one of the {datasets.length} imported dataset{datasets.length === 1 ? '' : 's'} in the dropdown above to load the comparison curves.
            </p>
          </div>
        ) : (
          <BenchmarkContent
            stationId={stationId}
            stationLabel={activeStation?.name || stationId}
            metricKey={metricKey}
            datasetId={selectedDatasetId}
            referenceLocation={activeDataset?.location || activeDataset?.name || ''}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onRetryReady={handleRetryReady}
          />
        )}
      </main>
    </div>
  )
}
