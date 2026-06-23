import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const COMING_SOON_ITEMS = ['Weather data', 'Power data', 'Set sleep time', 'Weather analysis']

interface SidebarProps {
  userLabel?: string
}

export function Sidebar({ userLabel = 'Admin' }: SidebarProps) {
  const { logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/')
  }

  return (
    <aside className="hidden w-[290px] shrink-0 border-r border-slate-200 bg-[#1a2332] px-5 py-6 text-white lg:flex lg:flex-col">
      <div className="flex items-center gap-3 border-b border-white/10 pb-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0a6ebd] text-lg font-black text-white">A</div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-100">AWS Monitor</p>
          <p className="text-xs text-slate-300">Dashboard</p>
        </div>
      </div>

      <nav className="mt-6 space-y-2 text-sm">
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-2xl px-4 py-3 font-medium transition ${
              isActive ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
            }`
          }
        >
          <span>Dashboard</span>
        </NavLink>
        {COMING_SOON_ITEMS.map((label) => (
          <a
            key={label}
            className="flex items-center gap-3 rounded-2xl px-4 py-3 text-slate-300 transition hover:bg-white/5 hover:text-white"
            href="#"
          >
            <span>{label}</span>
          </a>
        ))}
      </nav>

      <div className="mt-auto rounded-3xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Signed in as</p>
        <p className="mt-2 text-lg font-semibold text-white">{userLabel}</p>
        <button
          onClick={handleLogout}
          className="mt-4 inline-flex text-sm font-medium text-sky-200 hover:text-white"
        >
          Log out
        </button>
      </div>
    </aside>
  )
}