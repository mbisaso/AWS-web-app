import type { TopUpRecord } from '../../services/api'

interface TopUpHistoryTableProps {
  history: TopUpRecord[]
  isLoading?: boolean
}

export function TopUpHistoryTable({ history, isLoading }: TopUpHistoryTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3">
            <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-16 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
          </div>
        ))}
      </div>
    )
  }

  if (!history.length) {
    return (
      <p className="py-4 text-center text-sm text-storm/40">
        No top-ups recorded for this SIM.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
      <table className="w-full min-w-[400px] text-sm" role="table">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/50">
            <Th>Date</Th>
            <Th>Amount</Th>
            <Th>New total</Th>
            <Th>By</Th>
            <Th>Note</Th>
          </tr>
        </thead>
        <tbody>
          {history.map((record) => (
            <tr key={record.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
              <td className="whitespace-nowrap px-4 py-2.5 text-xs text-storm/60">
                {new Date(record.created_at).toLocaleDateString()}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 font-medium text-emerald-deep">
                +{record.amount_mb.toLocaleString()} MB
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-storm/60">
                {record.new_total_mb.toLocaleString()} MB
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-xs text-storm/60">
                {record.added_by}
              </td>
              <td className="px-4 py-2.5 text-xs text-storm/50 max-w-40 truncate">
                {record.note}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-storm/40 text-left" scope="col">{children}</th>
}
