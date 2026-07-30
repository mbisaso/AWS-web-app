import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  APIProvider,
  Map,
  InfoWindow,
  useApiIsLoaded,
  useApiLoadingStatus,
  useMap,
} from '@vis.gl/react-google-maps'
import { fetchStations } from '../api/stations'
import { type StationReading, formatRelativeTime } from '../services/api'
import type { Station } from '../types'
import { DashboardSidebar } from '../components/dashboard/DashboardSidebar'
import { StatusBadge } from '../components/dashboard/StatusIndicator'
import { StationMarker } from '../components/stationMap/StationMarker'
import { StatusFilterBar, type StationFilter } from '../components/stationMap/StatusFilterBar'
import { StationListPanel } from '../components/stationMap/StationListPanel'
import { getGoogleMapsConfig } from '../utils/googleMaps'
import { fitMapToStations, hasValidCoordinates } from '../utils/stationCoordinates'


function toStationReading(s: Station): StationReading {
  const statusMap: Record<string, 'online' | 'partial' | 'offline'> = {
    full: 'online', partial: 'partial', down: 'offline',
  }

  const rawStatus = s.status?.status ?? 'down'
  const lastSeen = s.status?.last_updated ?? new Date().toISOString()
  const elapsed = Date.now() - new Date(lastSeen).getTime()
  const isStale = elapsed > s.expected_interval_minutes * 60 * 1000 * 2
  const lat = s.latitude ?? 0
  const lng = s.longitude ?? 0

  return {
    id: s.id,
    name: s.name,
    station_code: s.station_id,
    location: s.location,
    latitude: lat,
    longitude: lng,
    status: statusMap[rawStatus] ?? 'offline',
    temperature: null,
    humidity: null,
    rainfall: null,
    wind_speed: null,
    pressure: null,
    last_seen: lastSeen,
    expected_interval_minutes: s.expected_interval_minutes,
    is_stale: isStale,
  }
}


export function StationMapPage() {
  const navigate = useNavigate()
  const [rawStations, setRawStations] = useState<Station[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryTrigger, setRetryTrigger] = useState(0)

  const retry = useCallback(() => setRetryTrigger((c) => c + 1), [])

  /* ── Fetch real station data ── */
  useEffect(() => {
    async function load() {
      setIsLoading(true)
      try {
        const stn = await fetchStations()
        setRawStations(stn)
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load station data')
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [retryTrigger])

  const allStations = useMemo(
    () => rawStations.map(toStationReading),
    [rawStations],
  )

  const plottableStations = useMemo(
    () => allStations.filter((s) => hasValidCoordinates(s.latitude, s.longitude)),
    [allStations],
  )

  const unplottableCount = allStations.length - plottableStations.length

  const [filter, setFilter] = useState<StationFilter>('all')
  const [selectedStation, setSelectedStation] = useState<StationReading | null>(null)
  const [isListOpen, setIsListOpen] = useState(true)
  const [recenterCount, setRecenterCount] = useState(0)

  const [searchParams] = useSearchParams()
  const targetStationCode = searchParams.get('station')

  /* ── Auto-select station from URL query param ── */
  useEffect(() => {
    if (targetStationCode && plottableStations.length > 0) {
      const found = plottableStations.find(
        (s) => s.station_code.toLowerCase() === targetStationCode.toLowerCase()
      )
      if (found) {
        setSelectedStation(found)
      }
    }
  }, [targetStationCode, plottableStations])

  const handleViewDetails = useCallback(
    (station: StationReading) => navigate(`/dashboard/stations/${station.station_code}`),
    [navigate],
  )

  /* ── Alerting not available (no real alerts API) ── */
  const alertStationIds = useMemo(() => new Set<number>(), [])

  /* ── Filtered stations (plottable only) ── */
  const filteredStations = useMemo(() => {
    let result = plottableStations

    if (filter === 'online') result = result.filter((s) => s.status === 'online')
    else if (filter === 'offline') result = result.filter((s) => s.status !== 'online')
    else if (filter === 'fault') result = result.filter((s) => alertStationIds.has(s.id))

    return result
  }, [plottableStations, filter, alertStationIds])

  /* ── Filter counts ── */
  const filterCounts = useMemo(() => ({
    all: plottableStations.length,
    online: plottableStations.filter((s) => s.status === 'online').length,
    offline: plottableStations.filter((s) => s.status !== 'online').length,
    fault: alertStationIds.size,
  }), [plottableStations, alertStationIds])

  const handleSelect = useCallback((station: StationReading | null) => {
    setSelectedStation(station)
  }, [])

  const handleRecenter = useCallback(() => {
    setRecenterCount((c) => c + 1)
  }, [])

  /* ── API key ── */
  const { apiKey, mapId } = getGoogleMapsConfig()
  const useAdvancedMarkers = Boolean(mapId)

  /* ── Loading: no data yet ── */
  if (isLoading && rawStations.length === 0) {
    return (
      <div className="flex h-screen bg-mist">
        <DashboardSidebar />
        <MapSkeleton />
      </div>
    )
  }

  /* ── Error: fetch failed, no cached data ── */
  if (error && rawStations.length === 0) {
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
              If you just edited frontend/.env, restart the Vite dev server so it reloads the key.
              Remember to restrict the key by domain/referrer in Google Cloud Console.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex min-h-[100dvh] bg-mist lg:h-screen lg:overflow-hidden">
        <DashboardSidebar />

        <main className="flex min-w-0 flex-1 flex-col lg:flex-row">
          <section className="flex min-w-0 flex-1 flex-col overflow-hidden border-b border-slate-200/80 bg-white/80 backdrop-blur-sm lg:rounded-r-[28px] lg:border-b-0 lg:border-r lg:border-slate-200/80 lg:shadow-[0_20px_70px_rgba(15,23,42,0.08)]">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200/80 px-4 py-4 sm:px-6">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-primary">Station map</p>
                <h1 className="mt-1 text-2xl font-semibold text-midnight font-display">Live station locations</h1>
                <p className="mt-1 text-sm text-storm/60">
                  Search, filter, and inspect station markers across the map.
                </p>
              </div>
              <div className="hidden rounded-2xl border border-slate-200 bg-white px-4 py-3 text-right text-xs text-storm/50 shadow-sm sm:block">
                <p className="font-semibold text-midnight">{filteredStations.length}</p>
                <p>on map</p>
              </div>
            </div>

            {unplottableCount > 0 && (
              <div className="mx-4 mb-3 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 sm:mx-6">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                </svg>
                <p className="text-xs leading-relaxed text-amber-800">
                  {unplottableCount} station{unplottableCount !== 1 ? 's' : ''} missing valid coordinates.
                  Set latitude and longitude in Station Manager to show them on the map.
                </p>
              </div>
            )}

            <div className="relative min-h-[62vh] flex-1 overflow-hidden lg:min-h-0">
            {plottableStations.length === 0 ? (
              <NoCoordinatesState totalStations={allStations.length} />
            ) : (
            <APIProvider apiKey={apiKey}>
              <MapScreenContent
                stations={filteredStations}
                plottableStations={plottableStations}
                alertStationIds={alertStationIds}
                selectedStation={selectedStation}
                onSelect={handleSelect}
                onViewDetails={handleViewDetails}
                filter={filter}
                filterCounts={filterCounts}
                onFilterChange={setFilter}
                onRecenter={handleRecenter}
                recenterCount={recenterCount}
                mapId={mapId}
                useAdvancedMarkers={useAdvancedMarkers}
              />
            </APIProvider>
            )}
            </div>
          </section>

          <StationListPanel
            stations={filteredStations}
            totalCount={plottableStations.length}
            selectedId={selectedStation?.id ?? null}
            alertIds={alertStationIds}
            onSelect={handleSelect}
            onViewDetails={handleViewDetails}
            isOpen={isListOpen}
            onToggle={() => setIsListOpen((o) => !o)}
          />
        </main>
      </div>
    </>
  )
}

/* ── Map content container ── */

function MapScreenContent({
  stations,
  plottableStations,
  alertStationIds,
  selectedStation,
  onSelect,
  onViewDetails,
  filter,
  filterCounts,
  onFilterChange,
  onRecenter,
  recenterCount,
  mapId,
  useAdvancedMarkers,
}: {
  stations: StationReading[]
  plottableStations: StationReading[]
  alertStationIds: Set<number>
  selectedStation: StationReading | null
  onSelect: (s: StationReading | null) => void
  onViewDetails: (s: StationReading) => void
  filter: StationFilter
  filterCounts: Record<StationFilter, number>
  onFilterChange: (f: StationFilter) => void
  onRecenter: () => void
  recenterCount: number
  mapId: string | null
  useAdvancedMarkers: boolean
}) {
  const apiIsLoaded = useApiIsLoaded()
  const apiStatus = useApiLoadingStatus()

  return (
    <div className="relative h-full w-full min-h-[62vh]">
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
        className="h-full w-full min-h-[62vh]"
        defaultZoom={7}
        defaultCenter={{ lat: 1.5, lng: 32.5 }}
        gestureHandling="greedy"
        streetViewControl={false}
        fullscreenControl={false}
        mapTypeControl={false}
        clickableIcons={false}
        mapId={mapId ?? undefined}
        onClick={() => onSelect(null)}
      >
        <MapView
          stations={stations}
          plottableStations={plottableStations}
          alertStationIds={alertStationIds}
          selectedStation={selectedStation}
          onSelect={onSelect}
          onViewDetails={onViewDetails}
          recenterCount={recenterCount}
          useAdvancedMarkers={useAdvancedMarkers}
        />
      </Map>

      {/* ── Floating controls ── */}
      <div className="pointer-events-none absolute inset-0 z-10">
        <div className="pointer-events-auto absolute left-4 top-4">
          <StatusFilterBar current={filter} onChange={onFilterChange} counts={filterCounts} />
        </div>

        <div className="pointer-events-auto absolute right-4 top-4 max-w-[200px]">
          <SearchStationInput stations={plottableStations} onSelect={onSelect} />
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
  plottableStations,
  alertStationIds,
  selectedStation,
  onSelect,
  onViewDetails,
  recenterCount,
  useAdvancedMarkers,
}: {
  stations: StationReading[]
  plottableStations: StationReading[]
  alertStationIds: Set<number>
  selectedStation: StationReading | null
  onSelect: (s: StationReading | null) => void
  onViewDetails: (s: StationReading) => void
  recenterCount: number
  useAdvancedMarkers: boolean
}) {
  const map = useMap()

  /* Fit bounds when plottable stations load or change */
  const stationCount = plottableStations.length
  useEffect(() => {
    if (!map || stationCount === 0) return
    fitMapToStations(map, plottableStations)
  }, [map, stationCount, plottableStations])

  /* Pan to selected station */
  useEffect(() => {
    if (!map || !selectedStation) return
    map.panTo({ lat: selectedStation.latitude, lng: selectedStation.longitude })
    if (map.getZoom()! < 10) map.setZoom(11)
  }, [map, selectedStation])

  /* Recenter triggered */
  useEffect(() => {
    if (!map || stationCount === 0 || recenterCount === 0) return
    fitMapToStations(map, plottableStations)
  }, [map, plottableStations, recenterCount, stationCount])

  return (
    <>
      {stations.map((station) => (
        <StationMarker
          key={station.station_id}
          station={station}
          hasAlerts={alertStationIds.has(station.station_id)}
          isSelected={selectedStation?.station_id === station.station_id}
          useAdvancedMarkers={useAdvancedMarkers}
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
      <p className="mb-2 font-mono text-[10px] text-storm/40">
        {station.latitude.toFixed(4)}, {station.longitude.toFixed(4)}
      </p>

      {station.temperature ? (
        <div className="mb-2 grid grid-cols-2 gap-x-4 gap-y-1">
          <SensorReading label="Temp" value={`${station.temperature.value.toFixed(1)}°C`} />
          <SensorReading label="Humidity" value={station.humidity ? `${station.humidity.value.toFixed(0)}%` : '—'} />
          <SensorReading label="Rainfall" value={station.rainfall ? `${station.rainfall.value.toFixed(1)}mm` : '—'} />
          <SensorReading label="Wind" value={station.wind_speed ? `${station.wind_speed.value.toFixed(1)}m/s` : '—'} />
        </div>
      ) : (
        <div className="mb-2 rounded-md bg-slate-50 px-3 py-2 text-[11px] text-storm/50">
          Awaiting sensor data…
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
              key={station.station_id}
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

function NoCoordinatesState({ totalStations }: { totalStations: number }) {
  return (
    <div className="flex h-full min-h-[62vh] flex-col items-center justify-center px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-sky-soft text-sky-primary">
        <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      </div>
      <h2 className="mt-5 text-lg font-semibold text-midnight font-display">
        {totalStations === 0 ? 'No stations registered yet' : 'No stations on the map yet'}
      </h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-storm/60">
        {totalStations === 0
          ? 'Add a station in Station Manager, then set its latitude and longitude to plot it here.'
          : `${totalStations} station${totalStations !== 1 ? 's are' : ' is'} registered but none have valid coordinates. Open Station Manager, edit each station, and pin its location on the map picker.`}
      </p>
    </div>
  )
}

