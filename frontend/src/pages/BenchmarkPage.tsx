import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { AwsReading, BenchmarkReading, SensorMetricKey, Station } from '../types'
import { SENSOR_METRIC_CONFIG } from '../types'
import { fetchStations } from '../api/stations'
import { useBenchmarkData } from '../hooks/useBenchmarkData'
import { DashboardSidebar } from '../components/dashboard/DashboardSidebar'
import { StationSensorSelector } from '../components/weatherData/StationSensorSelector'

const SENSOR_METRICS = Object.keys(SENSOR_METRIC_CONFIG) as SensorMetricKey[]
const BENCHMARK_COLOR = '#94A3B8'

function daysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/* ── Dual-line comparison chart (AWS vs UNMA) ── */

const PAD = { top: 24, bottom: 44, left: 55, right: 20 }
const SVG_W = 800
const SVG_H = 300

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
}: {
  awsReadings: AwsReading[]
  benchmarkReadings: BenchmarkReading[]
  metricKey: SensorMetricKey
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
    const gapMs = (xRange / combinedLen) * 2.5

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

    const refPoint = bestAws ?? bestBench
    if (!refPoint) return

    setTooltip({
      x: sxVal(new Date(refPoint.timestamp).getTime()),
      awsY: bestAws ? syVal(bestAws.value) : null,
      awsValue: bestAws ? bestAws.value : null,
      benchY: bestBench ? syVal(bestBench.value) : null,
      benchValue: bestBench ? bestBench.value : null,
      time: new Date(refPoint.timestamp).toLocaleString(undefined, {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      }),
    })
  }

  if (!hasData) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-midnight font-display">{cfg.label} — AWS vs UNMA</h3>
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
          {cfg.label} — AWS vs UNMA
        </h3>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1 text-[10px] text-storm/50">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: cfg.color }} aria-hidden="true" />
            AWS
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] text-storm/50">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: BENCHMARK_COLOR }} aria-hidden="true" />
            UNMA
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
          aria-label={`${cfg.label} AWS vs UNMA comparison chart`}
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
          {benchPath && (
            <path d={benchPath} fill="none" stroke={BENCHMARK_COLOR} strokeWidth="2" strokeDasharray="5,3" strokeLinejoin="round" strokeLinecap="round" />
          )}
          {awsPath && (
            <path d={awsPath} fill="none" stroke={cfg.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          )}
          {tooltip && (
            <line x1={tooltip.x} y1={PAD.top} x2={tooltip.x} y2={PAD.top + cH} stroke="#94A3B8" strokeWidth="0.5" strokeDasharray="3,3" />
          )}
          {tooltip?.awsY !== null && tooltip && (
            <circle cx={tooltip.x} cy={tooltip.awsY as number} r="3.5" fill={cfg.color} />
          )}
          {tooltip?.benchY !== null && tooltip && (
            <circle cx={tooltip.x} cy={tooltip.benchY as number} r="3.5" fill={BENCHMARK_COLOR} />
          )}
        </svg>

        {tooltip && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2"
            style={{
              left: `${(tooltip.x / SVG_W) * 100}%`,
              top: `${Math.min(Math.min(tooltip.awsY ?? SVG_H, tooltip.benchY ?? SVG_H) / SVG_H, 0.85) * 100}%`,
            }}
          >
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg -translate-y-full">
              {tooltip.awsValue !== null && (
                <p className="text-sm font-bold font-display" style={{ color: cfg.color }}>
                  AWS: {tooltip.awsValue}{cfg.unit}
                </p>
              )}
              {tooltip.benchValue !== null && (
                <p className="text-sm font-bold font-display text-slate-500">
                  UNMA: {tooltip.benchValue}{cfg.unit}
                </p>
              )}
              <p className="text-[10px] text-storm/40">{tooltip.time}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Stat comparison cards ── */

function correlationLabel(r: number | null): string {
  if (r === null) return 'N/A'
  const abs = Math.abs(r)
  if (abs >= 0.9) return 'Excellent'
  if (abs >= 0.7) return 'Good'
  if (abs >= 0.5) return 'Moderate'
  return 'Weak'
}

function fmt(v: number | null, unit: string): string {
  return v === null ? '—' : `${v.toFixed(2)}${unit}`
}

function StatCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-storm/40">{title}</h4>
      {children}
    </div>
  )
}

function StatComparisonCards({
  metricKey,
  stats,
}: {
  metricKey: SensorMetricKey
  stats: import('../types').BenchmarkStats
}) {
  const unit = SENSOR_METRIC_CONFIG[metricKey].unit
  const corr = stats.correlation

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <StatCard title="Average">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-storm/40">AWS</p>
            <p className="text-lg font-bold text-midnight font-display">{fmt(stats.aws_avg, unit)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-storm/40">UNMA</p>
            <p className="text-lg font-bold text-slate-500 font-display">{fmt(stats.benchmark_avg, unit)}</p>
          </div>
        </div>
      </StatCard>

      <StatCard title="Range (min – max)">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-storm/40">AWS</p>
            <p className="text-sm font-bold text-midnight font-display">
              {fmt(stats.aws_min, unit)} – {fmt(stats.aws_max, unit)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-storm/40">UNMA</p>
            <p className="text-sm font-bold text-slate-500 font-display">
              {fmt(stats.benchmark_min, unit)} – {fmt(stats.benchmark_max, unit)}
            </p>
          </div>
        </div>
      </StatCard>

      <StatCard title="Mean Absolute Error">
        <p className="text-lg font-bold text-midnight font-display">{fmt(stats.mean_absolute_error, unit)}</p>
        <p className="mt-1 text-[10px] text-storm/40">Lower = more accurate</p>
      </StatCard>

      <StatCard title="Correlation Coefficient">
        <p className="text-lg font-bold text-midnight font-display">
          {corr === null ? '—' : corr.toFixed(2)}
          {corr !== null && <span className="ml-2 text-xs font-semibold text-storm/50">{correlationLabel(corr)}</span>}
        </p>
        <p className="mt-1 text-[10px] text-storm/40">
          ≥0.9 Excellent · ≥0.7 Good · ≥0.5 Moderate · &lt;0.5 Weak
        </p>
      </StatCard>
    </div>
  )
}

/* ── Sub-component: rendered only when a station is selected ── */
function BenchmarkContent({
  stationId,
  metricKey,
  hours,
}: {
  stationId: string
  metricKey: SensorMetricKey
  hours: number
}) {
  const { data, isLoading, error, retry } = useBenchmarkData({ stationId, hours, metric: metricKey })

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
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4" />
            <circle cx="12" cy="16" r="0.5" fill="currentColor" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-rose-700">Failed to load benchmark data</p>
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

      {data && data.benchmark_readings.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-20">
          <svg className="mb-4 h-12 w-12 text-storm/20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 17H4v-4M4 13l6-6 4 4 6-6M15 3h6v6" />
          </svg>
          <p className="text-sm font-semibold text-storm/50">No UNMA reference data available for this period</p>
          <p className="mt-1 text-xs text-storm/30">Import via Django admin.</p>
        </div>
      ) : (
        <>
          <section aria-label="Benchmark chart" className="mb-6">
            <BenchmarkChart
              awsReadings={data?.aws_readings ?? []}
              benchmarkReadings={data?.benchmark_readings ?? []}
              metricKey={metricKey}
            />
          </section>

          {data && (
            <section aria-label="Benchmark statistics">
              <StatComparisonCards metricKey={metricKey} stats={data.stats} />
            </section>
          )}
        </>
      )}
    </>
  )
}

/* ── Main page ── */
export function BenchmarkPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [stations, setStations] = useState<Station[]>([])
  const [stationsLoading, setStationsLoading] = useState(true)

  useEffect(() => {
    fetchStations()
      .then(setStations)
      .finally(() => setStationsLoading(false))
  }, [])

  const urlStation = searchParams.get('station')
  const urlMetric = searchParams.get('metric') as SensorMetricKey | null
  const urlDateFrom = searchParams.get('from')
  const urlDateTo = searchParams.get('to')

  const [stationId, setStationId] = useState<string | null>(urlStation)

  useEffect(() => {
    if (urlStation && urlStation !== stationId) {
      setStationId(urlStation)
    }
  }, [urlStation]) // eslint-disable-line react-hooks/exhaustive-deps

  const [metricKey, setMetricKey] = useState<SensorMetricKey>(
    urlMetric && SENSOR_METRICS.includes(urlMetric) ? urlMetric : 'temperature',
  )
  const [dateFrom, setDateFrom] = useState(urlDateFrom ?? daysAgo(7))
  const [dateTo, setDateTo] = useState(urlDateTo ?? today())

  const handleStationChange = useCallback((id: string | null) => {
    setStationId(id)
    const next = new URLSearchParams()
    if (id) next.set('station', id)
    if (metricKey !== 'temperature') next.set('metric', metricKey)
    if (dateFrom !== daysAgo(7)) next.set('from', dateFrom)
    if (dateTo !== today()) next.set('to', dateTo)
    setSearchParams(next, { replace: true })
  }, [setSearchParams, metricKey, dateFrom, dateTo])

  const hours = useMemo(
    () => Math.max(1, Math.ceil((Date.parse(dateTo) - Date.parse(dateFrom)) / 3600000)),
    [dateFrom, dateTo],
  )

  useEffect(() => {
    const next = new URLSearchParams(searchParams)
    if (stationId) next.set('station', stationId)
    else { next.delete('station') }
    if (metricKey !== 'temperature') next.set('metric', metricKey)
    else { next.delete('metric') }
    if (dateFrom !== daysAgo(7)) next.set('from', dateFrom)
    else { next.delete('from') }
    if (dateTo !== today()) next.set('to', dateTo)
    else { next.delete('to') }
    setSearchParams(next, { replace: true })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metricKey, dateFrom, dateTo])

  const handleDateChange = useCallback((from: string, to: string) => {
    setDateFrom(from)
    setDateTo(to)
  }, [])

  return (
    <div className="flex min-h-screen flex-col bg-mist lg:h-screen lg:flex-row">
      <DashboardSidebar />

      <main className="relative flex-1 min-w-0 overflow-y-auto px-5 py-5 sm:px-6 lg:px-8 lg:py-6">
        {/* ── Header ── */}
        <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-midnight to-ocean p-6 shadow-md sm:p-8">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Benchmarking</p>
            <h1 className="text-2xl font-semibold text-white font-display sm:text-3xl">
              AWS vs UNMA reference data
            </h1>
            <p className="text-sm text-white/50">
              {stationsLoading ? 'Loading stations...' : `${stations.length} stations · ${SENSOR_METRIC_CONFIG[metricKey].label}`}
            </p>
          </div>
        </div>

        {/* ── Station & metric selector ── */}
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <StationSensorSelector
            stations={stations}
            selectedStationId={stationId}
            onStationChange={handleStationChange}
            selectedMetric={metricKey}
            onMetricChange={setMetricKey}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateChange={handleDateChange}
          />
        </section>

        {/* ── Data or prompt ── */}
        {stationId ? (
          <BenchmarkContent
            stationId={stationId}
            metricKey={metricKey}
            hours={hours}
          />
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-20">
            <svg className="mb-4 h-12 w-12 text-storm/20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <p className="text-sm font-semibold text-storm/50">Select a station to begin benchmarking</p>
            <p className="mt-1 text-xs text-storm/30">Choose a station from the dropdown above to compare against UNMA reference data.</p>
          </div>
        )}
      </main>
    </div>
  )
}
