// ============================================================
// WMDM Desktop App — Sidebar Navigation
// ============================================================

import { useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { useDownloadStore } from "../../stores/downloadStore";

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

// --- SVG Icons (inline, no dependency) ---

function GridIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="6" height="6" rx="1" />
      <rect x="11" y="3" width="6" height="6" rx="1" />
      <rect x="3" y="11" width="6" height="6" rx="1" />
      <rect x="11" y="11" width="6" height="6" rx="1" />
    </svg>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 3v10m0 0l-3.5-3.5M10 13l3.5-3.5" />
      <path d="M3 15v1a1 1 0 001 1h12a1 1 0 001-1v-1" />
    </svg>
  );
}

function HelpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="10" cy="10" r="8" />
      <path d="M7.5 7.5a2.5 2.5 0 015 0c0 1.5-2.5 2-2.5 3.5" strokeLinecap="round" />
      <circle cx="10" cy="14" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function StoreIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 3h14l-1.5 9H4.5L3 3z" />
      <path d="M4.5 12L4 16h12l-.5-4" />
      <circle cx="8" cy="18" r="1" />
      <circle cx="14" cy="18" r="1" />
    </svg>
  );
}

function GearIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="10" cy="10" r="2.5" />
      <path d="M10 1.5l1.2 2.1a1 1 0 00.9.5h2.4l-1.2 2.1a1 1 0 000 1l1.2 2.1h-2.4a1 1 0 00-.9.5L10 11.9l-1.2-2.1a1 1 0 00-.9-.5H5.5l1.2-2.1a1 1 0 000-1L5.5 4.1h2.4a1 1 0 00.9-.5L10 1.5z" />
      <path d="M16.5 10a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
    </svg>
  );
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6.75 15.75H3.75a1.5 1.5 0 01-1.5-1.5V3.75a1.5 1.5 0 011.5-1.5h3" />
      <path d="M12 12.75L15.75 9 12 5.25" />
      <path d="M15.75 9H6.75" />
    </svg>
  );
}

const NAV_ITEMS: NavItem[] = [
  { path: "/library", label: "Library", icon: <GridIcon /> },
  { path: "/store", label: "Store", icon: <StoreIcon /> },
  { path: "/downloads", label: "Downloads", icon: <DownloadIcon /> },
  { path: "/settings", label: "Settings", icon: <GearIcon /> },
  { path: "/help", label: "Help", icon: <HelpIcon /> },
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const activeCount = useDownloadStore((s) => s.activeCount);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <aside className="flex flex-col w-[180px] min-w-[180px] h-full bg-wmdm-surface border-r border-wmdm-border">
      {/* Logo / Title */}
      <div data-tauri-drag-region className="flex items-center gap-2 px-5 pt-8 pb-6">
        <div className="flex items-center gap-2.5">
          <img
            src="/wmdm-logo.png"
            alt="WMDM"
            className="w-8 h-8 rounded-lg shrink-0"
          />
          <div>
            <h1 className="text-sm font-semibold text-wmdm-text leading-tight">
              WMDM
            </h1>
            <p className="text-[10px] text-wmdm-text-muted leading-tight">
              Desktop
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname.startsWith(item.path);
          return (
            <button
              key={item.path}
              onClick={() => {
                // Close the store webview if it's open before navigating
                if (item.path !== "/store") {
                  import("@tauri-apps/api/core").then(({ invoke }) => {
                    invoke("close_store_window").catch(() => {});
                  });
                }
                navigate(item.path);
              }}
              
              className={`
                titlebar-no-drag w-full flex items-center rounded-lg
                text-sm font-medium transition-default
                gap-3 px-3 py-2.5
                ${
                  isActive
                    ? "bg-wmdm-accent/15 text-wmdm-accent"
                    : "text-wmdm-text-muted hover:text-wmdm-text hover:bg-wmdm-bg/50"
                }
              `}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.path === "/downloads" && activeCount > 0 && (
                <span className="ml-auto bg-wmdm-accent text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {activeCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* User section */}
      {user && (
        <div className="px-3 py-4 border-t border-wmdm-border">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-wmdm-border flex items-center justify-center text-xs font-medium text-wmdm-text-muted shrink-0">
              {user.firstName?.[0] ?? user.email[0].toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-wmdm-text truncate">
                {user.firstName
                  ? `${user.firstName} ${user.lastName}`
                  : user.email}
              </p>
              <p className="text-[10px] text-wmdm-text-muted truncate">
                {user.email}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="btn-icon shrink-0"
              title="Sign out"
            >
              <LogoutIcon />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
