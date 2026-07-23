import { useCallback } from 'react'
import { AdvancedMarker } from '@vis.gl/react-google-maps'
import type { StationReading } from '../../services/api'

const COLORS = {
  online: '#16A34A',
  partial: '#D97706',
  offline: '#DC2626',
  fault: '#B91C1C',
} as const

const BG_LIGHT = {
  online: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  partial: 'bg-amber-50 text-amber-800 border-amber-200',
  offline: 'bg-rose-50 text-rose-800 border-rose-200',
  fault: 'bg-red-50 text-red-800 border-red-200',
} as const

function shortLabel(code: string): string {
  const digits = code.replace(/\D/g, '')
  return digits.slice(-2) || code.slice(0, 2)
}

function LocationPin({ status, code, isSelected }: { status: string; code: string; isSelected: boolean }) {
  const color = COLORS[status as keyof typeof COLORS] ?? '#94A3B8'
  const label = shortLabel(code)

  return (
    <svg
      width="44"
      height="52"
      viewBox="0 0 44 52"
      role="img"
      aria-label={`${status} station ${code}`}
      style={{ display: 'block', filter: 'drop-shadow(0 3px 8px rgba(0,0,0,0.35))' }}
    >
      {isSelected && (
        <circle cx="22" cy="20" r="24" fill="none" stroke="#38BDF8" strokeWidth="3" opacity="0.6" />
      )}
      <path
        d="M22 3 C12 3 5 11 5 21 C5 31 22 49 22 49 C22 49 39 31 39 21 C39 11 32 3 22 3 Z"
        fill="white"
        stroke={color}
        strokeWidth="2.5"
      />
      <circle cx="22" cy="20" r="11" fill={color} />
      <circle cx="22" cy="20" r="8" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
      <text
        x="22" y="24"
        textAnchor="middle"
        fill="white"
        fontSize="12"
        fontWeight="800"
        fontFamily="system-ui, sans-serif"
        style={{ letterSpacing: '0.02em' }}
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
  const labelClass = BG_LIGHT[status as keyof typeof BG_LIGHT] ?? BG_LIGHT.offline

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
      <div className="relative flex flex-col items-center" style={{ marginTop: -52 }}>
        <div className="relative">
          <LocationPin status={status} code={station.station_code} isSelected={isSelected} />
          {hasAlerts && (
            <span
              className="absolute -top-0.5 left-1/2 -translate-x-1/2 flex h-4 w-4 items-center justify-center"
              aria-label="Has active alerts"
            >
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75 motion-reduce:animate-none" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-600" />
            </span>
          )}
        </div>
        <span
          className={`mt-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-tight shadow-sm ${labelClass}`}
        >
          {station.station_code}
        </span>
      </div>
    </AdvancedMarker>
  )
}
