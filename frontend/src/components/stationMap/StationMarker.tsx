import { useCallback } from 'react'
import { AdvancedMarker } from '@vis.gl/react-google-maps'
import type { StationReading } from '../../services/api'

const COLORS: Record<string, string> = {
  online: '#22C55E',
  partial: '#F59E0B',
  offline: '#E11D48',
  fault: '#DC2626',
}

function shortLabel(code: string): string {
  const digits = code.replace(/\D/g, '')
  return digits.slice(-2) || code.slice(0, 2)
}

function LocationPin({ status, code, isSelected }: { status: string; code: string; isSelected: boolean }) {
  const color = COLORS[status] || '#94A3B8'
  const label = shortLabel(code)

  return (
    <svg
      width="40"
      height="46"
      viewBox="0 0 40 46"
      role="img"
      aria-label={`${status} station ${code}`}
      style={{ display: 'block', filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.35))' }}
    >
      {isSelected && (
        <circle cx="20" cy="18" r="21" fill="none" stroke="#0EA5E9" strokeWidth="2.5" opacity="0.7" />
      )}
      <path
        d="M20 4 C11 4 5 11 5 19 C5 28 20 44 20 44 C20 44 35 28 35 19 C35 11 29 4 20 4 Z"
        fill="white"
        stroke={color}
        strokeWidth="2.5"
      />
      <circle cx="20" cy="18" r="9" fill={color} />
      <text
        x="20" y="21.5"
        textAnchor="middle"
        fill="white"
        fontSize="10"
        fontWeight="700"
        fontFamily="monospace"
      >
        {label}
      </text>
    </svg>
  )
}

interface StationMarkerProps {
  station: StationReading
  hasAlerts: boolean
  isSelected: boolean
  onClick?: () => void
}

export function StationMarker({
  station,
  hasAlerts,
  isSelected,
  onClick,
}: StationMarkerProps) {
  const status = hasAlerts ? 'fault' : station.status

  const handleClick = useCallback(() => {
    onClick?.()
  }, [onClick])

  return (
    <AdvancedMarker
      position={{ lat: station.latitude, lng: station.longitude }}
      onClick={handleClick}
      title={`${station.name} (${station.station_code}) — ${station.status}`}
      zIndex={isSelected ? 100 : 1}
    >
      <div className="relative">
        <LocationPin status={status} code={station.station_code} isSelected={isSelected} />
        {hasAlerts && (
          <span
            className="absolute -top-0.5 left-1/2 -translate-x-1/2 flex h-3.5 w-3.5 items-center justify-center"
            aria-label="Has active alerts"
          >
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75 motion-reduce:animate-none" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-600" />
          </span>
        )}
      </div>
    </AdvancedMarker>
  )
}
