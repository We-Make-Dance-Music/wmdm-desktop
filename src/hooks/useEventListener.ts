// ============================================================
// WMDM Desktop App — Tauri Event Listener Hook
// Listens for download-progress, download-complete, download-error
// and updates the download store in real-time.
// ============================================================

import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import type {
  DownloadProgressEvent,
  DownloadCompleteEvent,
  DownloadErrorEvent,
} from "../types";
import { useDownloadStore } from "../stores/downloadStore";

export function useEventListener(): void {
  const handleProgress = useDownloadStore((s) => s.handleProgress);
  const handleComplete = useDownloadStore((s) => s.handleComplete);
  const handleError = useDownloadStore((s) => s.handleError);

  useEffect(() => {
    const unlisteners: Array<() => void> = [];

    async function setup() {
      const unlisten1 = await listen<DownloadProgressEvent>(
        "download-progress",
        (event) => {
          handleProgress(event.payload);
        }
      );
      unlisteners.push(unlisten1);

      const unlisten2 = await listen<DownloadCompleteEvent>(
        "download-complete",
        (event) => {
          handleComplete(event.payload);
        }
      );
      unlisteners.push(unlisten2);

      const unlisten3 = await listen<DownloadErrorEvent>(
        "download-error",
        (event) => {
          handleError(event.payload);
        }
      );
      unlisteners.push(unlisten3);
    }

    setup();

    return () => {
      for (const unlisten of unlisteners) {
        unlisten();
      }
    };
  }, [handleProgress, handleComplete, handleError]);
}
