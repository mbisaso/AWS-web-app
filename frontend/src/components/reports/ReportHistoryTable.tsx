import type { ReportResult, ReportType, ReportStatus } from '../../services/api'
import { REPORT_TYPE_LABELS } from '../../services/api'

interface ReportHistoryTableProps {
  history: ReportResult[]
  total: number
  isLoading: boolean
  page: number
  pageSize: number
  typeFilter: ReportType | 'all'
  statusFilter: ReportStatus | 'all'
  search: string
  onTypeFilterChange: (t: ReportType | 'all') => void
  onStatusFilterChange: (s: ReportStatus | 'all') => void
  onSearchChange: (q: string) => void
  onPageChange: (p: number) => void
  onDownload: (report: ReportResult) => void
  onRetry: (report: ReportResult) => void
}

export function ReportHistoryTable({
  history,
  total,
  isLoading,
  page,
  pageSize,
  typeFilter,
  statusFilter,
  search,
  onTypeFilterChange,
  onStatusFilterChange,
  onSearchChange,
  onPageChange,
  onDownload,
  onRetry,
}: ReportHistoryTableProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-9 w-full animate-pulse rounded-xl bg-slate-200" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-4 rounded-xl border border-slate-200 bg-white p-4">
            <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-16 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
          </div>
        ))}
      </div>
    )
  }

  if (!total) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center shadow-xs">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-soft text-sky-bright">
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
          </svg>
        </div>
        <p className="mt-4 text-sm font-medium text-midnight">No reports generated yet</p>
        <p className="mt-1 text-xs text-storm/40">Use the report builder above to generate your first report.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by name or scope…"
          className="min-w-[180px] flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-midnight placeholder:text-storm/30 focus:outline-2 focus:outline-offset-2 focus:outline-sky-primary"
          aria-label="Search report history"
        />
        <select value={typeFilter} onChange={(e) => onTypeFilterChange(e.target.value as ReportType | 'all')} className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-midnight focus:outline-2 focus:outline-offset-2 focus:outline-sky-primary" aria-label="Filter by report type">
          <option value="all">All types</option>
          {(Object.keys(REPORT_TYPE_LABELS) as ReportType[]).map((t) => (
            <option key={t} value={t}>{REPORT_TYPE_LABELS[t]}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => onStatusFilterChange(e.target.value as ReportStatus | 'all')} className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-midnight focus:outline-2 focus:outline-offset-2 focus:outline-sky-primary" aria-label="Filter by status">
          <option value="all">All statuses</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="generating">Generating</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
        <table className="w-full min-w-[650px] text-sm" role="table">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <Th>Name</Th>
              <Th>Type</Th>
              <Th>Scope</Th>
              <Th>Format</Th>
              <Th>Generated</Th>
              <Th>By</Th>
              <Th>Size</Th>
              <Th>Status</Th>
              <Th className="text-right">Action</Th>
            </tr>
          </thead>
          <tbody>
            {history.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                <td className="px-4 py-3 font-medium text-midnight text-xs max-w-40 truncate" title={r.name}>
                  {r.name}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-storm/60">
                  {REPORT_TYPE_LABELS[r.type]}
                </td>
                <td className="px-4 py-3 text-xs text-storm/50 max-w-32 truncate" title={r.scope_summary}>
                  {r.scope_summary}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    r.format === 'pdf' ? 'bg-rose-50 text-rose-700' : 'bg-sky-soft text-sky-deep'
                  }`}>
                    {r.format.toUpperCase()}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-storm/60">
                  {new Date(r.generated_at).toLocaleDateString()}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-storm/60">
                  {r.generated_by}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-storm/40 font-mono">
                  {r.file_size_bytes ? formatBytes(r.file_size_bytes) : '—'}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <StatusBadge status={r.status} failureReason={r.failure_reason} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  {r.status === 'completed' && (
                    <button
                      type="button"
                      onClick={() => onDownload(r)}
                      className="cursor-pointer rounded-lg px-2.5 py-1 text-[11px] font-semibold text-sky-primary transition-colors hover:bg-sky-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-primary"
                    >
                      Download
                    </button>
                  )}
                  {r.status === 'failed' && (
                    <button
                      type="button"
                      onClick={() => onRetry(r)}
                      className="cursor-pointer rounded-lg px-2.5 py-1 text-[11px] font-semibold text-amber-600 transition-colors hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
                    >
                      Retry
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-storm/40">
          {Math.min(page * pageSize, total)} of {total} report{total !== 1 ? 's' : ''}
        </p>
        <div className="flex gap-1">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-storm/60 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-primary disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Previous page"
          >
            ← Prev
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-primary ${
                p === page
                  ? 'border-sky-primary bg-sky-soft text-sky-deep'
                  : 'border-slate-200 bg-white text-storm/60 hover:bg-slate-100'
              }`}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </button>
          ))}
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-storm/60 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-primary disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Next page"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status, failureReason }: { status: ReportStatus; failureReason: string | null }) {
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
        Completed
      </span>
    )
  }
  if (status === 'generating') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-sky-soft px-2 py-0.5 text-[10px] font-semibold text-sky-deep">
        <svg className="h-2.5 w-2.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-30" />
          <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
        Generating
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700" title={failureReason ?? undefined}>
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-500" aria-hidden="true" />
      Failed
    </span>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-storm/40 text-left ${className ?? ''}`} scope="col">{children}</th>
}
