import { useCallback, useEffect, useState } from 'react'
import type { SensorType, StationReading } from '../../services/api'
import { SENSOR_CONFIG, DATE_PRESETS } from '../../services/api'

const SENSOR_TYPES = Object.keys(SENSOR_CONFIG) as SensorType[]

interface StationSensorSelectorProps {
  stations: StationReading[]
  selectedStationId: number | null
  onStationChange: (id: number | null) => void
  selectedSensor: SensorType
  onSensorChange: (sensor: SensorType) => void
  dateFrom: string
  dateTo: string
  onDateChange: (from: string, to: string) => void
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function daysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return toISODate(d)
}

export function StationSensorSelector({
  stations,
  selectedStationId,
  onStationChange,
  selectedSensor,
  onSensorChange,
  dateFrom,
  dateTo,
  onDateChange,
}: StationSensorSelectorProps) {
  const [activePreset, setActivePreset] = useState<number | null>(7)
  const [customMode, setCustomMode] = useState(false)

  const handlePreset = useCallback(
    (days: number) => {
      setActivePreset(days)
      setCustomMode(false)
      onDateChange(daysAgo(days), toISODate(new Date()))
    },
    [onDateChange],
  )

  useEffect(() => {
    handlePreset(7)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      {/* Station + Sensor row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        {/* Station selector */}
        <div className="min-w-0 sm:w-56">
          <label htmlFor="station-select" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-storm/40">
            Station
          </label>
          <select
            id="station-select"
            value={selectedStationId ?? ''}
            onChange={(e) => onStationChange(e.target.value ? Number(e.target.value) : null)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-midnight transition-colors focus:border-sky-200 focus:ring-2 focus:ring-sky-soft focus:outline-none"
          >
            <option value="">All stations</option>
            {stations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Date presets */}
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-storm/40">
            Date range
          </p>
          <div className="flex gap-1" role="group" aria-label="Date range presets">
            {DATE_PRESETS.map((p) => (
              <button
                key={p.days}
                type="button"
                onClick={() => handlePreset(p.days)}
                className={`cursor-pointer rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
                  !customMode && activePreset === p.days
                    ? 'bg-midnight text-white shadow-xs'
                    : 'bg-white text-storm/60 hover:text-storm hover:bg-slate-100 border border-slate-200'
                }`}
                aria-pressed={!customMode && activePreset === p.days}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setCustomMode(true)
                setActivePreset(null)
              }}
              className={`cursor-pointer rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
                customMode
                  ? 'bg-midnight text-white shadow-xs'
                  : 'bg-white text-storm/60 hover:text-storm hover:bg-slate-100 border border-slate-200'
              }`}
              aria-pressed={customMode}
            >
              Custom
            </button>
          </div>
        </div>

        {/* Custom date inputs */}
        {customMode && (
          <div className="flex items-end gap-2">
            <div>
              <label htmlFor="date-from" className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-storm/40">
                From
              </label>
              <input
                id="date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => onDateChange(e.target.value, dateTo)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-midnight focus:border-sky-200 focus:ring-2 focus:ring-sky-soft focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="date-to" className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-storm/40">
                To
              </label>
              <input
                id="date-to"
                type="date"
                value={dateTo}
                onChange={(e) => onDateChange(dateFrom, e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-midnight focus:border-sky-200 focus:ring-2 focus:ring-sky-soft focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Sensor tabs */}
      <div className="flex flex-wrap gap-1" role="tablist" aria-label="Sensor type">
        {SENSOR_TYPES.map((type) => {
          const cfg = SENSOR_CONFIG[type]
          const isActive = selectedSensor === type
          return (
            <button
              key={type}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSensorChange(type)}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                isActive
                  ? 'bg-midnight text-white shadow-xs'
                  : 'bg-white text-storm/60 hover:bg-slate-100 hover:text-storm border border-slate-200'
              }`}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: cfg.color }}
                aria-hidden="true"
              />
              {cfg.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
