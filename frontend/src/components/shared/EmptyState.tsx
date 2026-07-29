import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  variant?: 'default' | 'no-data' | 'no-results' | 'success'
}

const VARIANT_CONFIG = {
  default: {
    iconBg: 'bg-sky-soft text-sky-primary',
    iconFallback: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
  'no-data': {
    iconBg: 'bg-slate-100 text-storm/30',
    iconFallback: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  'no-results': {
    iconBg: 'bg-sky-soft text-sky-bright',
    iconFallback: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4" />
        <circle cx="12" cy="8" r="0.5" fill="currentColor" />
      </svg>
    ),
  },
  success: {
    iconBg: 'bg-emerald-50 text-emerald',
    iconFallback: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <path d="M22 4 12 14.01l-3-3" />
      </svg>
    ),
  },
}

export function EmptyState({ icon, title, description, action, variant = 'default' }: EmptyStateProps) {
  const config = VARIANT_CONFIG[variant]

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/50 px-6 py-16 text-center">
      <div className={`flex h-12 w-12 items-center justify-center rounded-full ${config.iconBg}`}>
        {icon ?? config.iconFallback}
      </div>
      <p className="mt-4 text-sm font-semibold text-midnight">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-storm/40">{description}</p>
      )}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-5 cursor-pointer rounded-full bg-gradient-to-r from-sky-primary to-sky-deep px-5 py-2.5 text-xs font-semibold text-white shadow-md shadow-sky-200/50 transition-all duration-200 hover:shadow-lg hover:shadow-sky-200/60 hover:brightness-110"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
}: {
  title?: string
  message?: string
  onRetry?: () => void
}) {
  return (
    <div className="mb-6 flex items-center gap-4 rounded-2xl border border-rose-200 bg-rose-50/50 p-4">
      <svg className="h-5 w-5 shrink-0 text-rose" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4" />
        <circle cx="12" cy="16" r="0.5" fill="currentColor" />
      </svg>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-rose-700">{title}</p>
        {message && <p className="text-xs text-rose-500/70">{message}</p>}
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 cursor-pointer rounded-full bg-rose-100 px-4 py-1.5 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-200"
        >
          Retry
        </button>
      )}
    </div>
  )
}
