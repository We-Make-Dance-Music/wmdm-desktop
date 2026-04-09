// ============================================================
// WMDM Desktop App — Custom Title Bar
// Gradient bar with drag region for moving the window
// ============================================================

import { useLocation } from "react-router-dom";
import { useProductStore } from "../../stores/productStore";
import { useDownloadStore } from "../../stores/downloadStore";

const PAGE_TITLES: Record<string, string> = {
  "/library": "Library",
  "/store": "Store",
  "/downloads": "Downloads",
  "/settings": "Settings",
  "/help": "Help & FAQ",
};

export default function TitleBar() {
  const location = useLocation();
  const totalCount = useProductStore((s) => s.totalCount);
  const activeCount = useDownloadStore((s) => s.activeCount);

  const title = PAGE_TITLES[location.pathname] || "WMDM";
  const subtitle =
    location.pathname === "/library" && totalCount > 0
      ? `${totalCount} products`
      : location.pathname === "/downloads" && activeCount > 0
        ? `${activeCount} active`
        : undefined;

  return (
    <div
      data-tauri-drag-region
      className="shrink-0 h-12 flex items-center px-5 relative z-50
                 bg-gradient-to-r from-wmdm-surface via-wmdm-bg to-wmdm-surface
                 border-b border-wmdm-border/50"
    >
      {/* macOS traffic lights spacing */}
      <div className="w-16 shrink-0" />

      {/* Title */}
      <div className="flex items-center gap-3 titlebar-no-drag">
        <h1 className="text-sm font-semibold text-wmdm-text">{title}</h1>
        {subtitle && (
          <span className="text-xs text-wmdm-text-muted bg-wmdm-bg/50 px-2 py-0.5 rounded-full">
            {subtitle}
          </span>
        )}
      </div>

      {/* Gradient accent line at top */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-wmdm-accent/30 to-transparent" />
    </div>
  );
}
