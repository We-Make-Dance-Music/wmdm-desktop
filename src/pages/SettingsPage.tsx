// ============================================================
// WMDM Desktop App — Settings Page
// Download path, concurrent downloads, DAW config, account
// ============================================================

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSettingsStore } from "../stores/settingsStore";
import { useAuthStore } from "../stores/authStore";
import { scanPlugins, checkPluginCompatibility } from "../api/tauri";
import type { InstalledPlugin } from "../api/tauri";

function FolderIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 4.5V12a1 1 0 001 1h10a1 1 0 001-1V6a1 1 0 00-1-1H8L6.5 3.5H3A1 1 0 002 4.5z" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className="text-wmdm-success"
    >
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M5.5 8l2 2 3-3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function XCircleIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className="text-wmdm-text-muted"
    >
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M6 6l4 4M10 6l-4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SyncIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={spinning ? "animate-spin" : ""}
    >
      <path d="M1.5 7a5.5 5.5 0 019.5-3.7" />
      <path d="M12.5 7a5.5 5.5 0 01-9.5 3.7" />
      <path d="M11 1v2.3H8.5" />
      <path d="M3 13v-2.3H5.5" />
    </svg>
  );
}

export default function SettingsPage() {
  const settings = useSettingsStore((s) => s.settings);
  const dawConfig = useSettingsStore((s) => s.dawConfig);
  const isLoading = useSettingsStore((s) => s.isLoading);
  const isDawDetecting = useSettingsStore((s) => s.isDawDetecting);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const saveSetting = useSettingsStore((s) => s.saveSetting);
  const detectDaws = useSettingsStore((s) => s.detectDaws);
  const setDawPath = useSettingsStore((s) => s.setDawPath);
  const setDownloadPath = useSettingsStore((s) => s.setDownloadPath);

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const [editingDaw, setEditingDaw] = useState<string | null>(null);
  const [dawPathInput, setDawPathInput] = useState("");

  useEffect(() => {
    loadSettings();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleDawPathSave = async (slug: string) => {
    if (dawPathInput.trim()) {
      await setDawPath(slug, dawPathInput.trim());
    }
    setEditingDaw(null);
    setDawPathInput("");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-wmdm-text-muted">
        <svg
          className="animate-spin mr-2"
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
        Loading settings...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="shrink-0 px-6 pt-4 pb-4">
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="max-w-2xl space-y-8">
          {/* --- Downloads Section --- */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-wmdm-text uppercase tracking-wider">
              Downloads
            </h2>

            {/* Download location */}
            <div className="bg-wmdm-surface rounded-lg border border-wmdm-border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-wmdm-text">
                    Download Location
                  </p>
                  <p className="text-xs text-wmdm-text-muted mt-0.5 font-mono">
                    {settings.downloadPath || "Not set"}
                  </p>
                </div>
                <button
                  onClick={setDownloadPath}
                  className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
                >
                  <FolderIcon />
                  Choose
                </button>
              </div>
            </div>

            {/* Max concurrent downloads */}
            <div className="bg-wmdm-surface rounded-lg border border-wmdm-border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-wmdm-text">
                    Max Concurrent Downloads
                  </p>
                  <p className="text-xs text-wmdm-text-muted mt-0.5">
                    Number of simultaneous downloads (1-5)
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={1}
                    max={5}
                    step={1}
                    value={settings.maxConcurrentDownloads}
                    onChange={(e) =>
                      saveSetting(
                        "maxConcurrentDownloads",
                        parseInt(e.target.value)
                      )
                    }
                    className="w-24 accent-wmdm-accent"
                  />
                  <span className="text-sm font-medium text-wmdm-text w-4 text-center">
                    {settings.maxConcurrentDownloads}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* --- DAW Configuration Section --- */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-wmdm-text uppercase tracking-wider">
                DAW Configuration
              </h2>
              <button
                onClick={detectDaws}
                disabled={isDawDetecting}
                className="btn-ghost text-xs flex items-center gap-1.5"
              >
                <SyncIcon spinning={isDawDetecting} />
                Re-detect
              </button>
            </div>

            <div className="space-y-2">
              {dawConfig.length > 0 ? (
                dawConfig.map((daw) => (
                  <div
                    key={daw.slug}
                    className="bg-wmdm-surface rounded-lg border border-wmdm-border p-4"
                  >
                    <div className="flex items-start gap-3">
                      {/* Status indicator */}
                      <div className="mt-0.5">
                        {daw.detected ? <CheckCircleIcon /> : <XCircleIcon />}
                      </div>

                      {/* DAW info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-wmdm-text">
                            {daw.name}
                          </p>
                          {daw.version && (
                            <span className="text-[10px] text-wmdm-text-muted bg-wmdm-bg rounded px-1.5 py-0.5">
                              v{daw.version}
                            </span>
                          )}
                        </div>

                        {daw.detected ? (
                          <p className="text-xs text-wmdm-text-muted mt-0.5 font-mono truncate">
                            {daw.contentPath ?? daw.installPath ?? "Detected"}
                          </p>
                        ) : (
                          <p className="text-xs text-wmdm-text-muted mt-0.5">
                            Not detected
                          </p>
                        )}

                        {/* Custom path editing */}
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={async () => {
                              const path = await import("../api/tauri").then(m => m.pickFolder());
                              if (path) {
                                await setDawPath(daw.slug, path);
                              }
                            }}
                            className="btn-secondary text-xs px-2.5 py-1.5 flex items-center gap-1.5"
                          >
                            <FolderIcon />
                            Browse
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-wmdm-surface rounded-lg border border-wmdm-border p-6 text-center text-wmdm-text-muted">
                  <p className="text-sm">No DAWs detected</p>
                  <p className="text-xs mt-1">
                    Click Re-detect to scan for installed DAWs
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* --- App Section --- */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-wmdm-text uppercase tracking-wider">
              Application
            </h2>

            {/* Auto update */}
            <div className="bg-wmdm-surface rounded-lg border border-wmdm-border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-wmdm-text">
                    Auto Update
                  </p>
                  <p className="text-xs text-wmdm-text-muted mt-0.5">
                    Automatically download and install updates
                  </p>
                </div>
                <ToggleSwitch
                  checked={settings.autoUpdate}
                  onChange={(v) => saveSetting("autoUpdate", v)}
                />
              </div>
            </div>

            {/* Notifications */}
            <div className="bg-wmdm-surface rounded-lg border border-wmdm-border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-wmdm-text">
                    Notifications
                  </p>
                  <p className="text-xs text-wmdm-text-muted mt-0.5">
                    Show notifications for completed downloads
                  </p>
                </div>
                <ToggleSwitch
                  checked={settings.notificationsEnabled}
                  onChange={(v) => saveSetting("notificationsEnabled", v)}
                />
              </div>
            </div>

            {/* Launch at startup */}
            <div className="bg-wmdm-surface rounded-lg border border-wmdm-border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-wmdm-text">
                    Launch at Startup
                  </p>
                  <p className="text-xs text-wmdm-text-muted mt-0.5">
                    Open WMDM Desktop when you log in
                  </p>
                </div>
                <ToggleSwitch
                  checked={settings.launchAtStartup}
                  onChange={(v) => saveSetting("launchAtStartup", v)}
                />
              </div>
            </div>
          </section>

          {/* --- Account Section --- */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-wmdm-text uppercase tracking-wider">
              Account
            </h2>

            <div className="bg-wmdm-surface rounded-lg border border-wmdm-border p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-wmdm-border flex items-center justify-center text-sm font-medium text-wmdm-text-muted">
                    {user?.firstName?.[0] ??
                      user?.email[0].toUpperCase() ??
                      "?"}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-wmdm-text">
                      {user?.firstName
                        ? `${user.firstName} ${user.lastName}`
                        : user?.email ?? "Unknown"}
                    </p>
                    <p className="text-xs text-wmdm-text-muted">{user?.email}</p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="btn-secondary text-xs px-3 py-1.5 text-red-400 border-red-500/20 hover:bg-red-500/10"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </section>

          {/* --- Installed Plugins Section --- */}
          <PluginsSection />

          {/* --- About Section --- */}
          <section className="space-y-4 pb-4">
            <h2 className="text-sm font-semibold text-wmdm-text uppercase tracking-wider">
              About
            </h2>

            <div className="bg-wmdm-surface rounded-lg border border-wmdm-border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-wmdm-text">
                    WMDM Desktop
                  </p>
                  <p className="text-xs text-wmdm-text-muted mt-0.5">
                    Version 1.0.0
                  </p>
                </div>
                <p className="text-[10px] text-wmdm-text-muted">
                  wemakedancemusic.com
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// --- Toggle Switch Component ---

function PluginsSection() {
  const [plugins, setPlugins] = useState<InstalledPlugin[]>([]);
  const [compatibility, setCompatibility] = useState<[string, boolean][]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);

  const handleScan = async () => {
    setScanning(true);
    try {
      const [pluginList, compat] = await Promise.all([
        scanPlugins(),
        checkPluginCompatibility(),
      ]);
      setPlugins(pluginList);
      setCompatibility(compat);
      setScanned(true);
    } catch {
      // Scan failed
    }
    setScanning(false);
  };

  const installedCount = compatibility.filter(([, has]) => has).length;
  const totalKnown = compatibility.length;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-wmdm-text uppercase tracking-wider">
          Installed Plugins
        </h2>
        <button
          onClick={handleScan}
          disabled={scanning}
          className="btn-ghost text-xs flex items-center gap-1.5"
        >
          {scanning ? (
            <>
              <svg className="animate-spin" width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
                <path d="M12 7a5 5 0 00-5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Scanning...
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="6" cy="6" r="4" />
                <path d="M9.5 9.5L13 13" />
              </svg>
              {scanned ? "Re-scan" : "Scan System"}
            </>
          )}
        </button>
      </div>

      {scanned ? (
        <div className="space-y-3">
          {/* Summary */}
          <div className="bg-wmdm-surface rounded-lg border border-wmdm-border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-wmdm-text">
                  {plugins.length} plugins found
                </p>
                <p className="text-xs text-wmdm-text-muted mt-0.5">
                  {installedCount} of {totalKnown} WMDM-compatible plugins installed
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-wmdm-accent">
                  {Math.round((installedCount / totalKnown) * 100)}%
                </p>
                <p className="text-[10px] text-wmdm-text-muted">compatibility</p>
              </div>
            </div>

            {/* Compatibility bar */}
            <div className="mt-3 h-2 bg-wmdm-bg rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-wmdm-accent to-violet-500 rounded-full transition-all"
                style={{ width: `${(installedCount / totalKnown) * 100}%` }}
              />
            </div>
          </div>

          {/* Known plugins grid */}
          <div className="bg-wmdm-surface rounded-lg border border-wmdm-border p-4">
            <p className="text-xs text-wmdm-text-muted mb-3">WMDM Template Plugins</p>
            <div className="grid grid-cols-2 gap-2">
              {compatibility.map(([name, installed]) => (
                <div key={name} className="flex items-center gap-2 text-xs">
                  {installed ? (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-wmdm-success shrink-0">
                      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M4.5 7l2 2 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-wmdm-text-muted/40 shrink-0">
                      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                  )}
                  <span className={installed ? "text-wmdm-text" : "text-wmdm-text-muted/60"}>
                    {name}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* All plugins list (collapsed) */}
          {plugins.length > 0 && (
            <details className="bg-wmdm-surface rounded-lg border border-wmdm-border">
              <summary className="px-4 py-3 text-xs text-wmdm-text-muted cursor-pointer hover:text-wmdm-text">
                View all {plugins.length} installed plugins
              </summary>
              <div className="px-4 pb-3 max-h-60 overflow-y-auto">
                <div className="space-y-1">
                  {plugins.map((p, i) => (
                    <div key={i} className="flex items-center justify-between text-[11px]">
                      <span className="text-wmdm-text truncate">{p.name}</span>
                      <span className="text-wmdm-text-muted shrink-0 ml-2">{p.format}</span>
                    </div>
                  ))}
                </div>
              </div>
            </details>
          )}
        </div>
      ) : (
        <div className="bg-wmdm-surface rounded-lg border border-wmdm-border p-6 text-center">
          <p className="text-sm text-wmdm-text-muted">
            Scan your system to see installed plugins
          </p>
          <p className="text-xs text-wmdm-text-muted mt-1">
            We'll check which plugins you have for template compatibility
          </p>
        </div>
      )}
    </section>
  );
}

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`
        relative w-10 h-5.5 rounded-full transition-default shrink-0
        ${checked ? "bg-wmdm-accent" : "bg-wmdm-border"}
      `}
      style={{ width: 40, height: 22 }}
    >
      <span
        className={`
          absolute top-0.5 left-0.5 w-[18px] h-[18px] rounded-full bg-white shadow-sm
          transition-transform duration-200
          ${checked ? "translate-x-[18px]" : "translate-x-0"}
        `}
      />
    </button>
  );
}
