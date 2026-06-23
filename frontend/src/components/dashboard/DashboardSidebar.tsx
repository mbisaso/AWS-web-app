import { useState } from 'react'
import { MenuIcon, CloseIcon } from '../landing/Icons'

interface NavItem {
  label: string
  href: string
  active?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Overview', href: '/dashboard', active: true },
  { label: 'Weather data', href: '#' },
  { label: 'Power data', href: '#' },
  { label: 'Set sleep time', href: '#' },
  { label: 'Weather analysis', href: '#' },
  { label: 'Station map', href: '#' },
  { label: 'Alerts center', href: '#' },
  { label: 'Station manager', href: '#' },
]

export function DashboardSidebar() {
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  return (
    <>
      {/* ── Mobile hamburger trigger ── */}
      <button
        type="button"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="fixed top-4 left-4 z-50 flex items-center justify-center rounded-xl bg-midnight p-2.5 text-white shadow-lg lg:hidden cursor-pointer"
        aria-label={isMobileOpen ? 'Close sidebar' : 'Open sidebar'}
      >
        {isMobileOpen ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
      </button>

      {/* ── Overlay (mobile) ── */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-midnight/40 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[270px] shrink-0 flex-col bg-midnight px-5 py-6 text-white transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Dashboard navigation"
      >
        {/* Brand */}
        <div className="flex items-center gap-3 border-b border-white/10 pb-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-primary to-sky-deep text-lg font-black text-white shadow-md">
            A
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-100">
              AWS Monitor
            </p>
            <p className="text-xs text-white/40">Dashboard</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="mt-6 space-y-1" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.label}
              href={item.href}
              onClick={() => setIsMobileOpen(false)}
              className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors duration-200 cursor-pointer ${
                item.active
                  ? 'bg-white/10 text-white'
                  : 'text-white/50 hover:bg-white/5 hover:text-white/80'
              }`}
              aria-current={item.active ? 'page' : undefined}
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* User card (pushed to bottom) */}
        <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/30">Signed in as</p>
          <p className="mt-1.5 text-base font-semibold text-white">Admin</p>
          <a
            href="/"
            className="mt-3 inline-flex text-xs font-medium text-sky-200 transition-colors duration-200 hover:text-white cursor-pointer"
          >
            Log out
          </a>
        </div>
      </aside>
    </>
  )
}
