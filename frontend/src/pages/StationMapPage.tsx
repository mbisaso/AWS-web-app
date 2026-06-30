import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  APIProvider,
  Map,
  InfoWindow,
  useApiIsLoaded,
  useApiLoadingStatus,
  useMap,
} from '@vis.gl/react-google-maps'
import { useDashboardData } from '../hooks/useDashboardData'
import { type StationReading, formatRelativeTime } from '../services/api'
import { DashboardSidebar } from '../components/dashboard/DashboardSidebar'
import { StatusBadge } from '../components/dashboard/StatusIndicator'
import { StationMarker } from '../components/stationMap/StationMarker'
import { StatusFilterBar, type StationFilter } from '../components/stationMap/StatusFilterBar'
import { StationListPanel } from '../components/stationMap/StationListPanel'


function hasActiveAlerts(
  station: StationReading,
  alerts: { station_name: string }[],
): boolean {
  return alerts.some(
    (a) =>
      a.station_name.startsWith(station.station_code) ||
      a.station_name.includes(station.name.split(' ')[0]),
  )
}


export function StationMapPage() {
  const { data, isLoading, error, retry } = useDashboardData()

  const [filter, setFilter] = useState<StationFilter>('all')
  const [selectedStation, setSelectedStation] = useState<StationReading | null>(null)
  const [detailStation, setDetailStation] = useState<StationReading | null>(null)
  const [isListOpen, setIsListOpen] = useState(true)
  const [recenterCount, setRecenterCount] = useState(0)

  /* ── Determine which stations have alerts ── */
  const alertStationIds = useMemo(() => {
    if (!data) return new Set<number>()
    return new Set(
      data.stations.filter((s) => hasActiveAlerts(s, data.alerts)).map((s) => s.id),
    )
  }, [data])

  /* ── Filtered stations ── */
  const filteredStations = useMemo(() => {
    if (!data) return []
    let result = data.stations.filter((s) => s.latitude && s.longitude)

    if (filter === 'online') result = result.filter((s) => s.status === 'online')
    else if (filter === 'offline') result = result.filter((s) => s.status !== 'online')
    else if (filter === 'fault') result = result.filter((s) => alertStationIds.has(s.id))

    return result
  }, [data, filter, alertStationIds])

  /* ── Filter counts ── */
  const filterCounts = useMemo(() => {
    const allPlotted = data?.stations.filter((s) => s.latitude && s.longitude) ?? []
    return {
      all: allPlotted.length,
      online: allPlotted.filter((s) => s.status === 'online').length,
      offline: allPlotted.filter((s) => s.status !== 'online').length,
      fault: alertStationIds.size,
    }
  }, [data, alertStationIds])

  const handleSelect = useCallback((station: StationReading | null) => {
    setSelectedStation(station)
  }, [])

  const handleRecenter = useCallback(() => {
    setRecenterCount((c) => c + 1)
  }, [])

  /* ── API key ── */
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined

  /* ── Loading: no data yet ── */
  if (isLoading && !data) {
    return (
      <div className="flex h-screen bg-mist">
        <DashboardSidebar />
        <MapSkeleton />
      </div>
    )
  }

  /* ── Error: fetch failed, no cached data ── */
  if (error && !data) {
    return (
      <div className="flex h-screen bg-mist">
        <DashboardSidebar />
        <div className="flex flex-1 items-center justify-center">
          <div className="max-w-md px-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50">
              <ShieldExclamation />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-midnight font-display">
              Failed to load station data
            </h2>
            <p className="mt-2 text-sm text-storm/60">{error}</p>
            <button
              type="button"
              onClick={retry}
              className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-full bg-midnight px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-storm"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ── Missing or placeholder API key ── */
  if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
    return (
      <div className="flex h-screen bg-mist">
        <DashboardSidebar />
        <div className="flex flex-1 items-center justify-center">
          <div className="max-w-md px-6 text-center">
            <h2 className="text-lg font-semibold text-midnight font-display">
              Map not configured
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-storm/60">
              Set{' '}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono">
                VITE_GOOGLE_MAPS_API_KEY
              </code>{' '}
              in{' '}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono">
                frontend/.env
              </code>{' '}
              to enable the station map.
            </p>
            <p className="mt-3 text-xs text-storm/40">
              Remember to restrict the key by domain/referrer in Google Cloud Console.
            </p>
          </div>
        </div>
      </div>
    )
  }

  /* ── Main render ── */
  const hasPlottedStations = data && data.stations.some((s) => s.latitude && s.longitude)

  return (
    <>
      <div className="flex h-screen bg-mist">
        <DashboardSidebar />

        <main className="flex min-w-0 flex-1">
          <div className="relative flex-1">
            <APIProvider apiKey={apiKey}>
              {!hasPlottedStations && data ? (
                <EmptyMapState
                  onAdd={() => {
                    /* future: navigate to station registration */
                  }}
                />
              ) : (
                <MapScreenContent
                  stations={filteredStations}
                  allStations={data?.stations ?? []}
                  alertStationIds={alertStationIds}
                  selectedStation={selectedStation}
                  onSelect={handleSelect}
                  onViewDetails={setDetailStation}
                  filter={filter}
                  filterCounts={filterCounts}
                  onFilterChange={setFilter}
                  onRecenter={handleRecenter}
                  recenterCount={recenterCount}
                />
              )}
            </APIProvider>
          </div>

          <StationListPanel
            stations={filteredStations}
            totalCount={
              data?.stations.filter((s) => s.latitude && s.longitude).length ?? 0
            }
            selectedId={selectedStation?.id ?? null}
            alertIds={alertStationIds}
            onSelect={handleSelect}
            isOpen={isListOpen}
            onToggle={() => setIsListOpen((o) => !o)}
          />
        </main>
      </div>

      {detailStation && <StationDetailDialog station={detailStation} onClose={() => setDetailStation(null)} />}
    </>
  )
}

/* ── Map content container ── */

function MapScreenContent({
  stations,
  allStations,
  alertStationIds,
  selectedStation,
  onSelect,
  onViewDetails,
  filter,
  filterCounts,
  onFilterChange,
  onRecenter,
  recenterCount,
}: {
  stations: StationReading[]
  allStations: StationReading[]
  alertStationIds: Set<number>
  selectedStation: StationReading | null
  onSelect: (s: StationReading | null) => void
  onViewDetails: (s: StationReading) => void
  filter: StationFilter
  filterCounts: Record<StationFilter, number>
  onFilterChange: (f: StationFilter) => void
  onRecenter: () => void
  recenterCount: number
}) {
  const apiIsLoaded = useApiIsLoaded()
  const apiStatus = useApiLoadingStatus()

  return (
    <div className="relative h-full w-full">
      {apiStatus === 'FAILED' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-mist">
          <div className="max-w-sm px-6 text-center">
            <h2 className="text-lg font-semibold text-midnight font-display">
              Map failed to load
            </h2>
            <p className="mt-2 text-sm text-storm/60">
              Google Maps could not initialize. Check that your API key is valid, 
              the Maps JavaScript API is enabled, and the key is not restricted. 
              See console for details.
            </p>
          </div>
        </div>
      )}

      {!apiIsLoaded && apiStatus !== 'FAILED' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-mist">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-sky-light border-t-sky-primary" />
            <p className="text-sm text-storm/50">Loading Google Maps...</p>
          </div>
        </div>
      )}

      <Map
        className="h-full w-full"
        defaultZoom={7}
        defaultCenter={{ lat: 1.5, lng: 32.5 }}
        gestureHandling="greedy"
        disableDefaultUI
        clickableIcons={false}
        onClick={() => onSelect(null)}
      >
        <MapView
          stations={stations}
          allStations={allStations}
          alertStationIds={alertStationIds}
          selectedStation={selectedStation}
          onSelect={onSelect}
          onViewDetails={onViewDetails}
          recenterCount={recenterCount}
        />
      </Map>

      {/* ── Floating controls ── */}
      <div className="pointer-events-none absolute inset-0 z-10">
        <div className="pointer-events-auto absolute left-4 top-4">
          <StatusFilterBar current={filter} onChange={onFilterChange} counts={filterCounts} />
        </div>

        <div className="pointer-events-auto absolute right-4 top-4 max-w-[200px]">
          <SearchStationInput stations={allStations} onSelect={onSelect} />
        </div>

        <div className="pointer-events-auto absolute bottom-4 right-4">
          <RecenterButton onClick={onRecenter} count={stations.length} />
        </div>
      </div>
    </div>
  )
}

/* ── Map-aware child (rendered inside <Map> so useMap() works) ── */

function MapView({
  stations,
  allStations,
  alertStationIds,
  selectedStation,
  onSelect,
  onViewDetails,
  recenterCount,
}: {
  stations: StationReading[]
  allStations: StationReading[]
  alertStationIds: Set<number>
  selectedStation: StationReading | null
  onSelect: (s: StationReading | null) => void
  onViewDetails: (s: StationReading) => void
  recenterCount: number
}) {
  const map = useMap()

  /* Fit bounds on first load */
  const hasFitted = useRef(false)
  useEffect(() => {
    if (!map || !allStations.length || hasFitted.current) return
    const bounds = new google.maps.LatLngBounds()
    allStations
      .filter((s) => s.latitude && s.longitude)
      .forEach((s) => bounds.extend({ lat: s.latitude, lng: s.longitude }))
    map.fitBounds(bounds, 60)
    hasFitted.current = true
  }, [map, allStations])

  /* Pan to selected station */
  useEffect(() => {
    if (!map || !selectedStation) return
    map.panTo({ lat: selectedStation.latitude, lng: selectedStation.longitude })
  }, [map, selectedStation])

  /* Recenter triggered */
  useEffect(() => {
    if (!map || !allStations.length || recenterCount === 0) return
    const bounds = new google.maps.LatLngBounds()
    allStations
      .filter((s) => s.latitude && s.longitude)
      .forEach((s) => bounds.extend({ lat: s.latitude, lng: s.longitude }))
    map.fitBounds(bounds, 60)
  }, [map, allStations, recenterCount])

  return (
    <>
      {stations.map((station) => (
        <StationMarker
          key={station.id}
          station={station}
          hasAlerts={alertStationIds.has(station.id)}
          isSelected={selectedStation?.id === station.id}
          onClick={() => onSelect(station)}
        />
      ))}

      {selectedStation && (
        <InfoWindow
          position={{
            lat: selectedStation.latitude,
            lng: selectedStation.longitude,
          }}
          onCloseClick={() => onSelect(null)}
          pixelOffset={[0, -18]}
        >
          <InfoWindowContent station={selectedStation} onViewDetails={onViewDetails} />
        </InfoWindow>
      )}
    </>
  )
}

/* ── InfoWindow content ── */

function InfoWindowContent({ station, onViewDetails }: { station: StationReading; onViewDetails: (s: StationReading) => void }) {
  return (
    <div className="min-w-[220px] py-1" aria-label={`Station details for ${station.name}`}>
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-midnight font-display">{station.name}</h3>
        <StatusBadge status={station.status} />
      </div>
      <p className="mb-2 text-xs text-storm/50">
        {station.station_code} &middot; {station.location}
      </p>

      {station.temperature && (
        <div className="mb-2 grid grid-cols-2 gap-x-4 gap-y-1">
          <SensorReading label="Temp" value={station.temperature ? `${station.temperature.value.toFixed(1)}°C` : '—'} />
          <SensorReading label="Humidity" value={station.humidity ? `${station.humidity.value.toFixed(0)}%` : '—'} />
          <SensorReading label="Rainfall" value={station.rainfall ? `${station.rainfall.value.toFixed(1)}mm` : '—'} />
          <SensorReading label="Wind" value={station.wind_speed ? `${station.wind_speed.value.toFixed(1)}m/s` : '—'} />
        </div>
      )}

      <div className="mt-2 flex items-center gap-1.5 border-t border-slate-100 pt-2 text-[10px] text-storm/40">
        Last seen {formatRelativeTime(station.last_seen)}
        {station.is_stale && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-semibold text-amber-700">Stale</span>
        )}
      </div>

      <button
        type="button"
        onClick={() => onViewDetails(station)}
        className="mt-2 inline-flex cursor-pointer text-xs font-medium text-sky-primary transition-colors hover:text-sky-deep"
      >
        View station details &rarr;
      </button>
    </div>
  )
}

/* ── Station Detail Dialog ── */

function StationDetailDialog({ station, onClose }: { station: StationReading; onClose: () => void }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl animate-fade-in-up motion-reduce:animate-none">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{station.station_code}</p>
            <h2 className="mt-1 text-lg font-semibold text-midnight">{station.name}</h2>
          </div>
          <button type="button" onClick={onClose} className="cursor-pointer rounded-lg p-1.5 text-storm/40 transition-colors hover:bg-slate-100 hover:text-storm/70" aria-label="Close">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={station.status} />
            {station.is_stale && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">Stale data</span>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-[#f8fafc] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Location</p>
              <p className="mt-1 text-sm text-midnight">{station.location || '—'}</p>
            </div>
            <div className="rounded-xl bg-[#f8fafc] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Coordinates</p>
              <p className="mt-1 text-sm text-midnight">
                {station.latitude != null && station.longitude != null
                  ? `${station.latitude.toFixed(4)}, ${station.longitude.toFixed(4)}`
                  : '—'}
              </p>
            </div>
            <div className="rounded-xl bg-[#f8fafc] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Expected Interval</p>
              <p className="mt-1 text-sm text-midnight">{station.expected_interval_minutes} min</p>
            </div>
            <div className="rounded-xl bg-[#f8fafc] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Last Seen</p>
              <p className="mt-1 text-sm text-midnight">{new Date(station.last_seen).toLocaleString()}</p>
            </div>
          </div>

          {station.temperature && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Latest Sensor Readings</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-slate-500">Temperature</p>
                  <p className="mt-0.5 text-sm font-semibold text-midnight">{station.temperature ? `${station.temperature.value.toFixed(1)}°C` : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Humidity</p>
                  <p className="mt-0.5 text-sm font-semibold text-midnight">{station.humidity ? `${station.humidity.value.toFixed(0)}%` : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Rainfall</p>
                  <p className="mt-0.5 text-sm font-semibold text-midnight">{station.rainfall ? `${station.rainfall.value.toFixed(1)}mm` : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Wind Speed</p>
                  <p className="mt-0.5 text-sm font-semibold text-midnight">{station.wind_speed ? `${station.wind_speed.value.toFixed(1)}m/s` : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Pressure</p>
                  <p className="mt-0.5 text-sm font-semibold text-midnight">{station.pressure ? `${station.pressure.value.toFixed(1)}hPa` : '—'}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Sub-components ── */

function SensorReading({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-storm/40">{label}</p>
      <p className="text-xs font-semibold tabular-nums text-midnight">{value}</p>
    </div>
  )
}

function SearchStationInput({
  stations,
  onSelect,
}: {
  stations: StationReading[]
  onSelect: (s: StationReading | null) => void
}) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const results =
    query.length >= 2
      ? stations
          .filter(
            (s) =>
              s.name.toLowerCase().includes(query.toLowerCase()) ||
              s.station_code.toLowerCase().includes(query.toLowerCase()),
          )
          .slice(0, 6)
      : []

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-storm/30"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search station..."
          aria-label="Search for a station by name or code"
          className="w-full rounded-xl border border-slate-200/80 bg-white/90 py-2 pl-9 pr-3 text-xs text-midnight placeholder:text-storm/30 shadow-sm backdrop-blur-md transition-colors focus:border-sky-200 focus:ring-2 focus:ring-sky-soft focus:outline-none"
        />
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute top-full mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
          {results.map((station) => (
            <button
              key={station.id}
              type="button"
              onClick={() => {
                onSelect(station)
                setQuery('')
                setIsOpen(false)
              }}
              className="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left text-xs transition-colors hover:bg-slate-50"
            >
              <span className="font-medium text-midnight">{station.name}</span>
              <span className="text-storm/40">{station.station_code}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function RecenterButton({ onClick, count }: { onClick: () => void; count: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2.5 text-xs font-medium text-storm shadow-sm backdrop-blur-md transition-colors hover:bg-white hover:text-midnight"
      aria-label="Recenter map to show all stations"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <circle cx="7" cy="7" r="5.5" />
        <circle cx="7" cy="7" r="1.5" fill="currentColor" />
      </svg>
      {count} station{count !== 1 ? 's' : ''}
    </button>
  )
}

function ShieldExclamation() {
  return (
    <svg
      className="h-7 w-7 text-rose"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="M12 8v4" />
      <circle cx="12" cy="16" r="0.5" fill="currentColor" />
    </svg>
  )
}

function MapSkeleton() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-sky-light border-t-sky-primary" />
        <p className="text-sm text-storm/50">Loading station data...</p>
      </div>
    </div>
  )
}

function EmptyMapState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-mist">
      <div className="max-w-md px-6 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-sky-soft">
          <svg
            className="h-8 w-8 text-sky-primary"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-midnight font-display">No stations registered</h2>
        <p className="mt-2 text-sm leading-relaxed text-storm/60">
          Your weather network is empty. Add your first station to start monitoring temperature,
          humidity, rainfall, and wind data in real time.
        </p>
        <button
          type="button"
          onClick={onAdd}
          className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-full bg-gradient-to-r from-sky-primary to-sky-deep px-6 py-3 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:shadow-lg hover:brightness-110"
        >
          Add your first station
        </button>
      </div>
    </div>
  )
}
