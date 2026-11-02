import { useState } from 'react'
import type { SimManagementData } from '../../services/api'
import { useRecordSimBalance, useUpdateSimLoadDate } from '../../hooks/useSimBalance'
import { toLocalInputValue } from '../../utils/reportPeriod'

const labelClass = 'mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-storm/40'
const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-midnight focus:outline-2 focus:outline-offset-1 focus:outline-sky-primary'

/** Shows how usage is estimated and lets the user correct it with the balance MTN reports. */
export function SimBalanceCard({ data }: { data: SimManagementData }) {
  const recordBalance = useRecordSimBalance(data.sim.id)
  const updateLoadDate = useUpdateSimLoadDate(data.sim.id)

  const [remaining, setRemaining] = useState('')
  const [checkedAt, setCheckedAt] = useState(() => toLocalInputValue(new Date()))
  const [loadDate, setLoadDate] = useState(data.sim.date_loaded ?? '')
  const [error, setError] = useState<string | null>(null)

  const handleRecord = () => {
    const mb = Number(remaining)
    if (!remaining.trim() || !Number.isFinite(mb) || mb < 0) {
      setError('Enter the remaining data in MB')
      return
    }
    const at = new Date(checkedAt)
    if (isNaN(at.getTime()) || at > new Date()) {
      setError('Check time cannot be in the future')
      return
    }
    setError(null)
    recordBalance.mutate(
      { remainingMb: mb, checkedAt: at.toISOString() },
      { onSuccess: () => setRemaining(''), onError: () => setError('Could not save the balance. Try again.') },
    )
  }

  const check = data.last_balance_check

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-storm/40">Usage tracking</p>
          <p className="mt-1 text-xs text-storm/60">
            {data.usage_basis === 'measured' ? 'Measured' : 'Expected'} ≈{' '}
            <span className="font-semibold text-midnight">{data.avg_daily_usage_mb.toFixed(2)} MB/day</span>
            {' '}from the station's HTTPS posts to the server.
          </p>
        </div>
        <div className="text-right">
          <p className={labelClass}>Calibration</p>
          <p className="text-xs font-semibold text-midnight">
            {check ? `×${data.calibration_factor.toFixed(2)}` : 'Not calibrated'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <label htmlFor="sim-load-date" className={labelClass}>Bundle loaded on</label>
          <input
            id="sim-load-date"
            type="date"
            value={loadDate}
            onChange={(e) => setLoadDate(e.target.value)}
            className={inputClass}
          />
        </div>
        <button
          type="button"
          disabled={!loadDate || loadDate === data.sim.date_loaded || updateLoadDate.isPending}
          onClick={() => updateLoadDate.mutate(loadDate)}
          className="cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-midnight hover:border-sky-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          {updateLoadDate.isPending ? 'Saving…' : 'Save date'}
        </button>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <p className="text-xs font-semibold text-midnight">Record MTN balance</p>
        <p className="mt-0.5 text-[11px] text-storm/50">
          Check the SIM's data balance (MTN USSD menu or MyMTN app) and enter it here. The estimate restarts from
          this balance and adjusts its overhead to match what MTN bills.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <label htmlFor="sim-actual-mb" className={labelClass}>Remaining (MB)</label>
            <input
              id="sim-actual-mb"
              type="number"
              min={0}
              step="any"
              value={remaining}
              onChange={(e) => { setRemaining(e.target.value); setError(null) }}
              placeholder={`est. ${data.remaining_mb.toFixed(1)}`}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="sim-checked-at" className={labelClass}>Checked at</label>
            <input
              id="sim-checked-at"
              type="datetime-local"
              value={checkedAt}
              max={toLocalInputValue(new Date())}
              onChange={(e) => setCheckedAt(e.target.value)}
              className={inputClass}
            />
          </div>
          <button
            type="button"
            onClick={handleRecord}
            disabled={recordBalance.isPending}
            className="cursor-pointer rounded-lg bg-sky-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-deep disabled:cursor-wait disabled:opacity-60"
          >
            {recordBalance.isPending ? 'Saving…' : 'Save balance'}
          </button>
        </div>
        {error && <p role="alert" className="mt-2 text-xs text-rose-600">{error}</p>}
        {check && (
          <p className="mt-2 text-[11px] text-storm/50">
            Last check {new Date(check.checked_at).toLocaleString()}: MTN {check.actual_mb.toLocaleString()} MB vs
            estimate {check.estimated_mb.toLocaleString()} MB.
          </p>
        )}
      </div>
    </div>
  )
}
