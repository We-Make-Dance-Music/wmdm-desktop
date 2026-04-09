// ============================================================
// WMDM Desktop App — Main App Component
// Router setup, auth guard, event listeners
// ============================================================

import { useEffect, useRef, useState, useCallback } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { useAuthStore } from "./stores/authStore";
import { useProductStore } from "./stores/productStore";
import { useEventListener } from "./hooks/useEventListener";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";

import AppLayout from "./components/layout/AppLayout";
import LoginPage from "./pages/LoginPage";
import LibraryPage from "./pages/LibraryPage";
import DownloadsPage from "./pages/DownloadsPage";
import SettingsPage from "./pages/SettingsPage";
import HelpPage from "./pages/HelpPage";
import StorePage from "./pages/StorePage";
import WelcomePage from "./pages/WelcomePage";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const sessionChecked = useAuthStore((s) => s.sessionChecked);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (!sessionChecked || isLoading) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-wmdm-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-wmdm-accent flex items-center justify-center shadow-lg shadow-wmdm-accent/20">
            <span className="text-white font-bold text-lg">W</span>
          </div>
          <svg
            className="animate-spin text-wmdm-accent"
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
          >
            <circle
              cx="10"
              cy="10"
              r="8"
              stroke="currentColor"
              strokeWidth="2"
              opacity="0.2"
            />
            <path
              d="M18 10a8 8 0 00-8-8"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

function SyncNotification({
  count,
  onDismiss,
}: {
  count: number;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="fixed bottom-20 right-6 z-50 animate-fade-in">
      <div className="bg-wmdm-surface border border-wmdm-accent/30 rounded-lg px-4 py-2.5 shadow-lg flex items-center gap-2">
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-wmdm-accent shrink-0"
        >
          <path d="M2 8.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-sm text-wmdm-text">
          {count} new product{count !== 1 ? "s" : ""} synced
        </span>
      </div>
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}

export default function App() {
  const checkSession = useAuthStore((s) => s.checkSession);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const sessionChecked = useAuthStore((s) => s.sessionChecked);
  const navigate = useNavigate();
  const location = useLocation();
  const [syncNotification, setSyncNotification] = useState<number | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState<{ version: string; install: () => Promise<void> } | null>(null);
  const [updateInstalling, setUpdateInstalling] = useState(false);
  const autoSyncRan = useRef(false);

  // Listen for Tauri download events
  useEventListener();

  // Keyboard shortcuts (global)
  useKeyboardShortcuts();

  // Check session on mount
  useEffect(() => {
    checkSession();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Check for app updates (10s after launch, then every 6h)
  useEffect(() => {
    const checkForUpdate = async () => {
      try {
        const update = await check();
        if (update) {
          setUpdateAvailable({
            version: update.version,
            install: async () => {
              setUpdateInstalling(true);
              await update.downloadAndInstall();
              await relaunch();
            },
          });
        }
      } catch {
        // Silent — update check is best effort
      }
    };

    const initialTimer = setTimeout(checkForUpdate, 10_000);
    const intervalTimer = setInterval(checkForUpdate, 6 * 60 * 60 * 1000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
    };
  }, []);

  // Auto-sync on launch when authenticated
  const dismissNotification = useCallback(() => setSyncNotification(null), []);

  useEffect(() => {
    if (!sessionChecked || !isAuthenticated || autoSyncRan.current) return;
    autoSyncRan.current = true;

    const { lastSync, isSyncing, products } = useProductStore.getState();

    // Skip if already syncing
    if (isSyncing) return;

    // Skip if last sync was less than 5 minutes ago
    if (lastSync) {
      const elapsed = Date.now() - new Date(lastSync).getTime();
      if (elapsed < AUTO_SYNC_INTERVAL_MS) return;
    }

    // Run delta sync silently in the background
    const previousCount = products.length;
    const syncFn = lastSync
      ? useProductStore.getState().syncDelta
      : useProductStore.getState().syncAll;

    syncFn()
      .then(() => {
        const newCount = useProductStore.getState().products.length;
        const added = newCount - previousCount;
        if (added > 0) {
          setSyncNotification(added);
        }
      })
      .catch(() => {
        // Silent failure — auto-sync is best effort
      });
  }, [sessionChecked, isAuthenticated]);

  // Redirect logged-in users away from login page
  useEffect(() => {
    if (isAuthenticated && location.pathname === "/login") {
      navigate("/library", { replace: true });
    }
  }, [isAuthenticated, location.pathname, navigate]);

  return (
    <>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/welcome" element={<WelcomePage />} />

        {/* Protected routes */}
        <Route
          element={
            <AuthGuard>
              <AppLayout />
            </AuthGuard>
          }
        >
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/store" element={<StorePage />} />
          <Route path="/downloads" element={<DownloadsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/help" element={<HelpPage />} />
        </Route>

        {/* Default redirect */}
        <Route path="*" element={<Navigate to="/library" replace />} />
      </Routes>

      {/* Auto-sync notification */}
      {syncNotification !== null && (
        <SyncNotification
          count={syncNotification}
          onDismiss={dismissNotification}
        />
      )}

      {/* Update available banner */}
      {updateAvailable && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-wmdm-accent text-white text-center py-2 px-4 text-sm flex items-center justify-center gap-3">
          <span>WMDM v{updateAvailable.version} is available</span>
          <button
            onClick={updateAvailable.install}
            disabled={updateInstalling}
            className="bg-white/20 hover:bg-white/30 px-3 py-0.5 rounded text-xs font-medium transition-colors"
          >
            {updateInstalling ? "Installing..." : "Update now"}
          </button>
          <button
            onClick={() => setUpdateAvailable(null)}
            className="text-white/60 hover:text-white transition-colors ml-2"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 2l8 8M10 2l-8 8" />
            </svg>
          </button>
        </div>
      )}
    </>
  );
}
