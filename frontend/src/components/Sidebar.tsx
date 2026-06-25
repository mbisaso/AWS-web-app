import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { MenuIcon, CloseIcon } from "./landing/Icons";

const ROUTED_NAV = [
  { label: "Dashboard", to: "/dashboard" },
  { label: "Weather data", to: "/weather-data" },
  { label: "Power data", to: "/power-data" },
  { label: "Weather analysis", to: "/weather-analysis" },
  { label: "Station map", to: "/station-map" },
  { label: "Alerts center", to: "/alerts-center" },
];

const INERT_NAV = ["Set sleep time", "Station manager"];

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="mt-6 space-y-1 text-sm" aria-label="Main navigation">
      {ROUTED_NAV.map(({ label, to }) => (
        <NavLink
          key={label}
          to={to}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center rounded-2xl px-4 py-3 font-medium transition ${
              isActive
                ? "bg-white/10 text-white"
                : "text-slate-300 hover:bg-white/5 hover:text-white"
            }`
          }
        >
          {label}
        </NavLink>
      ))}
      {INERT_NAV.map((label) => (
        <span
          key={label}
          className="flex cursor-not-allowed select-none items-center justify-between rounded-2xl px-4 py-3 font-medium text-slate-600"
        >
          {label}
          <span className="rounded-full bg-slate-700/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Soon
          </span>
        </span>
      ))}
    </nav>
  );
}

interface SidebarProps {
  userLabel?: string;
}

export function Sidebar({ userLabel = "Admin" }: SidebarProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/");
  }

  const brand = (
    <div className="flex items-center gap-3 border-b border-white/10 pb-6">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0a6ebd] text-lg font-black text-white">
        A
      </div>
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-100">
          AWS Monitor
        </p>
        <p className="text-xs text-slate-300">Dashboard</p>
      </div>
    </div>
  );

  const userCard = (
    <div className="mt-auto rounded-3xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
        Signed in as
      </p>
      <p className="mt-2 text-lg font-semibold text-white">{userLabel}</p>
      <button
        onClick={handleLogout}
        className="mt-4 inline-flex text-sm font-medium text-sky-200 hover:text-white"
      >
        Log out
      </button>
    </div>
  );

  return (
    <>
      {/* ── Mobile hamburger ── */}
      <button
        type="button"
        onClick={() => setIsMobileOpen((o) => !o)}
        className="fixed left-4 top-4 z-50 flex items-center justify-center rounded-xl bg-[#1a2332] p-2.5 text-white shadow-lg lg:hidden"
        aria-label={isMobileOpen ? "Close sidebar" : "Open sidebar"}
      >
        {isMobileOpen ? (
          <CloseIcon className="h-5 w-5" />
        ) : (
          <MenuIcon className="h-5 w-5" />
        )}
      </button>

      {/* ── Mobile overlay ── */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-[#1a2332]/40 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Mobile drawer ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-67.5 flex-col bg-[#1a2332] px-5 py-6 text-white shadow-2xl transition-transform duration-300 ease-in-out lg:hidden ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Dashboard navigation (mobile)"
      >
        {brand}
        <NavItems onNavigate={() => setIsMobileOpen(false)} />
        {userCard}
      </aside>

      {/* ── Desktop sidebar ── */}
      <aside
        className="sticky top-0 hidden h-screen w-72.5 shrink-0 flex-col bg-[#1a2332] px-5 py-6 text-white lg:flex"
        aria-label="Dashboard navigation"
      >
        {brand}
        <NavItems />
        {userCard}
      </aside>
    </>
  );
}
