import { useState } from 'react'
import { useDashboardData } from '../hooks/useDashboardData'
import { type StationReading, formatRelativeTime } from '../services/api'
import { DashboardSidebar } from '../components/dashboard/DashboardSidebar'
import { StatusIndicator } from '../components/dashboard/StatusIndicator'
import { SkeletonCard } from '../components/dashboard/SkeletonCard'
import { MapPinIcon, ClockIcon, CloseIcon } from '../components/landing/Icons'

const STATUS_PIN_COLORS: Record<string, string> = {
  online: '#22C55E',
  partial: '#F59E0B',
  offline: '#E11D48',
}

const BOUNDS = {
  minLat: -1.5,
  maxLat: 4.0,
  minLng: 29.5,
  maxLng: 35.0,
}

function toSvgCoord(lat: number, lng: number) {
  const x = ((lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * 100
  const y = ((BOUNDS.maxLat - lat) / (BOUNDS.maxLat - BOUNDS.minLat)) * 100
  return { x, y }
}

export function StationMapPage() {
  const { data, isLoading } = useDashboardData()
  const [selectedStation, setSelectedStation] = useState<StationReading | null>(null)
  const [hoveredStation, setHoveredStation] = useState<number | null>(null)

  const stations = data?.stations.filter((s) => s.latitude && s.longitude) ?? []

  return (
    <div className="flex min-h-screen flex-col bg-mist lg:h-screen lg:flex-row">
      <DashboardSidebar />

      <main className="relative flex flex-1 flex-col overflow-y-auto px-5 py-5 sm:px-6 lg:px-8 lg:py-6">
        {/* ── Header ── */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-primary">Mapping</p>
            <h1 className="mt-1.5 text-2xl font-semibold text-midnight font-display">Station map</h1>
            <p className="mt-1 text-sm text-storm/50">
              {data ? `${stations.length} stations plotted` : 'Loading...'}
            </p>
          </div>
        </div>

        {isLoading && !data && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {data && (
          <div className="flex flex-1 flex-col gap-6 lg:flex-row">
            {/* ── Map panel ── */}
            <section
              className="relative flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs"
              aria-label="Station map"
            >
              {/* Map header */}
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
                <div className="flex items-center gap-4">
                  <MapLegendDot color="#22C55E" label="Online" />
                  <MapLegendDot color="#F59E0B" label="Partial" />
                  <MapLegendDot color="#E11D48" label="Offline" />
                </div>
                <span className="text-xs text-storm/40">{stations.length} stations</span>
              </div>

              {/* SVG Map */}
              <div className="bg-gradient-to-b from-sky-soft/60 to-white p-4">
                <svg
                  viewBox="0 0 100 100"
                  className="h-full w-full"
                  role="img"
                  aria-label={`Map showing ${stations.length} weather stations`}
                  preserveAspectRatio="xMidYMid meet"
                  style={{ minHeight: '400px' }}
                >
                  <defs>
                    <pattern id="map-grid-lg" width="10" height="10" patternUnits="userSpaceOnUse">
                      <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#BAE6FD" strokeWidth="0.15" opacity="0.5" />
                    </pattern>
                    <filter id="pin-shadow">
                      <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#0F172A" floodOpacity="0.15" />
                    </filter>
                  </defs>
                  <rect width="100" height="100" fill="url(#map-grid-lg)" />

                  {/* Equator */}
                  <line
                    x1="0"
                    y1={toSvgCoord(0, BOUNDS.minLng).y}
                    x2="100"
                    y2={toSvgCoord(0, BOUNDS.maxLng).y}
                    stroke="#93C5FD" strokeWidth="0.4" strokeDasharray="2 2" opacity="0.5"
                  />
                  <text x="97" y={toSvgCoord(0, BOUNDS.maxLng).y - 0.8} fontSize="1.8" fill="#93C5FD" opacity="0.5">
                    Equator
                  </text>

                  {/* Station pins */}
                  {stations.map((station) => {
                    const { x, y } = toSvgCoord(station.latitude, station.longitude)
                    const color = STATUS_PIN_COLORS[station.status] || '#94A3B8'
                    const isHovered = hoveredStation === station.id
                    const isSelected = selectedStation?.id === station.id
                    const pinR = isHovered || isSelected ? 4 : 3

                    return (
                      <g
                        key={station.id}
                        onClick={() => setSelectedStation(isSelected ? null : station)}
                        onMouseEnter={() => setHoveredStation(station.id)}
                        onMouseLeave={() => setHoveredStation(null)}
                        style={{ cursor: 'pointer' }}
                        role="button"
                        tabIndex={0}
                        aria-label={`${station.name} — ${station.status}`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            setSelectedStation(isSelected ? null : station)
                          }
                        }}
                      >
                        {/* Pin shadow */}
                        <circle cx={x} cy={y + 1.5} r={pinR + 0.5} fill="#0F172A" opacity="0.12" />
                        {/* Pin */}
                        <circle
                          cx={x} cy={y} r={pinR}
                          fill={color}
                          stroke="#FFFFFF"
                          strokeWidth="1.2"
                          filter="url(#pin-shadow)"
                        />
                        {/* Label */}
                        <text
                          x={x}
                          y={y - pinR - 2.5}
                          textAnchor="middle"
                          fontSize={isHovered || isSelected ? '3' : '2.5'}
                          fontWeight="600"
                          fill="#1E293B"
                          opacity={isHovered || isSelected ? '1' : '0.7'}
                        >
                          {station.station_code.replace('AWS-', '')}
                        </text>
                      </g>
                    )
                  })}

                  {stations.length === 0 && (
                    <text x="50" y="50" textAnchor="middle" fontSize="3.5" fill="#94A3B8">
                      No station location data available
                    </text>
                  )}
                </svg>
              </div>
            </section>

            {/* ── Station info panel ── */}
            <aside className="w-full shrink-0 lg:w-80">
              {selectedStation ? (
                <StationDetailCard
                  station={selectedStation}
                  onClose={() => setSelectedStation(null)}
                />
              ) : (
                <StationListPanel
                  stations={stations}
                  onSelect={setSelectedStation}
                  selectedId={selectedStation?.id ?? null}
                />
              )}
            </aside>
          </div>
        )}
      </main>
    </div>
  )
}

/* ── Station detail card ── */

function StationDetailCard({
  station,
  onClose,
}: {
  station: StationReading
  onClose: () => void
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <MapPinIcon className="h-4 w-4 text-sky-primary" />
          <h2 className="text-sm font-semibold text-midnight font-display">{station.name}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex cursor-pointer rounded-full p-1 text-storm/40 transition-colors hover:bg-slate-100 hover:text-storm"
          aria-label="Close station detail"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4 px-5 py-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-storm/40">{station.station_code}</span>
          <StatusIndicator status={station.status} />
        </div>

        <p className="flex items-center gap-1.5 text-xs text-storm/50">
          <MapPinIcon className="h-3.5 w-3.5" />
          {station.location}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <DetailSensor label="Temperature" value={station.temperature} />
          <DetailSensor label="Humidity" value={station.humidity} />
          <DetailSensor label="Rainfall" value={station.rainfall} />
          <DetailSensor label="Wind speed" value={station.wind_speed} />
          <div className="col-span-2">
            <DetailSensor label="Pressure" value={station.pressure} />
          </div>
        </div>

        <div className="flex items-center gap-1.5 border-t border-slate-100 pt-3 text-xs text-storm/40">
          <ClockIcon className="h-3.5 w-3.5" />
          Last seen {formatRelativeTime(station.last_seen)}
          {station.is_stale && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
              Stale
            </span>
          )}
        </div>
      </div>
    </section>
  )
}

function DetailSensor({
  label,
  value,
}: {
  label: string
  value: { value: number; unit: string } | null
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-storm/40">{label}</p>
      {value ? (
        <p className="mt-0.5 text-sm font-semibold tabular-nums text-midnight">
          {value.value.toFixed(value.unit === '°C' ? 1 : 0)}
          <span className="text-storm/40 text-[10px] ml-0.5">{value.unit}</span>
        </p>
      ) : (
        <p className="mt-0.5 text-sm text-storm/30">—</p>
      )}
    </div>
  )
}

/* ── Station list panel ── */

function StationListPanel({
  stations,
  onSelect,
  selectedId,
}: {
  stations: StationReading[]
  onSelect: (s: StationReading) => void
  selectedId: number | null
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-xs">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-midnight font-display">All stations</h2>
        <p className="text-xs text-storm/40">{stations.length} total</p>
      </div>

      <div className="max-h-[500px] space-y-1 overflow-y-auto p-2">
        {stations.map((station) => {
          const color = STATUS_PIN_COLORS[station.status] || '#94A3B8'
          return (
            <button
              key={station.id}
              type="button"
              onClick={() => onSelect(station)}
              className={`flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-150 ${
                selectedId === station.id
                  ? 'bg-sky-soft ring-1 ring-sky-200'
                  : 'hover:bg-slate-50'
              }`}
            >
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-midnight">{station.name}</p>
                <p className="text-xs text-storm/40">{station.station_code}</p>
              </div>
              <span className="text-[10px] text-storm/40">
                {formatRelativeTime(station.last_seen)}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

/* ── Legend dot ── */

function MapLegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-storm/50">
      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
      {label}
    </span>
  )
}
