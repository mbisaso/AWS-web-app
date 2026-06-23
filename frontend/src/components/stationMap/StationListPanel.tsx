import { useState } from 'react'
import type { StationReading } from '../../services/api'
import { formatRelativeTime } from '../../services/api'

interface StationListPanelProps {
  stations: StationReading[]
  selectedId: number | null
  alertIds: Set<number>
  onSelect: (station: StationReading) => void
  isOpen: boolean
  onToggle: () => void
  totalCount: number
}

const STATUS_COLORS: Record<string, string> = {
  online: '#22C55E',
  partial: '#F59E0B',
  offline: '#E11D48',
}

export function StationListPanel({
  stations,
  selectedId,
  alertIds,
  onSelect,
  isOpen,
  onToggle,
  totalCount,
}: StationListPanelProps) {
  const [query, setQuery] = useState('')

  const filtered = query
    ? stations.filter(
        (s) =>
          s.name.toLowerCase().includes(query.toLowerCase()) ||
          s.station_code.toLowerCase().includes(query.toLowerCase()),
      )
    : stations

  return (
    <>
      {/* Toggle button (visible when panel closed on mobile) */}
      <button
        type="button"
        onClick={onToggle}
        className="fixed bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-full bg-midnight px-5 py-2.5 text-xs font-semibold text-white shadow-lg transition-all hover:bg-storm md:hidden"
        aria-label={isOpen ? 'Close station list' : 'Open station list'}
        aria-expanded={isOpen}
      >
        {isOpen ? 'Hide list' : `Show list (${stations.length})`}
      </button>

      {/* Overlay (mobile) */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/20 md:hidden"
          onClick={onToggle}
          aria-hidden="true"
        />
      )}

      {/* Panel */}
      <aside
        className={`shrink-0 border-l border-slate-200 bg-white transition-all duration-300 ease-in-out ${
          isOpen
            ? 'w-full md:w-80'
            : 'w-0 overflow-hidden md:w-0'
        } ${isOpen ? 'fixed inset-x-0 bottom-0 z-30 max-h-[60vh] rounded-t-2xl md:static md:z-auto md:max-h-none md:rounded-none' : 'hidden md:block'}`}
        aria-label="Station list"
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-midnight font-display">
                Stations
              </h2>
              <p className="text-xs text-storm/40">
                {stations.length} of {totalCount} shown
              </p>
            </div>
            <button
              type="button"
              onClick={onToggle}
              className="flex cursor-pointer rounded-lg p-1.5 text-storm/40 transition-colors hover:bg-slate-100 hover:text-storm md:hidden"
              aria-label="Close panel"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 4L4 12M4 4l8 8" />
              </svg>
            </button>
          </div>

          {/* Search */}
          <div className="px-3 pt-3">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or code..."
              aria-label="Search stations in list"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-midnight placeholder:text-storm/30 focus:border-sky-200 focus:ring-2 focus:ring-sky-soft focus:outline-none transition-colors"
            />
          </div>

          {/* List */}
          <div className="flex-1 space-y-0.5 overflow-y-auto p-2">
            {filtered.map((station) => {
              const statusColor = STATUS_COLORS[alertIds.has(station.id) ? 'offline' : station.status] || '#94A3B8'
              const isSelected = selectedId === station.id
              return (
                <button
                  key={station.id}
                  type="button"
                  onClick={() => onSelect(station)}
                  className={`flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-150 ${
                    isSelected
                      ? 'bg-sky-soft ring-1 ring-sky-200'
                      : 'hover:bg-slate-50'
                  }`}
                  aria-current={isSelected ? 'true' : undefined}
                >
                  <span
                    className="inline-flex h-2.5 w-2.5 shrink-0 items-center justify-center"
                    aria-hidden="true"
                  >
                    {alertIds.has(station.id) ? (
                      <span className="flex h-2.5 w-2.5 items-center justify-center">
                        <span className="absolute inline-flex h-3 w-3 animate-ping rounded-full bg-rose-300 opacity-75 motion-reduce:animate-none" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
                      </span>
                    ) : (
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: statusColor }}
                      />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-midnight">
                      {station.name}
                    </p>
                    <p className="text-xs text-storm/40">{station.station_code}</p>
                  </div>
                  <span className="shrink-0 text-[10px] text-storm/40">
                    {formatRelativeTime(station.last_seen)}
                  </span>
                </button>
              )
            })}

            {query && filtered.length === 0 && (
              <p className="py-6 text-center text-xs text-storm/40">
                No stations match &quot;{query}&quot;
              </p>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
