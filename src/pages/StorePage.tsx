// ============================================================
// WMDM Desktop App — Store Page (Embedded Webview)
// Loads wmdm.io inside the main window next to the sidebar
// ============================================================

import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { usePlayerStore } from "../stores/playerStore";

// TODO: Switch to https://www.wmdm.io for production
const STORE_URL = "https://www.wmdm.io";

export default function StorePage() {
  const stop = usePlayerStore((s) => s.stop);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Stop the app player (website has its own)
    stop();

    // Open the embedded store webview
    invoke("open_store_window", { url: STORE_URL })
      .catch((err) => {
        console.error("[WMDM] Store webview error:", err);
        setError(String(err));
      });

    // Handle ALL window size changes — resize, maximize, fullscreen
    const handleResize = () => {
      invoke("resize_store_window").catch(() => {});
    };

    // Listen to multiple events that can change window size
    const appWindow = getCurrentWindow();
    const unlistenResize = appWindow.onResized(handleResize);
    const unlistenMove = appWindow.onMoved(handleResize);

    // Also poll for size changes (catches fullscreen, maximize)
    const resizeInterval = setInterval(handleResize, 500);

    return () => {
      // Close the embedded webview when leaving the store tab
      invoke("close_store_window").catch(() => {});
      clearInterval(resizeInterval);
      unlistenResize.then((fn) => fn());
      unlistenMove.then((fn) => fn());
    };
  }, [stop]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <p className="text-sm text-wmdm-error mb-2">Failed to load store</p>
        <p className="text-xs text-wmdm-text-muted mb-4 max-w-sm">{error}</p>
        <button
          onClick={() => {
            setError(null);
            invoke("open_store_window", { url: STORE_URL }).catch((err) => setError(String(err)));
          }}
          className="btn-primary text-sm px-4 py-2"
        >
          Retry
        </button>
      </div>
    );
  }

  // The webview overlays this area — this div is just a placeholder/background
  return <div className="flex-1 bg-wmdm-bg" />;
}
