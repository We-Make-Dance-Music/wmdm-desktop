// ============================================================
// WMDM Desktop App — Mini Player (Bottom Bar)
// With waveform visualization
// ============================================================

import { useMemo } from "react";
import { open } from "@tauri-apps/plugin-shell";
import { usePlayerStore } from "../../stores/playerStore";
import { useProductStore } from "../../stores/productStore";
import { FormatBadge } from "../common/Badge";
import Waveform from "./Waveform";

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function MiniPlayer() {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const volume = usePlayerStore((s) => s.volume);
  const pause = usePlayerStore((s) => s.pause);
  const resume = usePlayerStore((s) => s.resume);
  const stop = usePlayerStore((s) => s.stop);
  const seek = usePlayerStore((s) => s.seek);
  const setVolume = usePlayerStore((s) => s.setVolume);

  // Parse waveform data if available (stored as JSON string array of floats)
  const waveformData = useMemo(() => {
    if (!currentTrack?.waveform) return [];
    try {
      const parsed = JSON.parse(currentTrack.waveform);
      if (Array.isArray(parsed)) return parsed as number[];
    } catch {
      // Invalid waveform data
    }
    return [];
  }, [currentTrack]);

  const products = useProductStore((s) => s.products);
  const isOwned = currentTrack ? products.some(p => p.id === currentTrack.id) : false;

  if (!currentTrack) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const buyUrl = `https://www.wmdm.io/catalog/product/view/id/${currentTrack.id}`;

  const handleSeek = (percent: number) => {
    seek((percent / 100) * duration);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-wmdm-surface border-t border-wmdm-border">
      <div className="flex items-center gap-3 px-4 py-2">
        {/* Play/Pause */}
        <button
          onClick={() => (isPlaying ? pause() : resume())}
          className="shrink-0 w-9 h-9 rounded-full bg-wmdm-accent hover:bg-wmdm-accent-hover
                     flex items-center justify-center transition-colors"
        >
          {isPlaying ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="white">
              <rect x="3" y="2" width="3" height="10" rx="0.5" />
              <rect x="8" y="2" width="3" height="10" rx="0.5" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="white">
              <path d="M4 2.5v9l7-4.5-7-4.5z" />
            </svg>
          )}
        </button>

        {/* Track info */}
        <div className="w-40 shrink-0 min-w-0">
          <p className="text-xs text-wmdm-text truncate font-medium">
            {currentTrack.name}
          </p>
          <div className="flex items-center gap-1.5">
            {currentTrack.creator && (
              <p className="text-[10px] text-wmdm-text-muted truncate">
                {currentTrack.creator.name}
              </p>
            )}
            <FormatBadge formatType={currentTrack.formatType} />
          </div>
        </div>

        {/* Time left */}
        <span className="text-[10px] text-wmdm-text-muted tabular-nums shrink-0 w-8 text-right">
          {formatTime(currentTime)}
        </span>

        {/* Waveform */}
        <div className="flex-1 min-w-0">
          <Waveform
            data={waveformData}
            progress={progress}
            onSeek={handleSeek}
            height={28}
            playedColor="#6366f1"
            unplayedColor="#2a2a3e"
          />
        </div>

        {/* Time right */}
        <span className="text-[10px] text-wmdm-text-muted tabular-nums shrink-0 w-8">
          {formatTime(duration)}
        </span>

        {/* Buy / Owned indicator */}
        {isOwned ? (
          <span className="text-[10px] text-wmdm-success font-medium shrink-0 px-2 py-1 bg-wmdm-success/10 rounded">
            Purchased
          </span>
        ) : (
          <button
            onClick={() => open(buyUrl)}
            className="text-[10px] bg-wmdm-accent hover:bg-wmdm-accent-hover text-white px-3 py-1 rounded font-medium transition-colors shrink-0"
          >
            Buy Now
          </button>
        )}

        {/* Volume */}
        <div className="flex items-center gap-1 shrink-0">
          <svg
            width="12"
            height="12"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-wmdm-text-muted"
          >
            <path d="M2 5.5h2l3-3v9l-3-3H2a.5.5 0 01-.5-.5V6a.5.5 0 01.5-.5z" />
            {volume > 0.3 && <path d="M9.5 4.5a3.5 3.5 0 010 5" />}
            {volume > 0.6 && <path d="M11 3a5.5 5.5 0 010 8" />}
          </svg>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-14 h-1 accent-wmdm-accent cursor-pointer"
          />
        </div>

        {/* Close */}
        <button
          onClick={stop}
          className="shrink-0 text-wmdm-text-muted hover:text-wmdm-text transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 3l8 8M11 3l-8 8" />
          </svg>
        </button>
      </div>
    </div>
  );
}
