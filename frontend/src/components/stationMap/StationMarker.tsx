import { useCallback } from 'react'
import { AdvancedMarker } from '@vis.gl/react-google-maps'
import type { StationReading } from '../../services/api'

const COLORS: Record<string, string> = {
  online: '#22C55E',
  partial: '#F59E0B',
  offline: '#E11D48',
  fault: '#DC2626',
}

function StatusSvg({ status }: { status: string }) {
  const color = COLORS[status] || '#94A3B8'

  if (status === 'online') {
    return <circle cx="18" cy="18" r="8" fill={color} />
  }
  if (status === 'partial') {
    return <polygon points="18,10 26,24 10,24" fill={color} />
  }
  if (status === 'offline') {
    return <rect x="11" y="11" width="14" height="14" rx="3" fill={color} />
  }
  return <polygon points="18,10 26,18 18,26 10,18" fill={color} />
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

  const handleClick = useCallback(
    (e: google.maps.MapMouseEvent & { domEvent: MouseEvent | KeyboardEvent }) => {
      e.domEvent.stopPropagation()
      onClick?.()
    },
    [onClick],
  )

  return (
    <AdvancedMarker
      position={{ lat: station.latitude, lng: station.longitude }}
      onClick={handleClick}
      title={`${station.name} (${station.station_code}) — ${station.status}`}
      zIndex={isSelected ? 100 : 1}
    >
      <div className="relative">
        <svg
          width="36"
          height="36"
          viewBox="0 0 36 36"
          role="img"
          aria-label={`${station.name} — ${station.status}`}
          style={{ display: 'block' }}
        >
          {isSelected && (
            <circle
              cx="18"
              cy="18"
              r="17"
              fill="none"
              stroke="#0EA5E9"
              strokeWidth="2.5"
              opacity="0.8"
            />
          )}
          <circle
            cx="18"
            cy="18"
            r="16"
            fill="#FFFFFF"
            stroke={isSelected ? '#0EA5E9' : '#E2E8F0'}
            strokeWidth="1.5"
            style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.12))' }}
          />
          <StatusSvg status={status} />
        </svg>
        {hasAlerts && (
          <span
            className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center"
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
