interface SkeletonCardProps {
  lines?: number
}

export function SkeletonCard({ lines = 2 }: SkeletonCardProps) {
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
            <div className="h-3 w-12 rounded-full bg-slate-100 skeleton-shimmer" />
            <div className="h-3 w-12 rounded-full bg-slate-100 skeleton-shimmer" />
          </div>
          <div className="h-3 w-20 rounded-full bg-slate-100 skeleton-shimmer" />
        </div>
      ))}
    </div>
  )
}
