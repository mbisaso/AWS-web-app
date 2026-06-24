import type { ReactNode, KeyboardEvent } from 'react'
import { SkeletonCard } from './SkeletonCard'

type AccentTone = 'default' | 'success' | 'warning' | 'danger'

interface SummaryCardProps {
  title: string
  value: string | number
  subtext?: string
  accent: AccentTone
  icon?: ReactNode
  children?: ReactNode
  isLoading?: boolean
  onClick?: () => void
  isActive?: boolean
}

const ACCENT_STYLES: Record<
  AccentTone,
  { indicator: string; iconBg: string; value: string; subtext: string; ring: string }
> = {
  default: {
    indicator: 'bg-sky-primary',
    iconBg: 'bg-sky-soft text-sky-primary',
    value: 'text-midnight',
    subtext: 'text-storm/50',
    ring: 'focus-visible:ring-sky-primary/40 group-focus-visible:ring-sky-primary/40',
  },
  success: {
    indicator: 'bg-emerald',
    iconBg: 'bg-emerald-50 text-emerald',
    value: 'text-emerald-deep',
    subtext: 'text-emerald-deep/60',
    ring: 'focus-visible:ring-emerald/40 group-focus-visible:ring-emerald/40',
  },
  warning: {
    indicator: 'bg-amber',
    iconBg: 'bg-amber-50 text-amber',
    value: 'text-amber-700',
    subtext: 'text-amber-700/60',
    ring: 'focus-visible:ring-amber/40 group-focus-visible:ring-amber/40',
  },
  danger: {
    indicator: 'bg-rose',
    iconBg: 'bg-rose-50 text-rose',
    value: 'text-rose-700',
    subtext: 'text-rose-700/60',
    ring: 'focus-visible:ring-rose/40 group-focus-visible:ring-rose/40',
  },
}

export function SummaryCard({
  title,
  value,
  subtext,
  accent,
  icon,
  children,
  isLoading = false,
  onClick,
  isActive = false,
}: SummaryCardProps) {
  if (isLoading) return <SkeletonCard lines={1} />

  const styles = ACCENT_STYLES[accent]

  function handleKeyDown(e: KeyboardEvent) {
    if ((e.key === 'Enter' || e.key === ' ') && onClick) {
      e.preventDefault()
      onClick()
    }
  }

  const Component = onClick ? 'button' : 'article'

  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      onKeyDown={onClick ? handleKeyDown : undefined}
      tabIndex={onClick ? 0 : undefined}
      role={onClick ? 'button' : undefined}
      aria-pressed={onClick ? isActive : undefined}
      className={`
        group relative overflow-hidden rounded-2xl border p-5 text-left shadow-xs
        transition-all duration-200
        ${isActive
          ? 'border-sky-300 bg-gradient-to-br from-sky-soft/60 to-white shadow-md shadow-sky-200/30'
          : 'border-slate-200 bg-white hover:shadow-md'
        }
        ${onClick ? 'cursor-pointer' : ''}
        ${styles.ring}
      `}
    >
      {/* Accent bar */}
      <div
        className={`absolute top-0 left-0 h-1 w-full rounded-t-2xl transition-opacity duration-200 ${
          isActive ? 'h-1.5 opacity-100' : 'opacity-80 group-hover:opacity-100'
        } ${styles.indicator}`}
        aria-hidden="true"
      />

      <div className="flex items-start gap-4">
        {/* Icon */}
        {icon && (
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-all duration-200 ${
              isActive
                ? `${styles.iconBg} shadow-sm`
                : 'bg-slate-50 text-storm/30 group-hover:bg-sky-soft group-hover:text-sky-primary'
            }`}
          >
            {icon}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-storm/40">
            {title}
          </p>
          <p className={`mt-1 text-3xl font-bold tracking-tight ${styles.value} font-display`}>
            {value}
          </p>
          {subtext && (
            <p className={`mt-0.5 text-xs font-medium ${styles.subtext}`}>{subtext}</p>
          )}
        </div>
      </div>

      {children && <div className="mt-3 ml-[3.75rem]">{children}</div>}
    </Component>
  )
}

interface AlertsBreakdownProps {
  critical: number
  warning: number
  info: number
}

export function AlertsBreakdown({ critical, warning, info }: AlertsBreakdownProps) {
  const items = [
    { label: 'Critical', count: critical, color: 'bg-rose' },
    { label: 'Warning', count: warning, color: 'bg-amber' },
    { label: 'Info', count: info, color: 'bg-sky-bright' },
  ]

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {items.map(
        (item) =>
          item.count > 0 && (
            <span
              key={item.label}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-storm/60"
            >
              <span
                className={`inline-block h-2 w-2 rounded-full ${item.color}`}
                aria-hidden="true"
              />
              <span>{item.count}</span>
              <span className="text-storm/40">{item.label.toLowerCase()}</span>
            </span>
          )
      )}
    </div>
  )
}
