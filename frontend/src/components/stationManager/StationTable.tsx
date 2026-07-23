import { useMemo, useState } from 'react'
import type { StationManagementData } from '../../services/api'
import { CONNECTIVITY_LABELS } from '../../services/api'
import { StatusBadge } from '../dashboard/StatusIndicator'

interface StationTableProps {
  stations: StationManagementData[]
  isLoading: boolean
  onEdit: (station: StationManagementData) => void
  onDecommission: (station: StationManagementData) => void
  onDelete: (station: StationManagementData) => void
}

type SortKey = 'name' | 'location' | 'connectivity' | 'status' | 'created_at'

export function StationTable({ stations, isLoading, onEdit, onDecommission, onDelete }: StationTableProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [connFilter, setConnFilter] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const filtered = useMemo(() => {
    let list = stations
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((s) => s.name.toLowerCase().includes(q) || s.location.toLowerCase().includes(q) || s.station_code.toLowerCase().includes(q))
    }
    if (statusFilter !== 'all') list = list.filter((s) => s.status === statusFilter)
    if (connFilter !== 'all') list = list.filter((s) => s.connectivity === connFilter)
    list.sort((a, b) => {
      const aVal = String(a[sortKey] ?? '')
      const bVal = String(b[sortKey] ?? '')
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
    })
    return list
  }, [stations, search, statusFilter, connFilter, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  function SortArrow({ column }: { column: SortKey }) {
    if (sortKey !== column) return null
    return <span className="ml-1 text-[10px]" aria-hidden="true">{sortDir === 'asc' ? '▲' : '▼'}</span>
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-4 rounded-xl border border-slate-200 bg-white p-4">
            <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-16 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-16 animate-pulse rounded bg-slate-200" />
          </div>
        ))}
      </div>
    )
  }

  if (!stations.length) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white px-5 py-16 text-center shadow-xs">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-soft text-sky-bright">
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        </div>
        <p className="mt-4 text-sm font-medium text-midnight">No stations registered yet</p>
        <p className="mt-1 text-xs text-storm/40">Add your first station to start collecting data.</p>
      </div>
    )
  }

  if (!filtered.length) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center shadow-xs">
        <p className="text-sm font-medium text-midnight">No stations match your filters</p>
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
          placeholder="Search by name, code, or location…"
          className="min-w-[200px] flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-midnight placeholder:text-storm/30 focus:outline-2 focus:outline-offset-2 focus:outline-sky-primary"
          aria-label="Search stations"
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-midnight focus:outline-2 focus:outline-offset-2 focus:outline-sky-primary" aria-label="Filter by status">
          <option value="all">All statuses</option>
          <option value="online">Online</option>
          <option value="partial">Partial</option>
          <option value="offline">Offline</option>
        </select>
        <select value={connFilter} onChange={(e) => setConnFilter(e.target.value)} className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-midnight focus:outline-2 focus:outline-offset-2 focus:outline-sky-primary" aria-label="Filter by connectivity">
          <option value="all">All types</option>
          <option value="gsm">GSM</option>
          <option value="lora">LoRa</option>
          <option value="wifi">Wi-Fi</option>
        </select>
      </div>

      {/* ── Table ── */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
        <table className="w-full min-w-[640px] text-sm" role="table">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <Th sortable onClick={() => toggleSort('name')}><SortArrow column="name" />Station</Th>
              <Th sortable onClick={() => toggleSort('location')}><SortArrow column="location" />Location</Th>
              <Th sortable onClick={() => toggleSort('connectivity')}><SortArrow column="connectivity" />Type</Th>
              <Th sortable onClick={() => toggleSort('status')}><SortArrow column="status" />Status</Th>
              <Th sortable onClick={() => toggleSort('created_at')}><SortArrow column="created_at" />Added</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((station) => (
              <tr key={station.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                <td className="px-4 py-3.5">
                  <div>
                    <p className="font-medium text-midnight">{station.name}</p>
                    <p className="text-[11px] text-storm/40 font-mono">{station.station_code}</p>
                  </div>
                </td>
                <td className="px-4 py-3.5 text-storm/70">
                  <span className="text-xs">{station.location}</span>
                  <span className="ml-2 text-[10px] text-storm/30 font-mono">{station.latitude.toFixed(2)}, {station.longitude.toFixed(2)}</span>
                </td>
                <td className="px-4 py-3.5">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-storm/60">{CONNECTIVITY_LABELS[station.connectivity]}</span>
                </td>
                <td className="px-4 py-3.5"><StatusBadge status={station.status} /></td>
                <td className="px-4 py-3.5 text-xs text-storm/40">{new Date(station.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <ActionBtn onClick={() => onEdit(station)} label="Edit" />
                    <ActionBtn onClick={() => onDecommission(station)} label="Decom." variant="warning" />
                    <ActionBtn onClick={() => onDelete(station)} label="Delete" variant="danger" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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

function ActionBtn({ onClick, label, variant }: { onClick: () => void; label: string; variant?: 'danger' | 'warning' }) {
  const color = variant === 'danger' ? 'text-rose-600 hover:bg-rose-50' : variant === 'warning' ? 'text-amber-600 hover:bg-amber-50' : 'text-sky-primary hover:bg-sky-soft'
  return (
    <button type="button" onClick={onClick} className={`cursor-pointer rounded-lg px-2 py-1 text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-primary ${color}`}>
      {label}
    </button>
  )
}
