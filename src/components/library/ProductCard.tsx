// ============================================================
// WMDM Desktop App — Product Card
// Grid card for the product library
// ============================================================

import { useState } from "react";
import type { Product } from "../../types";
import { DownloadStatus } from "../../types";
import { DawBadge } from "../common/Badge";
import { useProductStore } from "../../stores/productStore";
import { usePlayerStore } from "../../stores/playerStore";
import { useDownloadStore } from "../../stores/downloadStore";
import { revealInFinder } from "../../api/tauri";

interface ProductCardProps {
  product: Product;
  onClick: (product: Product) => void;
}

export default function ProductCard({ product, onClick }: ProductCardProps) {
  const [imgError, setImgError] = useState(false);
  const downloadedIds = useProductStore((s) => s.downloadedIds);
  const favoriteIds = useProductStore((s) => s.favoriteIds);
  const toggleFavorite = useProductStore((s) => s.toggleFavorite);
  const isDownloaded = downloadedIds.has(product.id);
  const isFavorite = favoriteIds.has(product.id);
  const toggle = usePlayerStore((s) => s.toggle);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isCurrentlyPlaying = currentTrack?.id === product.id && isPlaying;
  const hasPreview = !!product.streamUrl;

  // Download state
  const startDownload = useDownloadStore((s) => s.startDownload);
  const queue = useDownloadStore((s) => s.queue);
  const history = useDownloadStore((s) => s.history);
  const firstLink = product.downloadLinks?.[0];
  const activeDownload = firstLink
    ? queue.find((i) => i.productId === product.id && i.linkHash === firstLink.hash)
    : undefined;
  const completedDownload = firstLink
    ? history.find(
        (i) =>
          i.productId === product.id &&
          i.linkHash === firstLink.hash &&
          i.status === DownloadStatus.Complete
      )
    : undefined;
  const isDownloading =
    activeDownload &&
    activeDownload.status !== DownloadStatus.Complete &&
    activeDownload.status !== DownloadStatus.Error;
  const [downloadStarting, setDownloadStarting] = useState(false);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!firstLink || isDownloading || downloadStarting) return;
    setDownloadStarting(true);
    try {
      await startDownload(product, firstLink.hash);
    } catch {
      // Error surfaces in download queue
    }
    setDownloadStarting(false);
  };

  const handleReveal = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (completedDownload?.outputPath) {
      await revealInFinder(completedDownload.outputPath);
    }
  };

  return (
    <div
      onClick={() => onClick(product)}
      className="group w-full text-left bg-wmdm-surface rounded-xl border border-wmdm-border
                 hover:border-wmdm-accent/40 hover:bg-wmdm-surface/80
                 transition-default overflow-hidden focus-ring cursor-pointer"
    >
      {/* Thumbnail */}
      <div className="relative aspect-[4/3] bg-wmdm-bg overflow-hidden">
        {product.thumbnailUrl && !imgError ? (
          <img
            src={product.thumbnailUrl}
            alt={product.name}
            loading="lazy"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg
              width="40"
              height="40"
              viewBox="0 0 40 40"
              fill="none"
              className="text-wmdm-border"
            >
              <rect
                x="4"
                y="8"
                width="32"
                height="24"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <circle cx="14" cy="18" r="3" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="M4 26l8-6 6 4 8-8 10 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}

        {/* Welcome gift ribbon */}
        {product.isWelcomeGift && (
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md shadow-lg">
            <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor">
              <path d="M6 1l1.5 3L11 4.5l-2.5 2.5L9 10.5 6 9l-3 1.5.5-3.5L1 4.5l3.5-.5L6 1z"/>
            </svg>
            Free Gift
          </div>
        )}

        {/* Status indicators */}
        <div className="absolute top-2 right-2 flex items-center gap-1">
          {isDownloaded && (
            <div className="bg-wmdm-success/90 text-white rounded-full p-1" title="Downloaded">
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 6.5L5 9l4.5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(product.id);
            }}
            className={`rounded-full p-1 transition-all ${
              isFavorite
                ? "bg-amber-500/90 text-white"
                : "bg-black/40 text-white/60 opacity-0 group-hover:opacity-100"
            }`}
            title={isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5">
              <path d="M6 1.5l1.5 3 3.5.5-2.5 2.5.5 3.5L6 9.5 3 11l.5-3.5L1 5l3.5-.5z" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* Play button overlay — always visible */}
        {hasPreview && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggle(product);
            }}
            className="absolute bottom-3 right-3 w-14 h-14 rounded-full bg-black/50 hover:bg-wmdm-accent
                       flex items-center justify-center transition-colors
                       backdrop-blur-sm shadow-lg"
          >
            {isCurrentlyPlaying ? (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="white">
                <rect x="4" y="3" width="4" height="14" rx="1" />
                <rect x="12" y="3" width="4" height="14" rx="1" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="white">
                <path d="M5 2.5v15l12-7.5-12-7.5z" />
              </svg>
            )}
          </button>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-2">
        {/* Name */}
        <h3 className="text-sm font-medium text-wmdm-text leading-tight line-clamp-2 min-h-[2.5rem]">
          {product.name}
        </h3>

        {/* Creator */}
        {product.creator && (
          <p className="text-xs text-wmdm-text-muted truncate">
            {product.creator.name}
          </p>
        )}

        {/* DAW badges */}
        {product.daws.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {product.daws.map((daw) => (
              <DawBadge key={daw} daw={daw} />
            ))}
          </div>
        )}

        {/* BPM + Key */}
        {(product.bpm || product.key) && (
          <div className="flex items-center gap-2 text-[11px] text-wmdm-text-muted">
            {product.bpm && <span>{product.bpm} BPM</span>}
            {product.bpm && product.key && (
              <span className="w-0.5 h-0.5 rounded-full bg-wmdm-text-muted" />
            )}
            {product.key && <span>{product.key}</span>}
          </div>
        )}

        {/* Download button */}
        {firstLink && (
          <div className="pt-2">
            {completedDownload ? (
              <button
                onClick={handleReveal}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-wmdm-success/10 text-wmdm-success hover:bg-wmdm-success/20 text-xs font-medium transition-colors"
              >
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6.5l3 3 5-6" />
                </svg>
                Show in Finder
              </button>
            ) : isDownloading ? (
              <div className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-wmdm-accent/10 text-wmdm-accent text-xs font-medium">
                <svg className="animate-spin" width="13" height="13" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
                  <path d="M12 7a5 5 0 00-5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                {Math.round(activeDownload?.progress ?? 0)}%
              </div>
            ) : (
              <button
                onClick={handleDownload}
                disabled={downloadStarting}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-wmdm-accent hover:bg-wmdm-accent-hover text-white text-xs font-semibold transition-colors shadow-sm disabled:opacity-50"
              >
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 2v7m0 0l-3-3m3 3l3-3" />
                  <path d="M2 11v1a1 1 0 001 1h8a1 1 0 001-1v-1" />
                </svg>
                Download
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
