import { useNavigate } from 'react-router-dom'
import { ArrowRightIcon } from '../landing/Icons'

export interface PageConnectorItem {
  id: string
  title: string
  category: string
  description: string
  href: string
  badgeText: string
  badgeTone: 'emerald' | 'amber' | 'sky' | 'purple' | 'rose' | 'indigo' | 'cyan'
  iconBg: string
  iconColor: string
  icon: React.ReactNode
}

const BADGE_STYLES: Record<string, string> = {
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
  amber: 'bg-amber-50 text-amber-700 border-amber-200/80',
  sky: 'bg-sky-50 text-sky-700 border-sky-200/80',
  purple: 'bg-purple-50 text-purple-700 border-purple-200/80',
  rose: 'bg-rose-50 text-rose-700 border-rose-200/80',
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
  cyan: 'bg-cyan-50 text-cyan-700 border-cyan-200/80',
}

const PAGE_CONNECTORS: PageConnectorItem[] = [
  {
    id: 'station-manager',
    title: 'Station Manager',
    category: 'Network Operations',
    description: 'Register, edit metadata, coordinates & sampling intervals for all AWS units.',
    href: '/dashboard/station-manager',
    badgeText: 'Station Admin',
    badgeTone: 'sky',
    iconBg: 'bg-blue-50/80 border-blue-100',
    iconColor: 'text-[var(--color-sky-deep)]',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
  },
  {
    id: 'weather-data',
    title: 'Weather Data Stream',
    category: 'Live Telemetry',
    description: 'Inspect real-time and historical temperature, humidity, pressure & rainfall logs.',
    href: '/dashboard/weather-data',
    badgeText: 'Live Stream',
    badgeTone: 'emerald',
    iconBg: 'bg-emerald-50/80 border-emerald-100',
    iconColor: 'text-emerald-600',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
      </svg>
    ),
  },
  {
    id: 'power-data',
    title: 'Power & Solar Health',
    category: 'Diagnostics',
    description: 'Monitor battery charge levels, solar current input & power rail stability.',
    href: '/dashboard/power-data',
    badgeText: 'Battery & Solar',
    badgeTone: 'amber',
    iconBg: 'bg-amber-50/80 border-amber-100',
    iconColor: 'text-amber-600',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
  },
  {
    id: 'weather-analysis',
    title: 'Weather Analytics',
    category: 'Data Science',
    description: 'Perform diurnal trend analysis, multi-station comparisons & anomaly checks.',
    href: '/dashboard/weather-analysis',
    badgeText: 'Trends & Insights',
    badgeTone: 'purple',
    iconBg: 'bg-purple-50/80 border-purple-100',
    iconColor: 'text-purple-600',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 3v18h18" />
        <path d="M7 16l4-8 4 4 4-6" />
      </svg>
    ),
  },
  {
    id: 'benchmarking',
    title: 'UNMA Benchmarking',
    category: 'Validation',
    description: 'Compare AWS sensor observations against UNMA official reference datasets.',
    href: '/benchmarking',
    badgeText: 'Sensor Accuracy',
    badgeTone: 'indigo',
    iconBg: 'bg-indigo-50/80 border-indigo-100',
    iconColor: 'text-indigo-600',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M9 17H4v-4M4 13l6-6 4 4 6-6M15 3h6v6" />
      </svg>
    ),
  },
  {
    id: 'station-map',
    title: 'Geographic Station Map',
    category: 'Spatial View',
    description: 'Full-screen interactive Google Map with station markers & spatial filtering.',
    href: '/stations/map',
    badgeText: 'Spatial Map',
    badgeTone: 'cyan',
    iconBg: 'bg-cyan-50/80 border-cyan-100',
    iconColor: 'text-cyan-600',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
        <path d="M8 2v16" />
        <path d="M16 6v16" />
      </svg>
    ),
  },
  {
    id: 'alerts-center',
    title: 'Notifications & Alerts',
    category: 'System Health',
    description: 'View active alerts for offline stations, sensor drift & battery failures.',
    href: '/dashboard/alerts-center',
    badgeText: 'Alert Center',
    badgeTone: 'rose',
    iconBg: 'bg-rose-50/80 border-rose-100',
    iconColor: 'text-rose-600',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
  {
    id: 'sim-management',
    title: 'SIM Management',
    category: 'Telecom & IoT',
    description: 'Track cellular SIM data balances, expiry dates & telecom carrier statuses.',
    href: '/dashboard/sim-management',
    badgeText: 'Cellular Data',
    badgeTone: 'sky',
    iconBg: 'bg-sky-50/80 border-sky-100',
    iconColor: 'text-sky-600',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="4" y="7" width="16" height="10" rx="2" />
        <path d="M4 11h16" />
      </svg>
    ),
  },
  {
    id: 'reports',
    title: 'Reports & Export',
    category: 'Reporting',
    description: 'Generate standardized climate reports & export raw data in CSV or PDF formats.',
    href: '/dashboard/reports',
    badgeText: 'CSV / PDF Export',
    badgeTone: 'emerald',
    iconBg: 'bg-emerald-50/80 border-emerald-100',
    iconColor: 'text-emerald-700',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <path d="M16 13H8" />
        <path d="M16 17H8" />
      </svg>
    ),
  },
]

export function PageConnectors() {
  const navigate = useNavigate()

  return (
    <section className="space-y-4" aria-label="Quick Application Modules Hub">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-sky-deep)]">
            Quick Access Modules
          </p>
          <h2 className="mt-1 text-xl font-semibold text-[var(--text-primary)] font-display">
            System Feature Hub
          </h2>
        </div>
        <p className="text-xs text-slate-400">
          Direct shortcuts to all system pages & analytical tools
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {PAGE_CONNECTORS.map((item) => (
          <article
            key={item.id}
            onClick={() => navigate(item.href)}
            tabIndex={0}
            role="button"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                navigate(item.href)
              }
            }}
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4.5 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-slate-300 hover:shadow-elevation-2 cursor-pointer"
          >
            {/* Top row: Icon & Category badge */}
            <div>
              <div className="flex items-center justify-between gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${item.iconBg} ${item.iconColor} transition-transform duration-200 group-hover:scale-105`}
                >
                  {item.icon}
                </div>

                <span
                  className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wide ${
                    BADGE_STYLES[item.badgeTone]
                  }`}
                >
                  {item.badgeText}
                </span>
              </div>

              {/* Title & Description */}
              <h3 className="mt-3 text-base font-semibold text-[var(--text-primary)] font-display transition-colors group-hover:text-[var(--color-sky-deep)]">
                {item.title}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 line-clamp-2">
                {item.description}
              </p>
            </div>

            {/* Bottom action link */}
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-semibold text-[var(--color-sky-deep)]">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                {item.category}
              </span>
              <span className="inline-flex items-center gap-1 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-[var(--color-sky-night)]">
                Open Page
                <ArrowRightIcon className="h-3.5 w-3.5" />
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
