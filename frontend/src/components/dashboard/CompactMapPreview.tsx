import { useNavigate } from 'react-router-dom'
import { type StationReading } from '../../services/api'
import { MapPinIcon } from '../landing/Icons'

interface CompactMapPreviewProps {
  stations: StationReading[]
}

const STATUS_PIN_COLORS: Record<string, string> = {
  online: '#22C55E',
  partial: '#F59E0B',
  offline: '#E11D48',
}

/* Uganda boundaries (approximate) for coordinate normalization */
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

export function CompactMapPreview({ stations }: CompactMapPreviewProps) {
  const navigate = useNavigate()
  const placedStations = stations.filter((s) => s.latitude && s.longitude)

  return (
    <section
      className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-all duration-200 hover:shadow-md hover:border-sky-200"
      aria-label="Station map preview"
      onClick={() => navigate('/stations/map')}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/stations/map') }}
      tabIndex={0}
      role="button"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-storm/40">
            Station map
          </p>
          <h3 className="mt-1 text-base font-semibold text-midnight font-display">
            Network overview
          </h3>
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-sky-primary transition-colors duration-200 group-hover:text-sky-deep cursor-pointer">
          View full map
          <MapPinIcon className="h-3.5 w-3.5" />
        </span>
      </div>

      {/* Mini SVG map */}
      <div className="relative mt-4 overflow-hidden rounded-xl bg-gradient-to-b from-sky-soft to-sky-mist/50">
        <svg
          viewBox="0 0 100 100"
          className="h-full w-full"
          role="img"
          aria-label={`Map showing ${placedStations.length} weather stations`}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Subtle grid */}
          <defs>
            <pattern id="map-grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path
                d="M 10 0 L 0 0 0 10"
                fill="none"
                stroke="#BAE6FD"
                strokeWidth="0.15"
                opacity="0.5"
              />
            </pattern>
          </defs>
          <rect width="100" height="100" fill="url(#map-grid)" />

          {/* Equator line (Uganda straddles the equator) */}
          <line
            x1="0"
            y1={toSvgCoord(0, BOUNDS.minLng).y}
            x2="100"
            y2={toSvgCoord(0, BOUNDS.maxLng).y}
            stroke="#93C5FD"
            strokeWidth="0.3"
            strokeDasharray="2 2"
            opacity="0.4"
          />
          <text
            x="97"
            y={toSvgCoord(0, BOUNDS.maxLng).y - 0.5}
            fontSize="1.5"
            fill="#93C5FD"
            opacity="0.4"
          >
            Equator
          </text>

          {/* Station pins */}
          {placedStations.map((station) => {
            const { x, y } = toSvgCoord(station.latitude, station.longitude)
            const color = STATUS_PIN_COLORS[station.status] || '#94A3B8'

            return (
              <g key={station.id} aria-label={`${station.name} — ${station.status}`}>
                {/* Pin shadow */}
                <circle cx={x} cy={y + 1.5} r="2.5" fill="#0F172A" opacity="0.1" />
                {/* Pin */}
                <circle cx={x} cy={y} r="2.5" fill={color} stroke="#FFFFFF" strokeWidth="0.8" />
                {/* Label */}
                <text
                  x={x}
                  y={y - 4}
                  textAnchor="middle"
                  fontSize="2.5"
                  fontWeight="600"
                  fill="#334155"
                  opacity="0.8"
                >
                  {station.station_code.replace('AWS-', '')}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center gap-4">
        <MapLegend color="#22C55E" label={`${placedStations.filter((s) => s.status === 'online').length} online`} />
        <MapLegend color="#F59E0B" label={`${placedStations.filter((s) => s.status === 'partial').length} partial`} />
        <MapLegend color="#E11D48" label={`${placedStations.filter((s) => s.status === 'offline').length} offline`} />
      </div>
    </section>
  )
}

function MapLegend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-storm/50">
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      {label}
    </span>
  )
}
