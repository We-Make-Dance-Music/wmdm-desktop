// ============================================================
// WMDM Desktop App — Product Card
// Grid card for the product library
// ============================================================

import { useState } from "react";
import type { Product } from "../../types";
import { DawBadge } from "../common/Badge";
import { useProductStore } from "../../stores/productStore";
import { usePlayerStore } from "../../stores/playerStore";

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

  return (
    <button
      onClick={() => onClick(product)}
      className="group w-full text-left bg-wmdm-surface rounded-xl border border-wmdm-border
                 hover:border-wmdm-accent/40 hover:bg-wmdm-surface/80
                 transition-default overflow-hidden focus-ring"
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
      </div>
    </button>
  );
}
