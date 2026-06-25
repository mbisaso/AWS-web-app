import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { useAuth } from "../../context/AuthContext";
import { MenuIcon, CloseIcon } from "../landing/Icons";

const NAV_ITEMS: { label: string; href: string; adminOnly?: boolean }[] = [
  { label: "Overview", href: "/dashboard" },
  { label: "Weather data", href: "/dashboard/weather-data" },
  { label: "Power data", href: "/dashboard/power-data" },
  { label: "Weather analysis", href: "/dashboard/weather-analysis" },
  { label: "Station map", href: "/stations/map" },
  { label: "Alerts center", href: "/dashboard/alerts-center" },
  { label: "SIM management", href: "/dashboard/sim-management" },
  { label: "Reports & Export", href: "/dashboard/reports" },
  {
    label: "Station manager",
    href: "/dashboard/station-manager",
    adminOnly: true,
  },
];

export function DashboardSidebar() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

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
        <MobileSidebarContent setIsMobileOpen={setIsMobileOpen} />
      </aside>

      {/* ── Desktop sidebar (sticky — never scrolls) ── */}
      <aside
        className="sticky top-0 hidden h-screen w-[270px] shrink-0 flex-col bg-midnight px-5 py-6 text-white lg:flex"
        aria-label="Dashboard navigation"
      >
        <DesktopSidebarContent />
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

/* ── Shared nav ── */
function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useCurrentUser();
  const isAdmin = user?.role === "admin";

  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  return (
    <nav className="mt-6 space-y-1" aria-label="Main navigation">
      {visibleItems.map((item) => (
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
          {item.label}
        </NavLink>
      ))}
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
}: {
  setIsMobileOpen: (v: boolean) => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <Brand />
      <NavLinks onNavigate={() => setIsMobileOpen(false)} />
      <UserCard />
    </div>
  );
}

/* ── Desktop sidebar content ── */
function DesktopSidebarContent() {
  return (
    <div className="flex h-full flex-col">
      <Brand />
      <NavLinks />
      <UserCard />
    </div>
  );
}
