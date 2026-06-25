interface StationDropdownProps {
  stations: { station_id: string; name: string }[]
  selectedStationId: string | null
  onChange: (id: string | null) => void
}

export function StationDropdown({ stations, selectedStationId, onChange }: StationDropdownProps) {
  return (
    <div className="min-w-0 sm:w-56">
      <label htmlFor="station-select" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-storm/40">
        Station
      </label>
      <select
        id="station-select"
        value={selectedStationId ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-midnight transition-colors focus:border-sky-200 focus:ring-2 focus:ring-sky-soft focus:outline-none"
      >
        <option value="">All stations</option>
        {stations.map((s) => (
          <option key={s.station_id} value={s.station_id}>
            {s.name}
          </option>
        ))}
      </select>
    </div>
  )
}
