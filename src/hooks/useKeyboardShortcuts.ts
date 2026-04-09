// ============================================================
// WMDM Desktop App — Keyboard Shortcuts Hook
// Space: play/pause, Left/Right: seek, Escape: close detail,
// Cmd+F / Ctrl+F: focus search
// ============================================================

import { useEffect } from "react";
import { usePlayerStore } from "../stores/playerStore";
import { useProductStore } from "../stores/productStore";

const SEEK_SECONDS = 5;

function isTypingInInput(e: KeyboardEvent): boolean {
  const tag = (e.target as HTMLElement)?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if ((e.target as HTMLElement)?.isContentEditable) return true;
  return false;
}

export function useKeyboardShortcuts() {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Cmd+F / Ctrl+F: focus search bar (always, even when typing)
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>(
          "[data-search-input]"
        );
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
        return;
      }

      // Don't fire shortcuts when typing in input fields
      if (isTypingInInput(e)) return;

      const playerState = usePlayerStore.getState();
      const productState = useProductStore.getState();

      switch (e.key) {
        case " ": {
          // Space: play/pause current track
          e.preventDefault();
          if (playerState.currentTrack) {
            if (playerState.isPlaying) {
              playerState.pause();
            } else {
              playerState.resume();
            }
          }
          break;
        }
        case "ArrowLeft": {
          // Left arrow: seek backward 5 seconds
          if (playerState.currentTrack && playerState.audio) {
            e.preventDefault();
            const newTime = Math.max(0, playerState.currentTime - SEEK_SECONDS);
            playerState.seek(newTime);
          }
          break;
        }
        case "ArrowRight": {
          // Right arrow: seek forward 5 seconds
          if (playerState.currentTrack && playerState.audio) {
            e.preventDefault();
            const newTime = Math.min(
              playerState.duration,
              playerState.currentTime + SEEK_SECONDS
            );
            playerState.seek(newTime);
          }
          break;
        }
        case "Escape": {
          // Escape: close product detail panel
          if (productState.selectedProduct) {
            productState.setSelectedProduct(null);
          }
          break;
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
