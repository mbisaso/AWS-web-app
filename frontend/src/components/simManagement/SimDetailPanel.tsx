import { useEffect, useMemo, useState } from 'react'
import type { SimManagementData, DailyUsage } from '../../services/api'
import { updateSimAccount } from '../../services/api'
import { TopUpHistoryTable } from './TopUpHistoryTable'
import { DataUsageCurve } from './DataUsageCurve'

interface SimDetailPanelProps {
  data: SimManagementData | null
  isLoading?: boolean
  onTopUp: () => void
  onClose: () => void
}

const PAD = { top: 20, bottom: 32, left: 45, right: 16 }
const SVG_W = 700
const SVG_H = 200

export function SimDetailPanel({ data, isLoading, onTopUp, onClose }: SimDetailPanelProps) {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="h-5 w-48 animate-pulse rounded bg-slate-200" />
        <div className="mt-4 h-40 animate-pulse rounded bg-slate-200" />
        <div className="mt-4 space-y-2">
          <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-full animate-pulse rounded bg-slate-200" />
        </div>
      </div>
    )
  }

  if (!data) return null

  /* ── Local editing state ── */

  const [phone, setPhone] = useState(data.sim.phone_number)
  const [editingPhone, setEditingPhone] = useState(false)
  const [phoneDraft, setPhoneDraft] = useState('')

  const [bundle, setBundle] = useState(data.sim.bundle_size_mb)
  const [editingBundle, setEditingBundle] = useState(false)
  const [bundleDraft, setBundleDraft] = useState(0)

  const [expiry, setExpiry] = useState(data.sim.expiry_date)
  const [editingExpiry, setEditingExpiry] = useState(false)
  const [expiryDraft, setExpiryDraft] = useState('')

  /* Sync local state from data when a new SIM is selected */
  useEffect(() => {
    setPhone(data.sim.phone_number)
    setBundle(data.sim.bundle_size_mb)
    setExpiry(data.sim.expiry_date)
    setEditingPhone(false)
    setEditingBundle(false)
    setEditingExpiry(false)
  }, [data.sim.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSavePhone = async () => {
    await updateSimAccount(data.sim.id, { phone_number: phoneDraft })
    setPhone(phoneDraft)
    setEditingPhone(false)
  }

  const handleSaveBundle = async () => {
    if (bundleDraft > 0) {
      await updateSimAccount(data.sim.id, { bundle_size_mb: bundleDraft })
      setBundle(bundleDraft)
    }
    setEditingBundle(false)
  }

  const handleSaveExpiry = async () => {
    if (expiryDraft) {
      await updateSimAccount(data.sim.id, { expiry_date: expiryDraft })
      setExpiry(expiryDraft)
    }
    setEditingExpiry(false)
  }

  const remaining = Math.max(0, bundle - data.sim.usage_mb)
  const usagePct = bundle > 0
    ? Math.min(100, ((data.sim.usage_mb / bundle) * 100))
    : 0

  const detailContent = (
    <div className="space-y-5">
      {/* ── SIM info header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-midnight font-display">
            {data.station_name ?? 'Unassigned SIM'}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-storm/60">
            <span>{data.sim.carrier}</span>
            <span className="font-mono">…{data.sim.iccid.slice(-6)}</span>
            {editingPhone ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={phoneDraft}
                  onChange={(e) => setPhoneDraft(e.target.value)}
                  className="w-28 rounded border border-sky-200 px-1.5 py-0.5 text-xs text-midnight focus:outline-2 focus:outline-offset-1 focus:outline-sky-primary"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleSavePhone}
                  className="cursor-pointer rounded bg-sky-primary px-1.5 py-0.5 text-[10px] font-semibold text-white hover:bg-sky-deep"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditingPhone(false)}
                  className="cursor-pointer rounded px-1.5 py-0.5 text-[10px] text-storm/50 hover:text-storm/70"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setPhoneDraft(phone); setEditingPhone(true) }}
                className="group flex items-center gap-1 hover:text-storm/80"
              >
                <span>{phone || <span className="italic text-storm/40">No phone</span>}</span>
                <svg className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                </svg>
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {data.sim.status === 'active' && (
            <button
              type="button"
              onClick={onTopUp}
              className="cursor-pointer rounded-xl bg-sky-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-primary"
            >
              Top up
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-storm/60 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-primary"
            aria-label="Close detail panel"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatBox label="Used" value={`${data.sim.usage_mb.toLocaleString()} MB (${usagePct.toFixed(0)}%)`} />
        <StatBox
          label="Remaining"
          value={`${remaining.toLocaleString()} MB`}
          urgent={remaining < bundle * 0.1 && data.sim.status === 'active'}
        />
        <div className="rounded-xl border border-slate-200 bg-white p-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-storm/40">Bundle</p>
          {editingBundle ? (
            <div className="mt-1 flex items-center gap-1">
              <input
                type="number"
                min={1}
                value={bundleDraft}
                onChange={(e) => setBundleDraft(Number(e.target.value))}
                className="w-20 rounded border border-sky-200 px-1.5 py-0.5 text-xs text-midnight focus:outline-2 focus:outline-offset-1 focus:outline-sky-primary"
                autoFocus
              />
              <span className="text-[10px] text-storm/40">MB</span>
              <button
                type="button"
                onClick={handleSaveBundle}
                className="cursor-pointer rounded bg-sky-primary px-1.5 py-0.5 text-[10px] font-semibold text-white hover:bg-sky-deep"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditingBundle(false)}
                className="cursor-pointer rounded px-1.5 py-0.5 text-[10px] text-storm/50 hover:text-storm/70"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { setBundleDraft(bundle); setEditingBundle(true) }}
              className="group mt-1 flex w-full items-center gap-1"
            >
              <span className="text-base font-bold font-display tabular-nums text-midnight">
                {bundle.toLocaleString()} MB
              </span>
              <svg className="h-3 w-3 text-storm/30 opacity-0 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              </svg>
            </button>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-storm/40">Expiry</p>
          {editingExpiry ? (
            <div className="mt-1 flex items-center gap-1">
              <input
                type="date"
                value={expiryDraft}
                onChange={(e) => setExpiryDraft(e.target.value)}
                className="w-28 rounded border border-sky-200 px-1.5 py-0.5 text-xs text-midnight focus:outline-2 focus:outline-offset-1 focus:outline-sky-primary"
                autoFocus
              />
              <button
                type="button"
                onClick={handleSaveExpiry}
                className="cursor-pointer rounded bg-sky-primary px-1.5 py-0.5 text-[10px] font-semibold text-white hover:bg-sky-deep"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditingExpiry(false)}
                className="cursor-pointer rounded px-1.5 py-0.5 text-[10px] text-storm/50 hover:text-storm/70"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { setExpiryDraft(expiry); setEditingExpiry(true) }}
              className="group mt-1 flex w-full items-center gap-1"
            >
              <span className={`text-base font-bold font-display tabular-nums ${data.sim.status === 'active' && new Date(expiry) < new Date() ? 'text-rose' : 'text-midnight'}`}>
                {expiry ? new Date(expiry).toLocaleDateString() : <span className="text-storm/30 italic">Not set</span>}
              </span>
              <svg className="h-3 w-3 text-storm/30 opacity-0 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── Data usage percentage curve ── */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-storm/40">
          Data usage overview
        </p>
        <DataUsageCurve used={data.sim.usage_mb} total={bundle} dailyUsage={data.daily_usage} />
      </div>

      {/* ── Usage chart ── */}
      {data.daily_usage.length > 0 && (
        <UsageChart dailyUsage={data.daily_usage} remaining={remaining} />
      )}

      {/* ── Projection note ── */}
      {data.forecast_confidence_note && (
        <div className="rounded-xl border border-sky-200 bg-sky-soft/50 p-3.5">
          <div className="flex items-start gap-2.5">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-sky-deep" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <circle cx="12" cy="8" r="0.5" fill="currentColor" />
            </svg>
            <div>
              <p className="text-xs font-semibold text-sky-deep">Projection note</p>
              <p className="mt-0.5 text-xs text-storm/60">{data.forecast_confidence_note}</p>
              {data.projected_expiry_date && (
                <p className="mt-1 text-xs font-medium text-amber-600">
                  Estimated depletion: {new Date(data.projected_expiry_date).toLocaleDateString()}
                  {data.estimated_days_remaining !== null && ` (${data.estimated_days_remaining} day${data.estimated_days_remaining !== 1 ? 's' : ''})`}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Alert integration strip ── */}
      {v(data) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5">
          <div className="flex items-start gap-2.5">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <path d="M12 9v4" />
              <circle cx="12" cy="17" r="0.5" fill="currentColor" />
            </svg>
            <div className="flex-1">
              <p className="text-xs font-semibold text-amber-700">
                {data.estimated_days_remaining !== null && data.estimated_days_remaining <= 7
                  ? 'This SIM requires attention'
                  : 'SIM alert'}
              </p>
              <p className="mt-0.5 text-xs text-storm/60">
                View detailed alerts for this station in{' '}
                <a
                  href={`/dashboard/alerts-center?station_id=${data.station_id ?? ''}`}
                  className="font-medium text-sky-deep underline underline-offset-2 transition-colors hover:text-sky-primary cursor-pointer"
                >
                  Alerts Center
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Top-up history ── */}
      <div>
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-storm/40">
          Top-up history ({data.top_up_history.length})
        </h4>
        <TopUpHistoryTable history={data.top_up_history} />
      </div>

      {data.station_id && (
        <div className="text-right">
          <a
            href="/dashboard/station-manager"
            className="text-xs font-medium text-sky-deep underline underline-offset-2 transition-colors hover:text-sky-primary cursor-pointer"
          >
            Manage in Station Manager →
          </a>
        </div>
      )}
    </div>
  )

  return (
    <div className="animate-fade-in-up motion-reduce:animate-none">
      {detailContent}
    </div>
  )
}

function v(d: SimManagementData): boolean {
  if (d.sim.status !== 'active') return true
  if (d.estimated_days_remaining !== null && d.estimated_days_remaining <= 7) return true
  if (d.sim.bundle_size_mb - d.sim.usage_mb <= 0) return true
  return false
}

function StatBox({ label, value, urgent }: { label: string; value: string; urgent?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-storm/40">{label}</p>
      <p className={`mt-1 text-base font-bold font-display tabular-nums ${urgent ? 'text-rose' : 'text-midnight'}`}>
        {value}
      </p>
    </div>
  )
}

/* ── SVG usage chart ── */

function UsageChart({ dailyUsage, remaining }: { dailyUsage: DailyUsage[]; remaining: number }) {
  const chartData = useMemo(() => {
    const used = dailyUsage.slice(-45)
    const vals = used.map((d) => d.usage_mb)
    const maxVal = Math.max(...vals, 1)
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length
    return { used, maxVal, avg }
  }, [dailyUsage])

  const chartW = SVG_W - PAD.left - PAD.right
  const chartH = SVG_H - PAD.top - PAD.bottom

  const yMax = chartData.maxVal * 1.25
  const { linePath, xLabels, yTicks } = useMemo(() => {
    const pts = chartData.used.map((d, i) => {
      const x = PAD.left + (i / Math.max(1, chartData.used.length - 1)) * chartW
      const y = PAD.top + chartH - (d.usage_mb / yMax) * chartH
      return `${x},${y}`
    })
    const path = pts.length ? `M ${pts.join(' L ')}` : ''

    const labels: { x: number; label: string }[] = []
    const step = Math.max(1, Math.floor(chartData.used.length / 6))
    for (let i = 0; i < chartData.used.length; i += step) {
      const d = new Date(chartData.used[i].date)
      labels.push({
        x: PAD.left + (i / Math.max(1, chartData.used.length - 1)) * chartW,
        label: `${d.getMonth() + 1}/${d.getDate()}`,
      })
    }

    const ticks: { y: number; label: string }[] = []
    const tickCount = 4
    for (let i = 0; i <= tickCount; i++) {
      const v = (yMax / tickCount) * i
      ticks.push({
        y: PAD.top + chartH - (v / yMax) * chartH,
        label: v.toFixed(0),
      })
    }

    return { linePath: path, xLabels: labels, yTicks: ticks }
  }, [chartData, chartW, chartH, yMax])

  const [hovered, setHovered] = useState<{ x: number; y: number; usage: number; date: string } | null>(null)

  const depletionX = remaining > 0 && chartData.avg > 0
    ? PAD.left + (((chartData.used.length - 1) + remaining / chartData.avg) / Math.max(1, chartData.used.length - 1 + remaining / chartData.avg)) * chartW
    : null

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-storm/40">
        Daily data consumption (MB)
      </p>
      <div className="relative overflow-x-auto">
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="w-full min-w-[300px]"
          role="img"
          aria-label="Daily data usage chart"
          style={{ maxHeight: `${SVG_H}px` }}
        >
          {/* Grid lines */}
          {yTicks.map((tick, i) => (
            <g key={i}>
              <line x1={PAD.left} x2={SVG_W - PAD.right} y1={tick.y} y2={tick.y} stroke="#E2E8F0" strokeWidth="1" />
              <text x={PAD.left - 6} y={tick.y + 3} textAnchor="end" className="text-[10px] fill-storm/30" fontSize="10">{tick.label}</text>
            </g>
          ))}

          {/* Data line */}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="#0EA5E9"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="animate-draw-line motion-reduce:animate-none"
              style={{ strokeDasharray: 2000, strokeDashoffset: 0 }}
            />
          )}

          {/* Average line */}
          <line
            x1={PAD.left}
            x2={SVG_W - PAD.right}
            y1={PAD.top + chartH - (chartData.avg / yMax) * chartH}
            y2={PAD.top + chartH - (chartData.avg / yMax) * chartH}
            stroke="#94A3B8"
            strokeWidth="1"
            strokeDasharray="4 3"
          />
          <text
            x={SVG_W - PAD.right}
            y={PAD.top + chartH - (chartData.avg / yMax) * chartH - 4}
            textAnchor="end"
            className="text-[9px] fill-storm/30"
            fontSize="9"
          >
            avg {chartData.avg.toFixed(1)}
          </text>

          {/* Depletion projection marker */}
          {depletionX !== null && depletionX <= SVG_W - PAD.right && (
            <>
              <line
                x1={depletionX}
                x2={depletionX}
                y1={PAD.top}
                y2={PAD.top + chartH}
                stroke="#F59E0B"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <text
                x={depletionX}
                y={PAD.top - 6}
                textAnchor="middle"
                className="text-[9px] fill-amber"
                fontSize="9"
                fill="#F59E0B"
              >
                projected depletion
              </text>
            </>
          )}

          {/* Hoverable circles */}
          {chartData.used.map((d, i) => {
            const cx = PAD.left + (i / Math.max(1, chartData.used.length - 1)) * chartW
            const cy = PAD.top + chartH - (d.usage_mb / yMax) * chartH
            return (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r="3"
                fill="white"
                stroke="#0EA5E9"
                strokeWidth="1.5"
                className="cursor-pointer"
                style={{ opacity: 0 }}
                onMouseEnter={() => setHovered({ x: cx, y: cy, usage: d.usage_mb, date: d.date })}
                onMouseLeave={() => setHovered(null)}
              />
            )
          })}

          {/* X labels */}
          {xLabels.map((l, i) => (
            <text key={i} x={l.x} y={SVG_H - 6} textAnchor="middle" className="text-[9px] fill-storm/30" fontSize="9">
              {l.label}
            </text>
          ))}
        </svg>
      </div>

      {/* Tooltip */}
      {hovered && (
        <div className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-xs text-xs inline-flex gap-4">
          <span className="text-storm/50">{new Date(hovered.date).toLocaleDateString()}</span>
          <span className="font-semibold text-midnight">{hovered.usage.toFixed(1)} MB</span>
        </div>
      )}
    </div>
  )
}
