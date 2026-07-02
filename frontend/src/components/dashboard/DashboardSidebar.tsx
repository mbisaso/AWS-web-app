import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { useAuth } from "../../context/AuthContext";
import { getSimAlertCount } from "../../services/api";
import { MenuIcon, CloseIcon } from "../landing/Icons";

const NAV_ITEMS: { label: string; href: string; adminOnly?: boolean }[] = [
  { label: "Dashboard", href: "/dashboard" },
  {
    label: "Station manager",
    href: "/dashboard/station-manager",
    adminOnly: true,
  },
  { label: "Weather data", href: "/dashboard/weather-data" },
  { label: "Power data", href: "/dashboard/power-data" },
  { label: "Weather analysis", href: "/dashboard/weather-analysis" },
  { label: "Station map", href: "/stations/map" },
  { label: "Notifications", href: "/dashboard/alerts-center" },
  { label: "SIM management", href: "/dashboard/sim-management" },
  { label: "Reports & Export", href: "/dashboard/reports" },
];

export function DashboardSidebar() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [badgeCount, setBadgeCount] = useState(0);

  useEffect(() => {
    setBadgeCount(getSimAlertCount())
    const id = setInterval(() => setBadgeCount(getSimAlertCount()), 10_000)
    return () => clearInterval(id)
  }, [])

  return (
    <>
      {/* ── Mobile hamburger ── */}
      <button
        type="button"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="fixed top-4 left-4 z-50 flex items-center justify-center rounded-xl bg-midnight p-2.5 text-white shadow-lg lg:hidden cursor-pointer"
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
          className="fixed inset-0 z-30 bg-midnight/40 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Mobile drawer (fixed overlay) ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[270px] translate-x-0 flex-col bg-midnight px-5 py-6 text-white shadow-2xl transition-transform duration-300 ease-in-out lg:hidden ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Dashboard navigation (mobile)"
      >
        <MobileSidebarContent setIsMobileOpen={setIsMobileOpen} badgeCount={badgeCount} />
      </aside>

      {/* ── Desktop sidebar (sticky — never scrolls) ── */}
      <aside
        className="sticky top-0 hidden h-screen w-[270px] shrink-0 flex-col bg-midnight px-5 py-6 text-white lg:flex"
        aria-label="Dashboard navigation"
      >
        <DesktopSidebarContent badgeCount={badgeCount} />
      </aside>
    </>
  );
}

/* ── Shared brand ── */
function Brand() {
  return (
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
  );
}

/* ── SVG icon map ── */
const NAV_ICONS: Record<string, React.ReactNode> = {
  "/dashboard": (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  ),
  "/dashboard/station-manager": (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  "/dashboard/weather-data": (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
    </svg>
  ),
  "/dashboard/power-data": (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  ),
  "/dashboard/weather-analysis": (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M7 16l4-8 4 4 4-6" />
    </svg>
  ),
  "/stations/map": (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <path d="M8 2v16" />
      <path d="M16 6v16" />
    </svg>
  ),
  "/dashboard/alerts-center": (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  "/dashboard/sim-management": (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="7" width="16" height="10" rx="2" />
      <path d="M4 11h16" />
    </svg>
  ),
  "/dashboard/reports": (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
      <path d="M10 9H8" />
    </svg>
  ),
}

/* ── Shared nav ── */
function NavLinks({ onNavigate, badgeCount }: { onNavigate?: () => void; badgeCount?: number }) {
  const { user } = useCurrentUser();
  const isAdmin = user?.role === "admin";

  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  return (
    <nav className="mt-6 space-y-1" aria-label="Main navigation">
      {visibleItems.map((item) => {
        const isSimMgmt = item.href === "/dashboard/sim-management"
        const showBadge = isSimMgmt && (badgeCount ?? 0) > 0
        return (
          <NavLink
            key={item.label}
            to={item.href}
            onClick={onNavigate}
            end
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors duration-200 cursor-pointer ${
                isActive
                  ? "bg-white/10 text-white"
                  : "text-white/50 hover:bg-white/5 hover:text-white/80"
              }`
            }
          >
            <span className="relative shrink-0">
              {NAV_ICONS[item.href]}
              {showBadge && (
                <span className="absolute -right-2 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose px-1 text-[9px] font-bold leading-none text-white ring-2 ring-midnight">
                  {badgeCount! > 9 ? "9+" : badgeCount}
                </span>
              )}
            </span>
            <span>{item.label}</span>
          </NavLink>
        )
      })}
    </nav>
  );
}

/* ── Shared user card ── */
function UserCard() {
  const { logout, username } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/30">
        Signed in as
      </p>
      <p className="mt-1.5 font-semibold text-base text-white">{username}</p>
      <button
        type="button"
        onClick={handleLogout}
        className="mt-3 inline-flex text-xs font-medium text-sky-200 transition-colors duration-200 hover:text-white cursor-pointer"
      >
        Log out
      </button>
    </div>
  );
}

/* ── Mobile sidebar content ── */
function MobileSidebarContent({
  setIsMobileOpen,
  badgeCount,
}: {
  setIsMobileOpen: (v: boolean) => void;
  badgeCount?: number;
}) {
  return (
    <div className="flex h-full flex-col">
      <Brand />
      <NavLinks onNavigate={() => setIsMobileOpen(false)} badgeCount={badgeCount} />
      <UserCard />
    </div>
  );
}

/* ── Desktop sidebar content ── */
function DesktopSidebarContent({ badgeCount }: { badgeCount?: number }) {
  return (
    <div className="flex h-full flex-col">
      <Brand />
      <NavLinks badgeCount={badgeCount} />
      <UserCard />
    </div>
  );
}
