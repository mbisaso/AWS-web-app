import { useCallback, useEffect, useRef, useState } from 'react'

interface TopUpFormProps {
  open: boolean
  onConfirm: (amountMb: number, note: string) => Promise<void>
  onCancel: () => void
}

export function TopUpForm({ open, onConfirm, onCancel }: TopUpFormProps) {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const firstInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setAmount('')
      setNote('')
      setError(null)
      setSaving(false)
      setTimeout(() => firstInputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) onCancel()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, saving, onCancel])

  const validate = useCallback((): string | null => {
    const v = Number(amount)
    if (!amount.trim()) return 'Amount is required'
    if (isNaN(v) || v <= 0) return 'Amount must be a positive number'
    if (v < 10) return 'Minimum top-up is 10 MB'
    if (v > 100_000) return 'Amount seems unusually large. Maximum is 100,000 MB.'
    if (!Number.isInteger(v)) return 'Amount must be a whole number'
    return null
  }, [amount])

  const handleSubmit = async () => {
    const err = validate()
    if (err) { setError(err); return }
    setSaving(true)
    setError(null)
    try {
      await onConfirm(Number(amount), note.trim())
    } catch {
      setError('Top-up failed. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onCancel() }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="topup-title"
    >
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-2xl animate-fade-in-up motion-reduce:animate-none">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 id="topup-title" className="text-lg font-semibold text-midnight font-display">
            Top up data bundle
          </h2>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="cursor-pointer rounded-lg p-1.5 text-storm/40 transition-colors hover:bg-slate-100 hover:text-storm/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-primary"
            aria-label="Close"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <label htmlFor="topup-amount" className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-storm/40">
              Amount (MB) *
            </label>
            <input
              ref={firstInputRef}
              id="topup-amount"
              type="number"
              min={10}
              max={100_000}
              step={1}
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setError(null) }}
              className={`w-full rounded-xl border bg-white px-3.5 py-2 text-sm text-midnight focus:outline-2 focus:outline-offset-2 focus:outline-sky-primary ${error ? 'border-red-300' : 'border-slate-200'}`}
              placeholder="e.g. 500"
              autoComplete="off"
            />
            {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
          </div>

          <div>
            <label htmlFor="topup-note" className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-storm/40">
              Note (optional)
            </label>
            <textarea
              id="topup-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-midnight placeholder:text-storm/30 focus:outline-2 focus:outline-offset-2 focus:outline-sky-primary"
              placeholder="e.g. Monthly top-up"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-storm/70 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="cursor-pointer rounded-xl bg-sky-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-primary"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-30" />
                  <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                Processing…
              </span>
            ) : 'Top up'}
          </button>
        </div>
      </div>
    </div>
  )
}
