import { type StationStatus } from '../../services/api'

interface StatusIndicatorProps {
  status: StationStatus
  label?: boolean
  className?: string
}

const STATUS_CONFIG = {
  online: {
    symbol: '\u25CF',
    label: 'Online',
    color: 'text-emerald',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
  },
  partial: {
    symbol: '\u25B2',
    label: 'Partial',
    color: 'text-amber',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
  },
  offline: {
    symbol: '\u25A0',
    label: 'Offline',
    color: 'text-rose',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    text: 'text-rose-700',
  },
} as const

export function StatusIndicator({ status, label = true, className = '' }: StatusIndicatorProps) {
  const cfg = STATUS_CONFIG[status]

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${className}`}
      role="status"
      aria-label={`Station status: ${cfg.label}`}
    >
      <span
        className={`inline-flex items-center justify-center text-sm leading-none ${cfg.color}`}
        aria-hidden="true"
      >
        {cfg.symbol}
      </span>
      {label && (
        <span className={`text-xs font-semibold ${cfg.text}`}>{cfg.label}</span>
      )}
    </span>
  )
}

export function StatusBadge({ status }: { status: StationStatus }) {
  const cfg = STATUS_CONFIG[status]

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${cfg.border} ${cfg.bg} px-2.5 py-0.5`}
      role="status"
      aria-label={`Station status: ${cfg.label}`}
    >
      <span className={`text-xs leading-none ${cfg.color}`} aria-hidden="true">
        {cfg.symbol}
      </span>
      <span className={`text-xs font-semibold ${cfg.text}`}>{cfg.label}</span>
    </span>
  )
}
