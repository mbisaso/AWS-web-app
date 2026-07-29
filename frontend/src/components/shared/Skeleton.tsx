interface SkeletonProps {
  className?: string
  variant?: 'text' | 'circular' | 'rectangular' | 'card'
  width?: string | number
  height?: string | number
  lines?: number
}

export function Skeleton({ className = '', variant = 'text', width, height, lines = 1 }: SkeletonProps) {
  if (variant === 'card') {
    return (
      <div className={`overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 ${className}`} aria-hidden="true">
        <div className="h-3 w-20 rounded-full bg-slate-200 skeleton-shimmer" />
        <div className="mt-3 h-7 w-16 rounded-lg bg-slate-200 skeleton-shimmer" />
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={`mt-2 h-3 rounded-full bg-slate-100 skeleton-shimmer ${i === 0 ? 'w-32' : 'w-24'}`}
          />
        ))}
      </div>
    )
  }

  if (variant === 'circular') {
    return (
      <div
        className={`skeleton-shimmer rounded-full ${className}`}
        style={{ width: width ?? 40, height: height ?? 40 }}
        aria-hidden="true"
      />
    )
  }

  if (variant === 'rectangular') {
    return (
      <div
        className={`skeleton-shimmer rounded-xl ${className}`}
        style={{ width: width ?? '100%', height: height ?? 200 }}
        aria-hidden="true"
      />
    )
  }

  return (
    <div
      className={`skeleton-shimmer rounded-full bg-slate-200 ${className}`}
      style={{ width: width ?? '100%', height: height ?? 12 }}
      aria-hidden="true"
    />
  )
}

export function SkeletonCard({ lines = 2 }: { lines?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-5" aria-hidden="true">
      <div className="h-3 w-20 rounded-full bg-slate-200 skeleton-shimmer" />
      <div className="mt-3 h-7 w-16 rounded-lg bg-slate-200 skeleton-shimmer" />
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`mt-2 h-3 rounded-full bg-slate-100 skeleton-shimmer ${i === 0 ? 'w-32' : 'w-24'}`}
        />
      ))}
    </div>
  )
}

export function SkeletonTableRows({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-xl border border-slate-100 bg-white px-5 py-4"
        >
          <div className="h-3 w-28 rounded-full bg-slate-200 skeleton-shimmer" />
          <div className="h-3 w-16 rounded-full bg-slate-200 skeleton-shimmer" />
          <div className="ml-auto flex gap-6">
            <div className="h-3 w-12 rounded-full bg-slate-100 skeleton-shimmer" />
            <div className="h-3 w-12 rounded-full bg-slate-100 skeleton-shimmer" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function SkeletonChart() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-5" aria-hidden="true">
      <div className="mb-4 h-4 w-32 rounded-full bg-slate-200 skeleton-shimmer" />
      <div className="h-[260px] rounded-xl bg-slate-50 skeleton-shimmer" />
    </div>
  )
}
