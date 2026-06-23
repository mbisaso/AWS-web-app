import { APIProvider, Map, AdvancedMarker } from '@vis.gl/react-google-maps'

interface MapLocationPickerProps {
  latitude: number
  longitude: number
  onChange: (lat: number, lng: number) => void
}

const MAP_ID = 'YOUR_MAP_ID'

export function MapLocationPicker({ latitude, longitude, onChange }: MapLocationPickerProps) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined
  const hasValidKey = apiKey && apiKey !== 'YOUR_API_KEY_HERE' && apiKey.length > 5

  if (!hasValidKey) {
    return (
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="map-lat" className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-storm/40">
            Latitude
          </label>
          <input
            id="map-lat"
            type="number"
            step="any"
            value={latitude}
            onChange={(e) => {
              const v = parseFloat(e.target.value)
              if (!isNaN(v) && v >= -90 && v <= 90) onChange(v, longitude)
            }}
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-midnight focus:outline-2 focus:outline-offset-2 focus:outline-sky-primary"
          />
        </div>
        <div>
          <label htmlFor="map-lng" className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-storm/40">
            Longitude
          </label>
          <input
            id="map-lng"
            type="number"
            step="any"
            value={longitude}
            onChange={(e) => {
              const v = parseFloat(e.target.value)
              if (!isNaN(v) && v >= -180 && v <= 180) onChange(latitude, v)
            }}
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-midnight focus:outline-2 focus:outline-offset-2 focus:outline-sky-primary"
          />
        </div>
      </div>
    )
  }

  return (
    <APIProvider apiKey={apiKey}>
      <div className="h-48 overflow-hidden rounded-xl border border-slate-200">
        <Map
          defaultCenter={{ lat: latitude, lng: longitude }}
          defaultZoom={8}
          mapId={MAP_ID}
          gestureHandling="greedy"
          onClick={(e) => {
            const ll = e.detail?.latLng
            if (ll) onChange(ll.lat, ll.lng)
          }}
          disableDefaultUI
        >
          <AdvancedMarker position={{ lat: latitude, lng: longitude }} />
        </Map>
      </div>
    </APIProvider>
  )
}
