import { useEffect, useRef, useState, type JSX } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { useAuth } from "../../context/AuthContext";
import { getSimAlertCount } from "../../services/api";
import { ArrowRightIcon, MenuIcon, CloseIcon } from "../landing/Icons";

interface NavItem {
  label: string;
  href: string;
  adminOnly?: boolean;
  icon: (props: { className?: string }) => JSX.Element;
}

const DashboardIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
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
);

const StationManagerIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
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
);

const WeatherDataIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
  </svg>
);

const PowerDataIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
);

const WeatherAnalysisIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
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
);

const BenchmarkingIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 17H4v-4M4 13l6-6 4 4 6-6M15 3h6v6" />
  </svg>
);

const StationMapIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
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
);

const AlertsIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
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
);

const SimManagementIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
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
);

const ReportsIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
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
);

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: DashboardIcon },
  {
    label: "Station manager",
    href: "/dashboard/station-manager",
    adminOnly: true,
    icon: StationManagerIcon,
  },
  {
    label: "Weather data",
    href: "/dashboard/weather-data",
    icon: WeatherDataIcon,
  },
  { label: "Power data", href: "/dashboard/power-data", icon: PowerDataIcon },
  {
    label: "Weather analysis",
    href: "/dashboard/weather-analysis",
    icon: WeatherAnalysisIcon,
  },
  { label: "Benchmarking", href: "/benchmarking", icon: BenchmarkingIcon },
  { label: "Station map", href: "/stations/map", icon: StationMapIcon },
  {
    label: "Notifications",
    href: "/dashboard/alerts-center",
    icon: AlertsIcon,
  },
  {
    label: "SIM management",
    href: "/dashboard/sim-management",
    icon: SimManagementIcon,
  },
  { label: "Reports & Export", href: "/dashboard/reports", icon: ReportsIcon },
];

const BrandMark = () => (
  <svg
    className="h-5 w-5 text-white"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
  >
    <path d="M17.5 19.5A4.5 4.5 0 0 0 18 10.5a7 7 0 1 0-13.432 1.4A4.5 4.5 0 0 0 5.5 19.5h12z" />
  </svg>
);

const LogoutIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
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
);

export function DashboardSidebar() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [badgeCount, setBadgeCount] = useState(0);
  const location = useLocation();
  const { user } = useCurrentUser();
  const { logout, email } = useAuth();
  const navigate = useNavigate();
  const mobileToggleRef = useRef<HTMLButtonElement>(null);

  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    return localStorage.getItem("aws_sidebar_collapsed") === "true";
  });

  useEffect(() => {
    localStorage.setItem("aws_sidebar_collapsed", String(isCollapsed));
  }, [isCollapsed]);

  useEffect(() => {
    let isCancelled = false;

    function refreshBadge(): void {
      Promise.resolve(getSimAlertCount())
        .then((count) => {
          if (!isCancelled) {
            setBadgeCount(count);
          }
        })
        .catch(() => {
          if (!isCancelled) {
            setBadgeCount(0);
          }
        });
    }

    refreshBadge();
    const id = setInterval(refreshBadge, 10_000);

    return () => {
      isCancelled = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isMobileOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setIsMobileOpen(false);
        mobileToggleRef.current?.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileOpen]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    if (isMobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = previousOverflow || "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileOpen]);

  const isAdmin = user?.role === "admin";
  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);
  const initial = email ? email.charAt(0).toUpperCase() : "U";
  const roleDisplay = user?.role ? user.role.toUpperCase() : "OPERATOR";

  function handleLogout(): void {
    logout();
    navigate("/");
  }

  return (
    <>
      {/* Mobile toggle — fixed z-index so the drawer/overlay can never cover it */}
      <button
        ref={mobileToggleRef}
        type="button"
        onClick={() => setIsMobileOpen((open) => !open)}
        className="ws-sidebar-mobile-toggle lg:hidden relative z-[60] pointer-events-auto"
        aria-label={isMobileOpen ? "Close sidebar" : "Open sidebar"}
        aria-expanded={isMobileOpen}
        aria-controls="dashboard-mobile-navigation"
      >
        {isMobileOpen ? (
          <CloseIcon className="h-5 w-5" />
        ) : (
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="4" width="8" height="16" rx="2" />
            <path d="M13 12h8" />
            <path d="M17 8l4 4-4 4" />
          </svg>
        )}
      </button>

      {/* Mobile drawer — stays mounted so it can animate in/out */}
      <div
        className={`lg:hidden fixed inset-0 z-40 transition-opacity duration-300 ${
          isMobileOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!isMobileOpen}
      >
        <div
          className="ws-sidebar-mobile-overlay absolute inset-0"
          onClick={() => setIsMobileOpen(false)}
        />
        <aside
          className={`ws-sidebar fixed inset-y-0 left-0 z-50 flex w-[270px] flex-col px-5 py-6 shadow-2xl transition-transform duration-300 ease-in-out ${
            isMobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          id="dashboard-mobile-navigation"
          role="dialog"
          aria-modal="true"
          aria-label="Dashboard navigation"
        >
          <div className="flex h-full flex-col">
            <div className="ws-sidebar-brand justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="ws-sidebar-brand-icon">
                  <BrandMark />
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
              items={visibleItems}
              onNavigate={() => setIsMobileOpen(false)}
              badgeCount={badgeCount}
            />

            <UserCard
              initial={initial}
              email={email}
              roleDisplay={roleDisplay}
              onLogout={handleLogout}
            />
          </div>
        </aside>
      </div>

      {/* Desktop sidebar */}
      <aside
        className={`ws-sidebar sticky top-0 hidden h-screen shrink-0 flex-col py-5 transition-all duration-300 ease-in-out lg:flex ${
          isCollapsed ? "w-[76px] px-3" : "w-[270px] px-5"
        }`}
        aria-label="Dashboard navigation"
      >
        <div className="flex h-full flex-col">
          <div
            className={`ws-sidebar-brand ${isCollapsed ? "justify-center border-b pb-4 flex-col gap-3" : "justify-between"}`}
          >
            {isCollapsed ? (
              <div className="flex flex-col items-center gap-3.5 w-full">
                <div className="relative group ws-tooltip-trigger">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsCollapsed((prev) => !prev);
                    }}
                    className="ws-sidebar-collapse-btn relative z-10"
                    aria-label="Expand sidebar"
                  >
                    <ArrowRightIcon className="h-4 w-4" />
                  </button>
                  <span className="ws-sidebar-tooltip pointer-events-none">
                    Expand sidebar
                  </span>
                </div>
                <div className="ws-sidebar-brand-icon" aria-hidden="true">
                  <BrandMark />
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="ws-sidebar-brand-icon">
                    <BrandMark />
                  </div>
                  <div className="min-w-0">
                    <p className="ws-sidebar-brand-title">AWS Monitor</p>
                    <p className="ws-sidebar-brand-subtitle">Weather Station</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCollapsed((prev) => !prev)}
                  className="ws-sidebar-collapse-btn"
                  title="Collapse sidebar"
                  aria-label="Collapse sidebar"
                >
                  <MenuIcon className="h-4 w-4" />
                </button>
              </>
            )}
          </div>

          <NavLinks
            items={visibleItems}
            isCollapsed={isCollapsed}
            badgeCount={badgeCount}
          />

          {isCollapsed ? (
            <div className="ws-sidebar-user-card ws-sidebar-user-card-collapsed">
              <div className="relative group ws-tooltip-trigger">
                <div className="ws-sidebar-user-avatar">{initial}</div>
                <span className="ws-sidebar-tooltip pointer-events-none">
                  {email || "User"} ({roleDisplay})
                </span>
              </div>
              <div className="relative group ws-tooltip-trigger">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="ws-sidebar-logout-btn-mini relative z-10"
                  aria-label="Log out"
                >
                  <LogoutIcon className="h-4 w-4" />
                </button>
                <span className="ws-sidebar-tooltip pointer-events-none">
                  Log out
                </span>
              </div>
            </div>
          ) : (
            <UserCard
              initial={initial}
              email={email}
              roleDisplay={roleDisplay}
              onLogout={handleLogout}
            />
          )}
        </div>
      </aside>
    </>
  );
}

interface NavLinksProps {
  items: NavItem[];
  isCollapsed?: boolean;
  onNavigate?: () => void;
  badgeCount?: number;
}

function NavLinks({
  items,
  isCollapsed,
  onNavigate,
  badgeCount,
}: NavLinksProps) {
  return (
    <nav className="ws-sidebar-nav" aria-label="Main navigation">
      {items.map((item) => {
        const isSimMgmt = item.href === "/dashboard/sim-management";
        const showBadge = isSimMgmt && (badgeCount ?? 0) > 0;
        const Icon = item.icon;
        return (
          <NavLink
            key={item.href}
            to={item.href}
            onClick={onNavigate}
            end
            className={({ isActive }) =>
              `ws-sidebar-link group ${isCollapsed ? "ws-sidebar-link-collapsed" : ""} ${
                isActive ? "ws-sidebar-link-active" : ""
              }`
            }
          >
            <span className="ws-sidebar-icon">
              <Icon className="h-5 w-5" />
            </span>
            {!isCollapsed && <span>{item.label}</span>}
            {showBadge &&
              (isCollapsed ? (
                <span className="ws-sidebar-badge-dot" />
              ) : (
                <span className="ws-sidebar-badge">
                  {(badgeCount ?? 0) > 9 ? "9+" : badgeCount}
                </span>
              ))}
            {isCollapsed && (
              <span className="ws-sidebar-tooltip pointer-events-none">
                {item.label} {showBadge ? `(${badgeCount})` : ""}
              </span>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}

interface UserCardProps {
  initial: string;
  email: string | null | undefined;
  roleDisplay: string;
  onLogout: () => void;
}

function UserCard({ initial, email, roleDisplay, onLogout }: UserCardProps) {
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
        onClick={onLogout}
        className="ws-sidebar-logout-btn"
      >
        <LogoutIcon className="h-3.5 w-3.5" />
        Log out
      </button>
    </div>
  );
}
