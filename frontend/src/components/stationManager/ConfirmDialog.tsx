import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  variant: 'danger' | 'warning'
  requireExtraConfirm?: boolean
  extraConfirmText?: string
  onConfirm: () => void
  onCancel: () => void
  isLoading?: boolean
  children?: ReactNode
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  variant,
  requireExtraConfirm,
  extraConfirmText = 'DELETE',
  onConfirm,
  onCancel,
  isLoading,
  children,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const [typed, setTyped] = useState('')
  const canConfirm = !requireExtraConfirm || typed === extraConfirmText

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onCancel()
    },
    [onCancel, isLoading],
  )

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown)
      cancelRef.current?.focus()
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, handleKeyDown])

  useEffect(() => {
    if (!open) setTyped('')
  }, [open])

  if (!open) return null

  const accentBg = variant === 'danger' ? 'bg-red-600 hover:bg-red-700 focus-visible:outline-red-600' : 'bg-amber-600 hover:bg-amber-700 focus-visible:outline-amber-600'
  const accentRing = variant === 'danger' ? 'focus-visible:outline-red-600' : 'focus-visible:outline-amber-600'
  const accentBgLight = variant === 'danger' ? 'bg-red-50' : 'bg-amber-50'
  const accentText = variant === 'danger' ? 'text-red-600' : 'text-amber-600'
  const accentBorder = variant === 'danger' ? 'border-red-200' : 'border-amber-200'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget && !isLoading) onCancel() }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-desc"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl animate-fade-in-up motion-reduce:animate-none"
      >
        <div className="p-6">
          {/* ── Icon ── */}
          <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-full ${accentBgLight}`}>
            {variant === 'danger' ? (
              <svg className={`h-5 w-5 ${accentText}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4" />
                <circle cx="12" cy="16" r="0.5" fill="currentColor" />
              </svg>
            ) : (
              <svg className={`h-5 w-5 ${accentText}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <path d="M12 9v4" />
                <circle cx="12" cy="17" r="0.5" fill="currentColor" />
              </svg>
            )}
          </div>

          <h2 id="confirm-title" className="text-lg font-semibold text-midnight font-display">{title}</h2>
          <p id="confirm-desc" className="mt-2 text-sm text-storm/70 leading-relaxed">{description}</p>

          {children && <div className="mt-3">{children}</div>}

          {requireExtraConfirm && (
            <div className="mt-4">
              <label htmlFor="confirm-typed" className="text-xs font-semibold text-storm/60">
                Type <span className="font-mono font-bold">{extraConfirmText}</span> to confirm
              </label>
              <input
                id="confirm-typed"
                type="text"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm text-midnight focus:outline-2 focus:outline-offset-2 ${accentRing} ${accentBorder}`}
                placeholder={extraConfirmText}
                autoComplete="off"
              />
            </div>
          )}
        </div>

        {/* ── Actions ── */}
        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className={`cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-storm/70 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 ${isLoading ? 'opacity-50' : ''}`}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm || isLoading}
            className={`cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${accentBg} ${!canConfirm || isLoading ? 'opacity-50' : ''}`}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-30" />
                  <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                Processing…
              </span>
            ) : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
