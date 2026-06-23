import { useCallback, useEffect, useState } from 'react'
import type { UserAccount, UserRole } from '../../services/api'
import { USER_ROLE_LABELS } from '../../services/api'

interface UserFormModalProps {
  open: boolean
  user: UserAccount | null
  onSave: (data: Partial<UserAccount>) => Promise<void>
  onClose: () => void
}

export function UserFormModal({ open, user, onSave, onClose }: UserFormModalProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('analyst')
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (open) {
      if (user) {
        setName(user.name)
        setEmail(user.email)
        setRole(user.role)
      } else {
        setName('')
        setEmail('')
        setRole('analyst')
      }
      setErrors({})
      setSaved(false)
    }
  }, [open, user])

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, saving, onClose])

  const validate = useCallback(() => {
    const errs: { name?: string; email?: string } = {}
    if (!name.trim()) errs.name = 'Name is required'
    if (!email.trim()) errs.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Invalid email format'
    return errs
  }, [name, email])

  const handleSubmit = async () => {
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSaving(true)
    try {
      await onSave({ name: name.trim(), email: email.trim(), role })
      setSaved(true)
      setTimeout(() => onClose(), 1200)
    } catch {
      /* parent handles error */
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-form-title"
    >
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl animate-fade-in-up motion-reduce:animate-none">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 id="user-form-title" className="text-lg font-semibold text-midnight font-display">
            {user ? 'Edit User' : 'Add User'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="cursor-pointer rounded-lg p-1.5 text-storm/40 transition-colors hover:bg-slate-100 hover:text-storm/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-primary"
            aria-label="Close"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          {/* ── Name ── */}
          <div>
            <label htmlFor="uf-name" className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-storm/40">Full Name *</label>
            <input id="uf-name" type="text" value={name} onChange={(e) => setName(e.target.value)} className={`w-full rounded-xl border bg-white px-3.5 py-2 text-sm text-midnight focus:outline-2 focus:outline-offset-2 focus:outline-sky-primary ${errors.name ? 'border-red-300' : 'border-slate-200'}`} />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
          </div>

          {/* ── Email ── */}
          <div>
            <label htmlFor="uf-email" className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-storm/40">Email *</label>
            <input id="uf-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`w-full rounded-xl border bg-white px-3.5 py-2 text-sm text-midnight focus:outline-2 focus:outline-offset-2 focus:outline-sky-primary ${errors.email ? 'border-red-300' : 'border-slate-200'}`} />
            {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
          </div>

          {/* ── Role ── */}
          <div>
            <label htmlFor="uf-role" className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-storm/40">Role</label>
            <select id="uf-role" value={role} onChange={(e) => setRole(e.target.value as UserRole)} className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-midnight focus:outline-2 focus:outline-offset-2 focus:outline-sky-primary">
              {(Object.keys(USER_ROLE_LABELS) as UserRole[]).map((r) => (
                <option key={r} value={r}>{USER_ROLE_LABELS[r]}</option>
              ))}
            </select>
          </div>

          {!user && (
            <div className="rounded-xl border border-sky-200 bg-sky-soft p-3.5">
              <p className="text-xs font-medium text-sky-deep">
                A welcome email with instructions will be sent to this address.
              </p>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
          <div>
            {saved && <span className="text-sm font-medium text-emerald animate-fade-in-up motion-reduce:animate-none">Saved successfully</span>}
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} disabled={saving} className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-storm/70 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400">Cancel</button>
            <button type="button" onClick={handleSubmit} disabled={saving} className="cursor-pointer rounded-xl bg-sky-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-primary">
              {saving ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-30" />
                    <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  Saving…
                </span>
              ) : (user ? 'Save changes' : 'Invite user')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
