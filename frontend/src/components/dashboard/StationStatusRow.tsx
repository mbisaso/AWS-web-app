import { type StationReading, formatRelativeTime } from '../../services/api'
import { StatusBadge } from './StatusIndicator'
import { MapPinIcon, ClockIcon } from '../landing/Icons'

interface StationStatusRowProps {
  station: StationReading
}

export function StationStatusRow({ station }: StationStatusRowProps) {
  const relativeTime = formatRelativeTime(station.last_seen)

  return (
    <>
      {/* ── Desktop table row ── */}
      <tr
        className={`group border-b border-slate-100 transition-colors duration-150 hover:bg-sky-soft/40 max-md:hidden ${
          station.is_stale ? 'bg-amber-50/30' : ''
        }`}
        role="row"
        aria-label={`${station.name} — ${station.status}`}
      >
        <td className="py-3.5 pl-5 pr-2" role="cell">
          <div className="truncate">
            <p className="truncate text-sm font-semibold text-midnight">{station.name}</p>
            <p className="text-xs text-storm/40">{station.station_code}</p>
          </div>
        </td>

        <td className="py-3.5 px-2" role="cell">
          <StatusBadge status={station.status} />
        </td>

        <td className="py-3.5 px-2" role="cell">
          {station.temperature ? (
            <span className="text-sm font-medium tabular-nums text-midnight">
              {station.temperature.value.toFixed(1)}
              <span className="text-storm/40">{station.temperature.unit}</span>
            </span>
          ) : (
            <span className="text-sm text-storm/30">—</span>
          )}
        </td>

        <td className="py-3.5 px-2" role="cell">
          {station.humidity ? (
            <span className="text-sm font-medium tabular-nums text-midnight">
              {station.humidity.value}
              <span className="text-storm/40">{station.humidity.unit}</span>
            </span>
          ) : (
            <span className="text-sm text-storm/30">—</span>
          )}
        </td>

        <td className="py-3.5 px-2" role="cell">
          {station.rainfall ? (
            <span className="text-sm font-medium tabular-nums text-midnight">
              {station.rainfall.value.toFixed(1)}
              <span className="text-storm/40">{station.rainfall.unit}</span>
            </span>
          ) : (
            <span className="text-sm text-storm/30">—</span>
          )}
        </td>

        <td className="py-3.5 px-2" role="cell">
          {station.wind_speed ? (
            <span className="text-sm font-medium tabular-nums text-midnight">
              {station.wind_speed.value.toFixed(1)}
              <span className="text-storm/40">{station.wind_speed.unit}</span>
            </span>
          ) : (
            <span className="text-sm text-storm/30">—</span>
          )}
        </td>

        <td className="py-3.5 pl-2 pr-5" role="cell">
          <div className="flex items-center gap-2">
            <ClockIcon className="h-3.5 w-3.5 text-storm/30" />
            <span
              className={`text-sm ${
                station.is_stale ? 'font-semibold text-amber-700' : 'text-storm/50'
              }`}
            >
              {relativeTime}
            </span>
            {station.is_stale && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                Stale
              </span>
            )}
          </div>
        </td>
      </tr>

      {/* ── Mobile card ── */}
      <article
        className={`rounded-2xl border p-4 md:hidden ${
          station.is_stale
            ? 'border-amber-200 bg-amber-50/40'
            : 'border-slate-200 bg-white'
        }`}
        aria-label={`${station.name} — ${station.status}`}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-midnight">{station.name}</p>
              <span className="text-[10px] text-storm/40">{station.station_code}</span>
            </div>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-storm/40">
              <MapPinIcon className="h-3 w-3" />
              {station.location}
            </p>
          </div>
          <StatusBadge status={station.status} />
        </div>

        {/* Sensor readings row */}
        <div className="mt-3 grid grid-cols-4 gap-2">
          <MobileSensor label="Temp" value={station.temperature} />
          <MobileSensor label="Humidity" value={station.humidity} />
          <MobileSensor label="Rain" value={station.rainfall} />
          <MobileSensor label="Wind" value={station.wind_speed} />
        </div>

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
          <div className="flex items-center gap-1.5">
            <ClockIcon className="h-3.5 w-3.5 text-storm/30" />
            <span
              className={`text-xs ${
                station.is_stale ? 'font-semibold text-amber-700' : 'text-storm/50'
              }`}
            >
              {relativeTime}
            </span>
            {station.is_stale && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                Stale
              </span>
            )}
          </div>
        </div>
      </article>
    </>
  )
}

function MobileSensor({
  label,
  value,
}: {
  label: string
  value: { value: number; unit: string } | null
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-2.5 text-center">
      <p className="text-[10px] font-medium uppercase tracking-wider text-storm/40">{label}</p>
      {value ? (
        <p className="mt-0.5 text-sm font-semibold tabular-nums text-midnight">
          {value.value.toFixed(value.unit === '°C' ? 1 : 0)}
          <span className="text-storm/40 text-[10px]">{value.unit}</span>
        </p>
      ) : (
        <p className="mt-0.5 text-sm text-storm/30">—</p>
      )}
    </div>
  )
}
