import { useCallback, useMemo, useRef, useState } from 'react'
import type { SimManagementData } from '../../services/api'
import { updateSimAccount } from '../../services/api'
import { SimUsageBar } from './SimUsageBar'

type SimDisplayStatus = 'active' | 'expiring_soon' | 'expired' | 'inactive'

interface SimTableProps {
  sims: SimManagementData[]
  isLoading: boolean
  activeFilter: 'all' | 'expiring' | 'expired'
  selectedSimId: number | null
  onSelect: (sim: SimManagementData) => void
  onTopUp: (sim: SimManagementData) => void
  onRefresh: () => void
}

function deriveStatus(s: SimManagementData): SimDisplayStatus {
  if (s.sim.status !== 'active') return 'inactive'
  const dr = s.estimated_days_remaining
  const remaining = s.sim.bundle_size_mb - s.sim.usage_mb
  if (remaining <= 0 || dr === 0) return 'expired'
  if (dr !== null && dr <= 7) return 'expiring_soon'
  return 'active'
}

const STATUS_CONFIG: Record<SimDisplayStatus, { label: string; dot: string; text: string; bg: string }> = {
  active:         { label: 'Active',         dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' },
  expiring_soon: { label: 'Expiring soon',  dot: 'bg-amber-500',   text: 'text-amber-700',  bg: 'bg-amber-50' },
  expired:        { label: 'Expired',        dot: 'bg-rose-500',    text: 'text-rose-700',   bg: 'bg-rose-50' },
  inactive:       { label: 'Inactive',       dot: 'bg-storm/30',    text: 'text-storm/50',   bg: 'bg-slate-100' },
}

type SortKey = 'remaining' | 'projected_expiry'

/* ── Inline edit state per row ── */

interface InlineEdit {
  simId: number
  field: 'phone' | 'expiry'
  value: string
}

export function SimTable({ sims, isLoading, activeFilter, selectedSimId, onSelect, onTopUp, onRefresh }: SimTableProps) {
  const [search, setSearch] = useState('')
  const [carrierFilter, setCarrierFilter] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('remaining')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [inlineEdit, setInlineEdit] = useState<InlineEdit | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const carriers = useMemo(() => {
    const set = new Set(sims.map((s) => s.sim.carrier))
    return Array.from(set).sort()
  }, [sims])

  const filtered = useMemo(() => {
    let list = sims

    if (activeFilter === 'expiring') {
      list = list.filter((s) => deriveStatus(s) === 'expiring_soon')
    } else if (activeFilter === 'expired') {
      list = list.filter((s) => deriveStatus(s) === 'expired')
    }

    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (s) =>
              (s.station_name ?? '').toLowerCase().includes(q) ||
              s.sim.carrier.toLowerCase().includes(q) ||
              s.sim.iccid.includes(q) ||
              s.sim.phone_number.includes(q),
      )
    }
    if (carrierFilter !== 'all') list = list.filter((s) => s.sim.carrier === carrierFilter)

    list.sort((a, b) => {
      let aVal: number, bVal: number
      if (sortKey === 'remaining') {
        aVal = a.sim.bundle_size_mb - a.sim.usage_mb
        bVal = b.sim.bundle_size_mb - b.sim.usage_mb
      } else {
        aVal = a.estimated_days_remaining ?? (a.sim.status === 'inactive' ? -1 : 9999)
        bVal = b.estimated_days_remaining ?? (b.sim.status === 'inactive' ? -1 : 9999)
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal
    })

    return list
  }, [sims, search, carrierFilter, sortKey, sortDir, activeFilter])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  function SortArrow({ column }: { column: SortKey }) {
    if (sortKey !== column) return null
    return <span className="ml-1 text-[10px]" aria-hidden="true">{sortDir === 'asc' ? '▲' : '▼'}</span>
  }

  const startEdit = useCallback((simId: number, field: 'phone' | 'expiry', currentValue: string) => {
    setInlineEdit({ simId, field, value: currentValue })
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  const cancelEdit = useCallback(() => {
    setInlineEdit(null)
  }, [])

  const saveEdit = useCallback(async () => {
    if (!inlineEdit) return
    const update: Partial<{ phone_number: string; expiry_date: string }> = {}
    if (inlineEdit.field === 'phone') update.phone_number = inlineEdit.value
    if (inlineEdit.field === 'expiry') update.expiry_date = inlineEdit.value
    await updateSimAccount(inlineEdit.simId, update)
    setInlineEdit(null)
    onRefresh()
  }, [inlineEdit, onRefresh])

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex gap-3">
          <div className="h-9 flex-1 animate-pulse rounded-xl bg-slate-200" />
          <div className="h-9 w-28 animate-pulse rounded-xl bg-slate-200" />
        </div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-4 rounded-xl border border-slate-200 bg-white p-4">
            <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-16 animate-pulse rounded bg-slate-200" />
          </div>
        ))}
      </div>
    )
  }

  if (!sims.length) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white px-5 py-16 text-center shadow-xs">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-soft text-sky-bright">
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7" />
            <path d="M15 3H9v4h6V3z" />
            <path d="M12 12v4" />
            <circle cx="12" cy="8" r="0.5" fill="currentColor" />
          </svg>
        </div>
        <p className="mt-4 text-sm font-medium text-midnight">No SIMs registered</p>
        <p className="mt-1 text-xs text-storm/40">Go to Station Manager to assign a SIM to a station.</p>
        <a
          href="/dashboard/station-manager"
          className="mt-4 inline-flex cursor-pointer rounded-full bg-sky-soft px-4 py-2 text-xs font-semibold text-sky-deep transition-colors hover:bg-sky-mist"
        >
          Station Manager
        </a>
      </div>
    )
  }

  if (!filtered.length) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center shadow-xs">
        <p className="text-sm font-medium text-midnight">No SIMs match your filters</p>
        <p className="mt-1 text-xs text-storm/40">Try adjusting the search or filter criteria.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* ── Filter bar ── */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by station name, carrier, or ICCID…"
          className="min-w-[200px] flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-midnight placeholder:text-storm/30 focus:outline-2 focus:outline-offset-2 focus:outline-sky-primary"
          aria-label="Search SIMs"
        />
        <select
          value={carrierFilter}
          onChange={(e) => setCarrierFilter(e.target.value)}
          className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-midnight focus:outline-2 focus:outline-offset-2 focus:outline-sky-primary"
          aria-label="Filter by carrier"
        >
          <option value="all">All carriers</option>
          {carriers.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={onRefresh}
          className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-storm/60 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-primary"
          aria-label="Refresh data"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
          </svg>
          <span className="sr-only">Refresh</span>
        </button>
      </div>

      {/* ── Table ── */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
        <table className="w-full min-w-[700px] text-sm" role="table">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <Th>Station</Th>
              <Th>Carrier / ICCID</Th>
              <Th>Phone</Th>
              <Th>Data usage</Th>
              <Th sortable onClick={() => toggleSort('remaining')}>
                <SortArrow column="remaining" />Remaining
              </Th>
              <Th sortable onClick={() => toggleSort('projected_expiry')}>
                <SortArrow column="projected_expiry" />Projected expiry
              </Th>
              <Th>Status</Th>
              <Th className="text-right">Action</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((entry) => {
              const status = deriveStatus(entry)
              const cfg = STATUS_CONFIG[status]
              const remaining = Math.max(0, entry.sim.bundle_size_mb - entry.sim.usage_mb)
              const isSelected = entry.sim.id === selectedSimId
              const isEditingThis = inlineEdit?.simId === entry.sim.id

              return (
                <tr
                  key={entry.sim.id}
                  className={`border-b border-slate-100 last:border-0 transition-colors ${
                    isSelected
                      ? 'bg-sky-soft/40 hover:bg-sky-soft/60'
                      : 'hover:bg-slate-50/50'
                  }`}
                  tabIndex={0}
                  role="row"
                  aria-selected={isSelected}
                >
                  <td
                    className="cursor-pointer px-4 py-3"
                    onClick={() => onSelect(entry)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(entry) } }}
                  >
                    <span className="font-medium text-midnight">
                      {entry.station_name ?? <span className="text-storm/30 italic">Unassigned</span>}
                    </span>
                  </td>
                  <td
                    className="cursor-pointer px-4 py-3"
                    onClick={() => onSelect(entry)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(entry) } }}
                  >
                    <div>
                      <p className="text-xs font-medium text-midnight">{entry.sim.carrier}</p>
                      <p className="text-[11px] text-storm/40 font-mono">…{entry.sim.iccid.slice(-6)}</p>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {isEditingThis && inlineEdit.field === 'phone' ? (
                      <div className="flex items-center gap-1">
                        <input
                          ref={inputRef}
                          type="text"
                          value={inlineEdit.value}
                          onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit() }}
                          className="w-24 rounded border border-sky-200 px-1 py-0.5 text-xs text-midnight focus:outline-2 focus:outline-offset-1 focus:outline-sky-primary"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); saveEdit() }}
                          className="cursor-pointer rounded bg-sky-primary px-1.5 py-0.5 text-[10px] font-semibold text-white hover:bg-sky-deep"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); cancelEdit() }}
                          className="cursor-pointer rounded px-1.5 py-0.5 text-[10px] text-storm/50 hover:text-storm/70"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); startEdit(entry.sim.id, 'phone', entry.sim.phone_number) }}
                        className="group flex items-center gap-1 text-xs text-storm/60 hover:text-storm/80"
                      >
                        <span>{entry.sim.phone_number || <span className="text-storm/30 italic">—</span>}</span>
                        <svg className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        </svg>
                      </button>
                    )}
                  </td>
                  <td
                    className="cursor-pointer px-4 py-3 min-w-[200px]"
                    onClick={() => onSelect(entry)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(entry) } }}
                  >
                    <SimUsageBar used={entry.sim.usage_mb} total={entry.sim.bundle_size_mb} />
                  </td>
                  <td
                    className="cursor-pointer whitespace-nowrap px-4 py-3"
                    onClick={() => onSelect(entry)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(entry) } }}
                  >
                    <span className={`text-sm font-semibold font-display tabular-nums ${
                      remaining <= 0 ? 'text-rose' : remaining < entry.sim.bundle_size_mb * 0.1 ? 'text-amber' : 'text-midnight'
                    }`}>
                      {remaining.toLocaleString()} MB
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {isEditingThis && inlineEdit.field === 'expiry' ? (
                      <div className="flex items-center gap-1">
                        <input
                          ref={inputRef}
                          type="date"
                          value={inlineEdit.value}
                          onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit() }}
                          className="w-28 rounded border border-sky-200 px-1 py-0.5 text-xs text-midnight focus:outline-2 focus:outline-offset-1 focus:outline-sky-primary"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); saveEdit() }}
                          className="cursor-pointer rounded bg-sky-primary px-1.5 py-0.5 text-[10px] font-semibold text-white hover:bg-sky-deep"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); cancelEdit() }}
                          className="cursor-pointer rounded px-1.5 py-0.5 text-[10px] text-storm/50 hover:text-storm/70"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); startEdit(entry.sim.id, 'expiry', entry.sim.expiry_date) }}
                        className="group flex items-center gap-1"
                      >
                        {entry.estimated_days_remaining !== null && entry.sim.status === 'active' ? (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                              entry.estimated_days_remaining <= 3
                                ? 'bg-rose-100 text-rose-700'
                                : entry.estimated_days_remaining <= 7
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-emerald-50 text-emerald-700'
                            }`}
                          >
                            {entry.estimated_days_remaining === 0
                              ? 'Expired'
                              : `${entry.estimated_days_remaining} day${entry.estimated_days_remaining !== 1 ? 's' : ''}`}
                          </span>
                        ) : (
                          <span className="text-xs text-storm/30">—</span>
                        )}
                        <svg className="h-3 w-3 text-storm/30 opacity-0 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        </svg>
                      </button>
                    )}
                  </td>
                  <td
                    className="cursor-pointer px-4 py-3"
                    onClick={() => onSelect(entry)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(entry) } }}
                  >
                    <span className={`inline-flex items-center gap-1.5 rounded-full ${cfg.bg} px-2.5 py-0.5 text-[11px] font-semibold ${cfg.text}`}>
                      <span className={`inline-block h-1.5 w-1.5 rounded-full ${cfg.dot}`} aria-hidden="true" />
                      {cfg.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {entry.sim.status === 'active' && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onTopUp(entry) }}
                        className="cursor-pointer rounded-lg bg-sky-primary px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-sky-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-primary"
                      >
                        Top up
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Row count ── */}
      <p className="text-xs text-storm/40">
        Showing {filtered.length} of {sims.length} SIM{sims.length !== 1 ? 's' : ''}
      </p>
    </div>
  )
}

function Th({ children, sortable, onClick, className }: { children: React.ReactNode; sortable?: boolean; onClick?: () => void; className?: string }) {
  const base = 'px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-storm/40'
  if (sortable) {
    return <th className={`${base} cursor-pointer select-none hover:text-storm/60 ${className ?? ''}`} onClick={onClick} scope="col">{children}</th>
  }
  return <th className={`${base} ${className ?? ''}`} scope="col">{children}</th>
}
