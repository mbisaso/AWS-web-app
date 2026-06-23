import { useCallback, useEffect, useState } from 'react'
import type { StationManagementData, ConnectivityType } from '../../services/api'
import { CONNECTIVITY_LABELS } from '../../services/api'
import { MapLocationPicker } from './MapLocationPicker'

const SENSOR_OPTIONS = [
  { value: 'temperature', label: 'Temperature' },
  { value: 'humidity', label: 'Humidity' },
  { value: 'rainfall', label: 'Rainfall' },
  { value: 'wind_speed', label: 'Wind Speed' },
  { value: 'pressure', label: 'Pressure' },
  { value: 'solar_radiation', label: 'Solar Radiation' },
]

interface StationFormModalProps {
  open: boolean
  station: StationManagementData | null
  onSave: (data: Partial<StationManagementData>) => Promise<void>
  onClose: () => void
}

interface FormErrors {
  name?: string
  latitude?: string
  longitude?: string
  expected_interval_minutes?: string
}

export function StationFormModal({ open, station, onSave, onClose }: StationFormModalProps) {
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [latitude, setLatitude] = useState(1.5)
  const [longitude, setLongitude] = useState(32.5)
  const [connectivity, setConnectivity] = useState<ConnectivityType>('gsm')
  const [expectedInterval, setExpectedInterval] = useState(15)
  const [sensors, setSensors] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (open) {
      if (station) {
        setName(station.name)
        setLocation(station.location)
        setLatitude(station.latitude)
        setLongitude(station.longitude)
        setConnectivity(station.connectivity)
        setExpectedInterval(station.expected_interval_minutes)
        setSensors(station.sensors)
        setNotes(station.notes)
      } else {
        setName('')
        setLocation('')
        setLatitude(1.5)
        setLongitude(32.5)
        setConnectivity('gsm')
        setExpectedInterval(15)
        setSensors([])
        setNotes('')
      }
      setErrors({})
      setSaved(false)
    }
  }, [open, station])

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, saving, onClose])

  const validate = useCallback((): FormErrors => {
    const errs: FormErrors = {}
    if (!name.trim()) errs.name = 'Station name is required'
    if (latitude < -90 || latitude > 90) errs.latitude = 'Latitude must be between -90 and 90'
    if (longitude < -180 || longitude > 180) errs.longitude = 'Longitude must be between -180 and 180'
    if (expectedInterval < 1 || expectedInterval > 1440) errs.expected_interval_minutes = 'Interval must be 1–1440 minutes'
    return errs
  }, [name, latitude, longitude, expectedInterval])

  const handleSubmit = async () => {
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSaving(true)
    try {
      await onSave({
        name: name.trim(),
        location: location.trim(),
        latitude,
        longitude,
        connectivity,
        expected_interval_minutes: expectedInterval,
        sensors,
        notes: notes.trim(),
      })
      setSaved(true)
      setTimeout(() => onClose(), 1200)
    } catch {
      /* error handled by parent */
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
      aria-labelledby="station-form-title"
    >
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl animate-fade-in-up motion-reduce:animate-none">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 id="station-form-title" className="text-lg font-semibold text-midnight font-display">
            {station ? 'Edit Station' : 'Add Station'}
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
            <label htmlFor="sf-name" className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-storm/40">Station Name *</label>
            <input id="sf-name" type="text" value={name} onChange={(e) => setName(e.target.value)} className={`w-full rounded-xl border bg-white px-3.5 py-2 text-sm text-midnight focus:outline-2 focus:outline-offset-2 focus:outline-sky-primary ${errors.name ? 'border-red-300' : 'border-slate-200'}`} />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
          </div>

          {/* ── Location ── */}
          <div>
            <label htmlFor="sf-location" className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-storm/40">Location Description</label>
            <input id="sf-location" type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Kampala, Central Region" className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-midnight placeholder:text-storm/30 focus:outline-2 focus:outline-offset-2 focus:outline-sky-primary" />
          </div>

          {/* ── Map picker ── */}
          <div>
            <p className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-storm/40">Coordinates</p>
            <MapLocationPicker
              latitude={latitude}
              longitude={longitude}
              onChange={(lat, lng) => { setLatitude(lat); setLongitude(lng) }}
            />
            {(errors.latitude || errors.longitude) && (
              <p className="mt-1 text-xs text-red-500">{errors.latitude || errors.longitude}</p>
            )}
          </div>

          {/* ── Connectivity ── */}
          <div>
            <label htmlFor="sf-connectivity" className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-storm/40">Connectivity</label>
            <select id="sf-connectivity" value={connectivity} onChange={(e) => setConnectivity(e.target.value as ConnectivityType)} className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-midnight focus:outline-2 focus:outline-offset-2 focus:outline-sky-primary">
              {(Object.keys(CONNECTIVITY_LABELS) as ConnectivityType[]).map((c) => (
                <option key={c} value={c}>{CONNECTIVITY_LABELS[c]}</option>
              ))}
            </select>
          </div>

          {/* ── Expected interval ── */}
          <div>
            <label htmlFor="sf-interval" className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-storm/40">Expected Interval (minutes) *</label>
            <input id="sf-interval" type="number" min={1} max={1440} value={expectedInterval} onChange={(e) => setExpectedInterval(parseInt(e.target.value) || 15)} className={`w-full rounded-xl border bg-white px-3.5 py-2 text-sm text-midnight focus:outline-2 focus:outline-offset-2 focus:outline-sky-primary ${errors.expected_interval_minutes ? 'border-red-300' : 'border-slate-200'}`} />
            {errors.expected_interval_minutes && <p className="mt-1 text-xs text-red-500">{errors.expected_interval_minutes}</p>}
          </div>

          {/* ── Sensors ── */}
          <div>
            <p className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-storm/40">Sensor Types</p>
            <div className="flex flex-wrap gap-2">
              {SENSOR_OPTIONS.map((s) => {
                const selected = sensors.includes(s.value)
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setSensors((prev) => selected ? prev.filter((p) => p !== s.value) : [...prev, s.value])}
                    className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-primary ${selected ? 'border-sky-primary bg-sky-soft text-sky-deep' : 'border-slate-200 bg-white text-storm/60 hover:border-slate-300'}`}
                    aria-pressed={selected}
                  >
                    {s.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Notes ── */}
          <div>
            <label htmlFor="sf-notes" className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-storm/40">Notes</label>
            <textarea id="sf-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-midnight placeholder:text-storm/30 focus:outline-2 focus:outline-offset-2 focus:outline-sky-primary" />
          </div>
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
              ) : (station ? 'Save changes' : 'Add station')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
