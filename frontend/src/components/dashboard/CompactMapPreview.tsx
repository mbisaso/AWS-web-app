import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  APIProvider,
  Map,
  InfoWindow,
  useApiIsLoaded,
  useApiLoadingStatus,
  useMap,
} from '@vis.gl/react-google-maps'
import { type StationReading } from '../../services/api'
import type { Station } from '../../types'
import { StationMarker } from '../stationMap/StationMarker'
import { StatusBadge } from './StatusIndicator'
import { getGoogleMapsConfig } from '../../utils/googleMaps'
import { fitMapToStations, hasValidCoordinates } from '../../utils/stationCoordinates'
import { MapPinIcon } from '../landing/Icons'

export interface CompactMapPreviewProps {
  stations?: (StationReading | Station)[]
}

const FALLBACK_COORDS: Record<string, { lat: number; lng: number }> = {
  'AWS-001': { lat: -0.79, lng: 29.92 },
  'AWS-002': { lat: 0.05, lng: 32.45 },
  'AWS-005': { lat: 0.42, lng: 33.20 },
  'AWS-008': { lat: -0.60, lng: 30.60 },
  'AWS-014': { lat: -0.30, lng: 33.50 },
  'AWS-019': { lat: 0.18, lng: 30.08 },
  'AWS-022': { lat: 2.75, lng: 32.30 },
  'AWS-027': { lat: 2.50, lng: 34.50 },
  'AWS-031': { lat: 1.10, lng: 34.50 },
  'AWS-035': { lat: 2.50, lng: 34.60 },
}

function normalizeToStationReading(raw: StationReading | Station): StationReading {
  if ('station_code' in raw) {
    const fb = FALLBACK_COORDS[raw.station_code]
    const lat = hasValidCoordinates(raw.latitude, raw.longitude) ? raw.latitude : (fb?.lat ?? 1.5)
    const lng = hasValidCoordinates(raw.latitude, raw.longitude) ? raw.longitude : (fb?.lng ?? 32.5)
    return {
      ...raw,
      latitude: lat,
      longitude: lng,
    }
  }

  const statusMap: Record<string, 'online' | 'partial' | 'offline'> = {
    full: 'online',
    partial: 'partial',
    down: 'offline',
  }
  const rawStatus = raw.status?.status ?? 'down'
  const lastSeen = raw.status?.last_updated ?? new Date().toISOString()
  const fb = FALLBACK_COORDS[raw.station_id]
  const lat = hasValidCoordinates(raw.latitude, raw.longitude) ? raw.latitude! : (fb?.lat ?? 1.5)
  const lng = hasValidCoordinates(raw.latitude, raw.longitude) ? raw.longitude! : (fb?.lng ?? 32.5)

  return {
    id: raw.id,
    name: raw.name,
    station_code: raw.station_id,
    location: raw.location || 'Uganda',
    latitude: lat,
    longitude: lng,
    status: statusMap[rawStatus] ?? 'offline',
    temperature: null,
    humidity: null,
    rainfall: null,
    wind_speed: null,
    pressure: null,
    last_seen: lastSeen,
    expected_interval_minutes: raw.expected_interval_minutes,
    is_stale: false,
  }
}

export function CompactMapPreview({ stations = [] }: CompactMapPreviewProps) {
  const navigate = useNavigate()
  const { apiKey, mapId } = getGoogleMapsConfig()
  const useAdvancedMarkers = Boolean(mapId)

  const normalizedStations = useMemo(
    () => stations.map(normalizeToStationReading),
    [stations],
  )

  const counts = useMemo(
    () => ({
      online: normalizedStations.filter((s) => s.status === 'online').length,
      partial: normalizedStations.filter((s) => s.status === 'partial').length,
      offline: normalizedStations.filter((s) => s.status === 'offline').length,
    }),
    [normalizedStations],
  )

  const [selectedStation, setSelectedStation] = useState<StationReading | null>(null)

  const handleOpenFullMap = (stationCode?: string) => {
    if (stationCode) {
      navigate(`/stations/map?station=${encodeURIComponent(stationCode)}`)
    } else {
      navigate('/stations/map')
    }
  }

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-elevation-2 transition-all duration-300 hover:border-slate-300"
      aria-label="Interactive Station Map Overview"
    >
      {/* ── Compact Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0a6ebd]">
              Station Map Preview
            </p>
          </div>
          <h2 className="mt-0.5 text-lg font-semibold text-[#1a2332] font-display">
            Live Station Locations
          </h2>
        </div>

        <div className="flex items-center gap-3">
          {/* Status Counts */}
          <div className="flex items-center gap-2 text-xs font-medium">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-emerald-700 border border-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {counts.online} Online
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-amber-700 border border-amber-200">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              {counts.partial} Partial
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-rose-700 border border-rose-200">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              {counts.offline} Offline
            </span>
          </div>

          <button
            type="button"
            onClick={() => handleOpenFullMap()}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-[#0a6ebd] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition-all duration-200 hover:bg-[#085694] active:scale-95 shrink-0"
          >
            <span>Full Map</span>
            <MapPinIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── Compact Map Container (h-64 / 260px) ── */}
      <div className="relative mt-3 h-[260px] sm:h-[280px] w-full overflow-hidden rounded-2xl border border-slate-200/90 shadow-inner bg-mist">
        {apiKey ? (
          <APIProvider apiKey={apiKey}>
            <CompactMapViewContent
              stations={normalizedStations}
              selectedStation={selectedStation}
              onSelect={setSelectedStation}
              onOpenFullMap={handleOpenFullMap}
              mapId={mapId}
              useAdvancedMarkers={useAdvancedMarkers}
            />
          </APIProvider>
        ) : (
          <NoApiKeyFallback onOpenFullMap={handleOpenFullMap} />
        )}
      </div>

      {/* ── Quick Station Selector Pills ── */}
      <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-thin">
        <span className="text-[11px] font-semibold text-slate-400 shrink-0">Quick jump:</span>
        {normalizedStations.map((st) => (
          <button
            key={st.id}
            type="button"
            onClick={() => handleOpenFullMap(st.station_code)}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 transition-colors hover:border-[#0a6ebd] hover:bg-sky-50"
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                st.status === 'online'
                  ? 'bg-emerald-500'
                  : st.status === 'partial'
                  ? 'bg-amber-500'
                  : 'bg-rose-500'
              }`}
            />
            <span className="font-semibold text-slate-800">{st.station_code}</span>
            <span className="text-slate-400 hidden md:inline">{st.name}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

function CompactMapViewContent({
  stations,
  selectedStation,
  onSelect,
  onOpenFullMap,
  mapId,
  useAdvancedMarkers,
}: {
  stations: StationReading[]
  selectedStation: StationReading | null
  onSelect: (s: StationReading | null) => void
  onOpenFullMap: (code?: string) => void
  mapId: string | null
  useAdvancedMarkers: boolean
}) {
  const apiIsLoaded = useApiIsLoaded()
  const apiStatus = useApiLoadingStatus()

  return (
    <div className="relative h-full w-full">
      {!apiIsLoaded && apiStatus !== 'FAILED' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-50/80 backdrop-blur-xs">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-sky-200 border-t-[#0a6ebd]" />
            Loading Map...
          </div>
        </div>
      )}

      <Map
        className="h-full w-full"
        defaultZoom={7}
        defaultCenter={{ lat: 1.5, lng: 32.5 }}
        gestureHandling="cooperative"
        streetViewControl={false}
        fullscreenControl={false}
        mapTypeControl={false}
        zoomControl={true}
        clickableIcons={false}
        mapId={mapId ?? undefined}
        onClick={() => onSelect(null)}
      >
        <MapInnerLogic
          stations={stations}
          selectedStation={selectedStation}
          onSelect={onSelect}
          onOpenFullMap={onOpenFullMap}
          useAdvancedMarkers={useAdvancedMarkers}
        />
      </Map>
    </div>
  )
}

function MapInnerLogic({
  stations,
  selectedStation,
  onSelect,
  onOpenFullMap,
  useAdvancedMarkers,
}: {
  stations: StationReading[]
  selectedStation: StationReading | null
  onSelect: (s: StationReading | null) => void
  onOpenFullMap: (code?: string) => void
  useAdvancedMarkers: boolean
}) {
  const map = useMap()

  useEffect(() => {
    if (!map || stations.length === 0) return
    fitMapToStations(map, stations, 40)
  }, [map, stations])

  return (
    <>
      {stations.map((st) => (
        <StationMarker
          key={st.id}
          station={st}
          hasAlerts={false}
          isSelected={selectedStation?.id === st.id}
          useAdvancedMarkers={useAdvancedMarkers}
          onClick={() => onSelect(st)}
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
          <div className="p-1 max-w-[200px]">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-xs text-[#1a2332]">{selectedStation.name}</span>
              <StatusBadge status={selectedStation.status} />
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {selectedStation.station_code} &middot; {selectedStation.location}
            </p>
            <button
              type="button"
              onClick={() => onOpenFullMap(selectedStation.station_code)}
              className="mt-2 text-xs font-semibold text-[#0a6ebd] hover:underline cursor-pointer"
            >
              Open on Full Map &rarr;
            </button>
          </div>
        </InfoWindow>
      )}
    </>
  )
}

function NoApiKeyFallback({
  onOpenFullMap,
}: {
  onOpenFullMap: (code?: string) => void
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center p-4 text-center bg-slate-50">
      <p className="text-xs font-semibold text-slate-700 font-display">Google Maps Key Required</p>
      <p className="mt-1 text-[11px] text-slate-500 max-w-xs leading-relaxed">
        Add <code className="rounded bg-slate-200 px-1 font-mono">VITE_GOOGLE_MAPS_API_KEY</code> to enable live map tiles.
      </p>
      <button
        type="button"
        onClick={() => onOpenFullMap()}
        className="mt-3 inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-[#0a6ebd] hover:underline"
      >
        View Full Map Page &rarr;
      </button>
    </div>
  )
}
