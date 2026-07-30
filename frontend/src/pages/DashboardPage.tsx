import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardSidebar } from "../components/dashboard/DashboardSidebar";
import { SummaryCharts } from "../components/dashboard/SummaryCharts";
import { CompactMapPreview } from "../components/dashboard/CompactMapPreview";
import { RecentAlertsPreview } from "../components/dashboard/RecentAlertsPreview";
// import { PageConnectors } from "../components/dashboard/PageConnectors";
import { useDashboardData } from "../hooks/useDashboardData";
import { fetchStations } from "../api/stations";
import type { Station, StationOperationalStatus } from "../types";
import { deriveHealth, healthBadge } from "../utils/sensorHealth";

const STATUS_LABELS: Record<
  StationOperationalStatus,
  { title: string; tone: string; description: string }
> = {
  full: {
    title: "Fully transmitting",
    tone: "bg-emerald-50 text-emerald-700",
    description: "Stations reporting on schedule",
  },
  partial: {
    title: "Partial transmission",
    tone: "bg-amber-50 text-amber-700",
    description: "Stations with delayed readings",
  },
  down: {
    title: "Totally down",
    tone: "bg-rose-50 text-rose-700",
    description: "Stations without recent data",
  },
};

const STATUS_BADGE: Record<StationOperationalStatus, string> = {
  full: "bg-emerald-50 text-emerald-700",
  partial: "bg-amber-50 text-amber-700",
  down: "bg-rose-50 text-rose-700",
};

function statusOf(station: Station): StationOperationalStatus {
  return station.status?.status ?? "full";
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { data: dashData } = useDashboardData();
  const [stations, setStations] = useState<Station[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStations()
      .then(setStations)
      .catch(() => setError("Could not load stations. Is the backend running?"))
      .finally(() => setIsLoading(false));
  }, []);

  const counts = stations.reduce(
    (acc, station) => {
      acc[statusOf(station)] += 1;
      return acc;
    },
    { full: 0, partial: 0, down: 0 } as Record<
      StationOperationalStatus,
      number
    >,
  );

  const dashStations = dashData?.stations ?? [];
  const alerts = dashData?.alerts ?? [];

  const sensorAvg = useMemo(() => {
    const calc = (
      key: "temperature" | "humidity" | "pressure" | "wind_speed",
    ) => {
      const withVal = dashStations.filter((s) => s[key]);
      if (!withVal.length) return null;
      return withVal.reduce((a, s) => a + s[key]!.value, 0) / withVal.length;
    };
    return {
      temperature: calc("temperature"),
      humidity: calc("humidity"),
      pressure: calc("pressure"),
      windSpeed: calc("wind_speed"),
    };
  }, [dashStations]);

  return (
    <div className="flex min-h-screen flex-col bg-mist lg:h-screen lg:flex-row lg:overflow-hidden">
      <DashboardSidebar />

      <main className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-slate-200 bg-white shadow-elevation-2">
          <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#0a6ebd]">
                Dashboard
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-[#1a2332] font-display">
                Station overview
              </h1>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <span className="rounded-full bg-sky-50 px-3 py-1 font-medium text-[#0a6ebd]">
                All stations
              </span>
            </div>
          </div>

          <div className="space-y-8 px-6 py-6">
            {isLoading && (
              <div className="space-y-6" aria-label="Loading stations">
                <div className="grid gap-4 md:grid-cols-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="overflow-hidden rounded-3xl border border-slate-200 bg-[#f8fafc] p-5"
                    >
                      <div className="h-6 w-10 rounded-full bg-slate-200 skeleton-shimmer" />
                      <div className="mt-4 h-5 w-32 rounded bg-slate-200 skeleton-shimmer" />
                      <div className="mt-2 h-3 w-48 rounded bg-slate-100 skeleton-shimmer" />
                    </div>
                  ))}
                </div>
                <div className="h-4 w-32 rounded-full bg-slate-200 skeleton-shimmer" />
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="flex items-center gap-4 border-b border-slate-100 px-4 py-4 last:border-b-0"
                    >
                      <div className="h-3 w-24 rounded-full bg-slate-200 skeleton-shimmer" />
                      <div className="h-3 w-20 rounded-full bg-slate-200 skeleton-shimmer" />
                      <div className="h-3 w-16 rounded-full bg-slate-100 skeleton-shimmer" />
                      <div className="ml-auto h-3 w-20 rounded-full bg-slate-100 skeleton-shimmer" />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {error && <p className="text-sm text-rose-600">{error}</p>}

            {!isLoading && !error && (
              <>
                {/* ── Station summary ── */}
                <section>
                  <div className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Station summary
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    {(
                      Object.keys(STATUS_LABELS) as StationOperationalStatus[]
                    ).map((status) => (
                      <article
                        key={status}
                        className="group rounded-3xl border border-slate-200 bg-[#f8fafc] p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-elevation-2 cursor-default"
                      >
                        <div
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold transition-transform duration-200 group-hover:scale-105 ${STATUS_LABELS[status].tone}`}
                        >
                          {String(counts[status]).padStart(2, "0")}
                        </div>
                        <h2 className="mt-4 text-xl font-semibold text-[#1a2332] font-display">
                          {STATUS_LABELS[status].title}
                        </h2>
                        <p className="mt-2 text-sm leading-7 text-slate-600">
                          {STATUS_LABELS[status].description}
                        </p>
                      </article>
                    ))}
                  </div>
                </section>

                {/* ── All stations (list) + Insights panel ── */}
                <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                  <div>
                    <div className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                      All stations
                    </div>
                    {stations.length === 0 ? (
                      <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white/50 px-5 py-16 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-storm/30">
                          <svg
                            className="h-6 w-6"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                            <polyline points="9 22 9 12 15 12 15 22" />
                          </svg>
                        </div>
                        <p className="mt-4 text-sm font-semibold text-storm/50">
                          No stations registered yet
                        </p>
                        <p className="mt-1 text-xs text-storm/30">
                          Add a station in the Station Manager to get started.
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-xs">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm">
                            <thead>
                              <tr className="border-b border-slate-100 bg-slate-50/80">
                                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400 sticky top-0 bg-slate-50/80">
                                  Station
                                </th>
                                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400 sticky top-0 bg-slate-50/80">
                                  Location
                                </th>
                                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400 sticky top-0 bg-slate-50/80">
                                  Status
                                </th>
                                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400 sticky top-0 bg-slate-50/80">
                                  Sensor health
                                </th>
                                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400 sticky top-0 bg-slate-50/80">
                                  Last Updated
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {stations.map((station) => {
                                const status = statusOf(station);
                                const health = deriveHealth(station);
                                const badge = healthBadge(health);
                                return (
                                  <tr
                                    key={station.station_id}
                                    onClick={() =>
                                      navigate(
                                        `/dashboard/stations/${station.station_id}`,
                                      )
                                    }
                                    className="cursor-pointer border-b border-slate-100 transition-colors duration-150 last:border-b-0 hover:bg-sky-soft/30"
                                  >
                                    <td className="px-4 py-3.5">
                                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                                        {station.station_id}
                                      </p>
                                      <p className="mt-0.5 font-semibold text-midnight">
                                        {station.name}
                                      </p>
                                    </td>
                                    <td className="px-4 py-3.5 text-sm text-slate-500">
                                      {station.location || "—"}
                                    </td>
                                    <td className="px-4 py-3.5">
                                      <span
                                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[status]}`}
                                      >
                                        {status === "full"
                                          ? "Online"
                                          : status === "partial"
                                            ? "Partial"
                                            : "Down"}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3.5">
                                      <span
                                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.tone}`}
                                      >
                                        {badge.label}
                                      </span>
                                      {health.faultyCount > 0 && (
                                        <p className="mt-1 text-[11px] text-slate-400">
                                          {health.faulty
                                            .map((s) => s.label)
                                            .join(", ")}
                                        </p>
                                      )}
                                    </td>
                                    <td className="px-4 py-3.5 text-xs text-slate-400 tabular-nums">
                                      {station.status?.last_updated
                                        ? new Date(
                                            station.status.last_updated,
                                          ).toLocaleString()
                                        : "—"}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>

                  <aside className="rounded-3xl border border-slate-200 bg-[#f8fafc] p-5 transition-shadow duration-300 hover:shadow-xs">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                        AI Model Analytics
                      </p>
                      <h2 className="mt-2 text-xl font-semibold text-[#1a2332]">
                        Insights panel
                      </h2>
                    </div>
                    <div className="mt-5 space-y-4">
                      {stations.length > 0 &&
                        (() => {
                          const health = stations.map((s) => deriveHealth(s));
                          const analysed = health.filter((h) => h.hasData);
                          const withFaults = analysed.filter(
                            (h) => h.summary === "fault",
                          ).length;
                          const healthy = analysed.filter(
                            (h) => h.summary === "ok",
                          ).length;
                          const awaiting = health.length - analysed.length;
                          const faultyPct = analysed.length
                            ? Math.round((withFaults / analysed.length) * 100)
                            : 0;
                          const stroke = faultyPct > 0 ? "#E11D48" : "#10B981";
                          return (
                            <>
                              <div className="flex items-center justify-center">
                                <div className="relative flex h-24 w-24 items-center justify-center">
                                  <svg
                                    viewBox="0 0 120 120"
                                    className="h-24 w-24 -rotate-90"
                                    role="img"
                                    aria-label={`${faultyPct}% of analysed stations have sensor faults`}
                                  >
                                    <circle
                                      cx="60"
                                      cy="60"
                                      r="48"
                                      fill="none"
                                      stroke="#E2E8F0"
                                      strokeWidth="10"
                                    />
                                    <circle
                                      cx="60"
                                      cy="60"
                                      r="48"
                                      fill="none"
                                      stroke={stroke}
                                      strokeWidth="10"
                                      strokeDasharray={`${faultyPct * 3.016} ${(100 - faultyPct) * 3.016}`}
                                      strokeLinecap="round"
                                      className="transition-all duration-700"
                                    />
                                  </svg>
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="text-center">
                                      <p className="text-xl font-bold text-midnight font-display">
                                        {faultyPct}%
                                      </p>
                                      <p className="text-[10px] font-medium text-storm/40">
                                        with faults
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="space-y-2.5">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="flex items-center gap-1.5 text-storm/60">
                                    <span
                                      className="inline-block h-2 w-2 rounded-full bg-emerald-500"
                                      aria-hidden="true"
                                    />{" "}
                                    All sensors OK
                                  </span>
                                  <span className="font-semibold tabular-nums text-midnight">
                                    {healthy}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="flex items-center gap-1.5 text-storm/60">
                                    <span
                                      className="inline-block h-2 w-2 rounded-full bg-rose-500"
                                      aria-hidden="true"
                                    />{" "}
                                    Sensor fault(s)
                                  </span>
                                  <span className="font-semibold tabular-nums text-midnight">
                                    {withFaults}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="flex items-center gap-1.5 text-storm/60">
                                    <span
                                      className="inline-block h-2 w-2 rounded-full bg-slate-300"
                                      aria-hidden="true"
                                    />{" "}
                                    Awaiting analysis
                                  </span>
                                  <span className="font-semibold tabular-nums text-midnight">
                                    {awaiting}
                                  </span>
                                </div>
                              </div>
                            </>
                          );
                        })()}
                      <p className="text-xs leading-relaxed text-slate-500">
                        The fault detector flags which sensors are sending bad
                        data. Click a station row to see its per-sensor
                        diagnosis.
                      </p>
                    </div>
                  </aside>
                </section>

                {/* ── Charts row: network health donut + temperature bars ── */}
                {dashStations.length > 0 && (
                  <SummaryCharts
                    stations={dashStations}
                    onlineCount={counts.full}
                    offlineCount={counts.down}
                    partialCount={counts.partial}
                  />
                )}

                {/* ── Average Sensor Readings ── */}
                {dashStations.length > 0 && (
                  <div className="grid gap-5">
                    <section
                      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs cursor-pointer hover:border-sky-300 transition-colors"
                      aria-label="Sensor averages"
                      onClick={() => navigate("/dashboard/weather-data")}
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-storm/40">
                        Live sensors
                      </p>
                      <h3 className="mt-1 text-base font-semibold text-midnight font-display">
                        Average readings
                      </h3>
                      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          {
                            label: "Temperature",
                            value: sensorAvg.temperature,
                            unit: "°C",
                            color: "#F97316",
                            bg: "bg-orange-50",
                          },
                          {
                            label: "Humidity",
                            value: sensorAvg.humidity,
                            unit: "%",
                            color: "#0EA5E9",
                            bg: "bg-sky-50",
                          },
                          {
                            label: "Pressure",
                            value: sensorAvg.pressure,
                            unit: "hPa",
                            color: "#8B5CF6",
                            bg: "bg-purple-50",
                          },
                          {
                            label: "Wind Speed",
                            value: sensorAvg.windSpeed,
                            unit: "m/s",
                            color: "#22C55E",
                            bg: "bg-emerald-50",
                          },
                        ].map((card) => (
                          <div
                            key={card.label}
                            className={`rounded-xl ${card.bg} p-3.5`}
                          >
                            <p
                              className="text-[10px] font-semibold uppercase tracking-wide"
                              style={{ color: card.color }}
                            >
                              {card.label}
                            </p>
                            <p className="mt-1 text-xl font-bold text-midnight font-display">
                              {card.value !== null
                                ? card.value.toFixed(1)
                                : "—"}
                              <span className="ml-0.5 text-sm font-normal text-storm/40">
                                {card.unit}
                              </span>
                            </p>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>
                )}

                {/* ── System Feature Hub / Page Connectors ── */}
                {/* <PageConnectors /> */}

                {/* ── Recent alerts ── */}
                {alerts.length > 0 && (
                  <RecentAlertsPreview alerts={alerts.slice(0, 5)} />
                )}

                {/* ── Compact Real Google Map Preview (Bottom of Page) ── */}
                <section className="pt-2">
                  <CompactMapPreview
                    stations={dashStations.length > 0 ? dashStations : stations}
                  />
                </section>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
