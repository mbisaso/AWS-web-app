import { useState, type FormEvent } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useMaintenanceLogMutations, useMaintenanceLogs } from '../../hooks/useMaintenanceLogs'
import {
  MAINTENANCE_ACTIVITY_LABELS,
  type MaintenanceActivityType,
  type MaintenanceLogEntry,
  type MaintenanceLogInput,
} from '../../services/api'

const EDITOR_ROLES = new Set(['admin', 'meteorologist'])

interface FormState {
  activity_type: MaintenanceActivityType
  started_at: string
  ended_at: string
  performed_by: string
  description: string
}

// <input type="datetime-local"> works in the browser's local time without a zone.
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null
}

function emptyForm(): FormState {
  return {
    activity_type: 'inspection',
    started_at: toLocalInput(new Date().toISOString()),
    ended_at: '',
    performed_by: '',
    description: '',
  }
}

function errorMessage(err: unknown): string {
  const response = (err as { response?: { data?: { error?: string; detail?: string } } })?.response
  return response?.data?.error || response?.data?.detail || 'Could not save the maintenance entry.'
}

function formatWhen(entry: MaintenanceLogEntry): string {
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
  const start = new Date(entry.started_at).toLocaleString(undefined, options)
  return entry.ended_at ? `${start} – ${new Date(entry.ended_at).toLocaleString(undefined, options)}` : start
}

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-midnight focus:border-sky-primary focus:outline-none focus:ring-1 focus:ring-sky-primary'
const labelClass = 'mb-1 block text-[11px] font-semibold uppercase tracking-wider text-storm/50'

export function MaintenanceLogPanel({ stationCode, periodStart }: { stationCode: string; periodStart: string }) {
  const { role } = useAuth()
  const canEdit = role != null && EDITOR_ROLES.has(role)
  // Entries from the report start onwards, including any logged after the report was generated.
  const { data: entries = [], isLoading, error } = useMaintenanceLogs(stationCode, periodStart)
  const { create, update, remove } = useMaintenanceLogMutations()

  const [form, setForm] = useState<FormState | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const openNew = () => {
    setEditingId(null)
    setForm(emptyForm())
    setFormError(null)
  }

  const openEdit = (entry: MaintenanceLogEntry) => {
    setEditingId(entry.id)
    setForm({
      activity_type: entry.activity_type,
      started_at: toLocalInput(entry.started_at),
      ended_at: toLocalInput(entry.ended_at),
      performed_by: entry.performed_by,
      description: entry.description,
    })
    setFormError(null)
  }

  const closeForm = () => {
    setForm(null)
    setEditingId(null)
    setFormError(null)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!form) return
    if (!form.description.trim()) {
      setFormError('Describe what was done.')
      return
    }
    const data: MaintenanceLogInput = {
      station_code: stationCode,
      activity_type: form.activity_type,
      started_at: fromLocalInput(form.started_at) ?? new Date().toISOString(),
      ended_at: fromLocalInput(form.ended_at),
      performed_by: form.performed_by.trim(),
      description: form.description.trim(),
    }
    try {
      if (editingId != null) {
        await update.mutateAsync({ id: editingId, data })
      } else {
        await create.mutateAsync(data)
      }
      closeForm()
    } catch (err) {
      setFormError(errorMessage(err))
    }
  }

  const handleDelete = async (entry: MaintenanceLogEntry) => {
    if (!window.confirm(`Delete the ${entry.activity_label.toLowerCase()} entry from ${formatWhen(entry)}?`)) return
    try {
      await remove.mutateAsync(entry.id)
    } catch (err) {
      setFormError(errorMessage(err))
    }
  }

  const isSaving = create.isPending || update.isPending

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/50 px-6 py-4">
        <div className="flex items-center gap-2.5">
          <h3 className="text-base font-bold text-midnight font-display">Maintenance Log</h3>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-storm/70">
            {entries.length}
          </span>
        </div>
        {canEdit && !form && (
          <button
            type="button"
            onClick={openNew}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-midnight px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Log maintenance
          </button>
        )}
      </div>

      <div className="p-6 space-y-4">
        {form && (
          <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-sky-200 bg-sky-50/30 p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="ml-type" className={labelClass}>Activity</label>
                <select
                  id="ml-type"
                  value={form.activity_type}
                  onChange={(e) => setForm({ ...form, activity_type: e.target.value as MaintenanceActivityType })}
                  className={inputClass}
                >
                  {Object.entries(MAINTENANCE_ACTIVITY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="ml-start" className={labelClass}>Started</label>
                <input
                  id="ml-start"
                  type="datetime-local"
                  required
                  value={form.started_at}
                  onChange={(e) => setForm({ ...form, started_at: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="ml-end" className={labelClass}>Finished (optional)</label>
                <input
                  id="ml-end"
                  type="datetime-local"
                  value={form.ended_at}
                  min={form.started_at}
                  onChange={(e) => setForm({ ...form, ended_at: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>
            <div>
              <label htmlFor="ml-by" className={labelClass}>Performed by</label>
              <input
                id="ml-by"
                type="text"
                maxLength={100}
                placeholder="Technician or team"
                value={form.performed_by}
                onChange={(e) => setForm({ ...form, performed_by: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="ml-desc" className={labelClass}>What was done</label>
              <textarea
                id="ml-desc"
                rows={3}
                required
                placeholder="e.g. Replaced the battery and cleaned the solar panel"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className={inputClass}
              />
            </div>
            {formError && <p role="alert" className="text-xs font-medium text-rose-600">{formError}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeForm}
                className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-storm/70 hover:text-midnight"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="cursor-pointer rounded-lg bg-sky-primary px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
              >
                {isSaving ? 'Saving...' : editingId != null ? 'Save changes' : 'Add entry'}
              </button>
            </div>
          </form>
        )}

        {!form && formError && <p role="alert" className="text-xs font-medium text-rose-600">{formError}</p>}

        {isLoading ? (
          <p className="text-xs text-storm/50">Loading maintenance entries...</p>
        ) : error ? (
          <p className="text-xs text-rose-600">Could not load the maintenance log.</p>
        ) : entries.length === 0 ? (
          <p className="text-xs text-storm/60">
            No maintenance, resets or other interventions logged for this period.
            {canEdit && ' Use “Log maintenance” to record a site visit.'}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {entries.map((entry) => (
              <li key={entry.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-sky-700">
                      {entry.activity_label}
                    </span>
                    <span className="text-xs font-semibold text-midnight">{formatWhen(entry)}</span>
                  </div>
                  <p className="mt-1 text-sm text-midnight break-words">{entry.description}</p>
                  <p className="mt-0.5 text-[11px] text-storm/50">
                    {entry.performed_by ? `By ${entry.performed_by}` : 'Performer not recorded'}
                    {entry.created_by && ` · logged by ${entry.created_by}`}
                  </p>
                </div>
                {canEdit && (
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(entry)}
                      className="cursor-pointer rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-storm/70 hover:border-sky-primary hover:text-sky-700"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(entry)}
                      disabled={remove.isPending}
                      className="cursor-pointer rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-storm/70 hover:border-rose-300 hover:text-rose-600 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
