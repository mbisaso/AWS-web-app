import type { ReactNode } from 'react'

interface PageHeaderProps {
  label: string
  title: string
  subtitle?: string
  icon?: ReactNode
  actions?: ReactNode
  variant?: 'default' | 'alerts' | 'admin' | 'data'
}

const VARIANT_STYLES = {
  default: 'from-midnight to-ocean',
  alerts: 'from-midnight via-[var(--text-primary)] to-red-950/40',
  admin: 'from-midnight via-[var(--text-primary)] to-sky-deep/30',
  data: 'from-midnight to-ocean',
}

const VARIANT_ACCENT = {
  default: 'text-sky-300',
  alerts: 'text-red-300/80',
  admin: 'text-sky-300/80',
  data: 'text-sky-300',
}

const VARIANT_ICONS = {
  default: 'text-sky-300',
  alerts: 'text-red-400',
  admin: 'text-sky-300',
  data: 'text-sky-300',
}

export function PageHeader({ label, title, subtitle, icon, actions, variant = 'default' }: PageHeaderProps) {
  return (
    <div className={`relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-br ${VARIANT_STYLES[variant]} p-6 shadow-lg sm:p-8`}>
      {/* Decorative glow orbs */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/5 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-16 -left-8 h-40 w-40 rounded-full bg-sky-primary/5 blur-3xl" aria-hidden="true" />

      <div className="relative z-10 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2.5">
            {icon && (
              <span className={VARIANT_ICONS[variant]} aria-hidden="true">
                {icon}
              </span>
            )}
            <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${VARIANT_ACCENT[variant]}`}>{label}</p>
          </div>
          <h1 className="text-2xl font-semibold text-white font-display sm:text-3xl">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-white/50">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="mt-3 flex items-center gap-2 sm:mt-0">
            {actions}
          </div>
        )}
      </div>

      {/* Subtle bottom accent line */}
      <div className="absolute bottom-0 left-6 right-6 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" aria-hidden="true" />
    </div>
  )
}
