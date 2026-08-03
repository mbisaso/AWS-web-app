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
  { label: "Benchmarking", href: "/benchmarking" },
  { label: "Station map", href: "/stations/map" },
  { label: "Notifications", href: "/dashboard/alerts-center" },
  { label: "SIM management", href: "/dashboard/sim-management" },
  { label: "Reports & Export", href: "/dashboard/reports" },
];

export function DashboardSidebar() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [badgeCount, setBadgeCount] = useState(0);

  /* Desktop sidebar collapse state saved in localStorage */
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem("aws_sidebar_collapsed") === "true";
  });

  useEffect(() => {
    localStorage.setItem("aws_sidebar_collapsed", String(isCollapsed));
  }, [isCollapsed]);

  useEffect(() => {
    setBadgeCount(getSimAlertCount());
    const id = setInterval(() => setBadgeCount(getSimAlertCount()), 10_000);
    return () => clearInterval(id);
  }, []);

  /* Lock body scroll when mobile drawer is open */
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="ws-sidebar-mobile-toggle lg:hidden"
        aria-label={isMobileOpen ? "Close menu" : "Open menu"}
      >
        {isMobileOpen ? (
          <CloseIcon className="h-5 w-5" />
        ) : (
          <MenuIcon className="h-5 w-5" />
        )}
        <span className="ml-2 text-xs font-semibold uppercase tracking-[0.18em]">
          {isMobileOpen ? "Close" : "Menu"}
        </span>
      </button>

      {/* ── Mobile Slide-out Drawer (ONLY mounted when isMobileOpen is true!) ── */}
      {isMobileOpen && (
        <div className="lg:hidden">
          <div
            className="ws-sidebar-mobile-overlay opacity-100"
            onClick={() => setIsMobileOpen(false)}
            aria-hidden="true"
          />
          <aside
            className="ws-sidebar fixed inset-y-0 left-0 z-50 flex w-[270px] flex-col px-5 py-6 shadow-2xl"
            aria-label="Dashboard navigation (mobile)"
          >
            <MobileSidebarContent
              setIsMobileOpen={setIsMobileOpen}
              badgeCount={badgeCount}
            />
          </aside>
        </div>
      )}

      {/* ── Desktop Sidebar (Sticky & Collapsible, ONLY sidebar on desktop) ── */}
      <aside
        className={`ws-sidebar sticky top-0 hidden h-screen shrink-0 flex-col py-5 transition-all duration-300 ease-in-out lg:flex ${
          isCollapsed ? "w-[76px] px-3" : "w-[270px] px-5"
        }`}
        aria-label="Dashboard navigation"
      >
        <DesktopSidebarContent
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
          badgeCount={badgeCount}
        />
      </aside>
    </>
  );
}

/* ── SVG Icon Map ── */
const NAV_ICONS: Record<string, React.ReactNode> = {
  "/dashboard": (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  ),
  "/dashboard/station-manager": (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  "/dashboard/weather-data": (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
    </svg>
  ),
  "/dashboard/power-data": (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  ),
  "/dashboard/weather-analysis": (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 3v18h18" />
      <path d="M7 16l4-8 4 4 4-6" />
    </svg>
  ),
  "/benchmarking": (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 17H4v-4M4 13l6-6 4 4 6-6M15 3h6v6" />
    </svg>
  ),
  "/stations/map": (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <path d="M8 2v16" />
      <path d="M16 6v16" />
    </svg>
  ),
  "/dashboard/alerts-center": (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  "/dashboard/sim-management": (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4" y="7" width="16" height="10" rx="2" />
      <path d="M4 11h16" />
    </svg>
  ),
  "/dashboard/reports": (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
      <path d="M10 9H8" />
    </svg>
  ),
};

/* ── Desktop Sidebar Content ── */
function DesktopSidebarContent({
  isCollapsed,
  onToggleCollapse,
  badgeCount,
}: {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  badgeCount?: number;
}) {
  return (
    <div className="flex h-full flex-col">
      {/* Brand Header */}
      <div
        className={`ws-sidebar-brand ${isCollapsed ? "justify-center border-b pb-4 flex-col gap-3" : "justify-between"}`}
      >
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-3.5 w-full">
            <div className="relative group ws-tooltip-trigger">
              <button
                type="button"
                onClick={onToggleCollapse}
                className="ws-sidebar-collapse-btn"
                aria-label="Expand sidebar"
              >
                <MenuIcon className="h-4 w-4" />
              </button>
              <span className="ws-sidebar-tooltip">Expand sidebar</span>
            </div>
            <div className="relative group ws-tooltip-trigger">
              <div className="ws-sidebar-brand-icon">
                <svg
                  className="h-5 w-5 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                >
                  <path d="M17.5 19.5A4.5 4.5 0 0 0 18 10.5a7 7 0 1 0-13.432 1.4A4.5 4.5 0 0 0 5.5 19.5h12z" />
                </svg>
              </div>
              <span className="ws-sidebar-tooltip">AWS Monitor</span>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 min-w-0">
              <div className="ws-sidebar-brand-icon">
                <svg
                  className="h-5 w-5 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                >
                  <path d="M17.5 19.5A4.5 4.5 0 0 0 18 10.5a7 7 0 1 0-13.432 1.4A4.5 4.5 0 0 0 5.5 19.5h12z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="ws-sidebar-brand-title">AWS Monitor</p>
                <p className="ws-sidebar-brand-subtitle">Weather Station</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onToggleCollapse}
              className="ws-sidebar-collapse-btn"
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <MenuIcon className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {/* Nav Links */}
      <NavLinks isCollapsed={isCollapsed} badgeCount={badgeCount} />

      {/* User Card */}
      <UserCard isCollapsed={isCollapsed} />
    </div>
  );
}

/* ── Centralized NavLinks ── */
function NavLinks({
  isCollapsed,
  onNavigate,
  badgeCount,
}: {
  isCollapsed?: boolean;
  onNavigate?: () => void;
  badgeCount?: number;
}) {
  const { user } = useCurrentUser();
  const isAdmin = user?.role === "admin";

  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  return (
    <nav className="ws-sidebar-nav" aria-label="Main navigation">
      {visibleItems.map((item) => {
        const isSimMgmt = item.href === "/dashboard/sim-management";
        const showBadge = isSimMgmt && (badgeCount ?? 0) > 0;
        return (
          <NavLink
            key={item.label}
            to={item.href}
            onClick={onNavigate}
            end
            className={({ isActive }) =>
              `ws-sidebar-link group ${isCollapsed ? "ws-sidebar-link-collapsed" : ""} ${
                isActive ? "ws-sidebar-link-active" : ""
              }`
            }
          >
            <span className="ws-sidebar-icon">{NAV_ICONS[item.href]}</span>
            {!isCollapsed && <span>{item.label}</span>}
            {showBadge &&
              (isCollapsed ? (
                <span className="ws-sidebar-badge-dot" />
              ) : (
                <span className="ws-sidebar-badge">
                  {badgeCount! > 9 ? "9+" : badgeCount}
                </span>
              ))}
            {isCollapsed && (
              <span className="ws-sidebar-tooltip">
                {item.label} {showBadge ? `(${badgeCount})` : ""}
              </span>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}

/* ── Centralized UserCard ── */
function UserCard({ isCollapsed }: { isCollapsed?: boolean }) {
  const { logout, email } = useAuth();
  const { user } = useCurrentUser();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/");
  }

  const initial = email ? email.charAt(0).toUpperCase() : "U";
  const roleDisplay = user?.role ? user.role.toUpperCase() : "OPERATOR";

  if (isCollapsed) {
    return (
      <div className="ws-sidebar-user-card ws-sidebar-user-card-collapsed">
        <div className="relative group ws-tooltip-trigger">
          <div className="ws-sidebar-user-avatar">{initial}</div>
          <span className="ws-sidebar-tooltip">
            {email || "User"} ({roleDisplay})
          </span>
        </div>
        <div className="relative group ws-tooltip-trigger">
          <button
            type="button"
            onClick={handleLogout}
            className="ws-sidebar-logout-btn-mini"
            aria-label="Log out"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
          <span className="ws-sidebar-tooltip">Log out</span>
        </div>
      </div>
    );
  }

  return (
    <div className="ws-sidebar-user-card">
      <div className="flex items-center gap-3">
        <div className="ws-sidebar-user-avatar">{initial}</div>
        <div className="min-w-0 flex-1">
          <p className="ws-sidebar-user-email">{email || "Operator"}</p>
          <span className="ws-sidebar-user-role">{roleDisplay}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={handleLogout}
        className="ws-sidebar-logout-btn"
      >
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
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
      <div className="ws-sidebar-brand justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="ws-sidebar-brand-icon">
            <svg
              className="h-5 w-5 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
            >
              <path d="M17.5 19.5A4.5 4.5 0 0 0 18 10.5a7 7 0 1 0-13.432 1.4A4.5 4.5 0 0 0 5.5 19.5h12z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="ws-sidebar-brand-title">Navigation</p>
            <p className="ws-sidebar-brand-subtitle">System Menu</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsMobileOpen(false)}
          className="ws-sidebar-collapse-btn"
          aria-label="Close menu"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>

      <NavLinks
        onNavigate={() => setIsMobileOpen(false)}
        badgeCount={badgeCount}
      />
      <UserCard />
    </div>
  );
}
