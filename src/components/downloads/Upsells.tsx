// ============================================================
// WMDM Desktop App — Download Upsells
// Shows related products while user waits for downloads
// ============================================================

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useProductStore } from "../../stores/productStore";
import { usePlayerStore } from "../../stores/playerStore";
import { useStoreNavStore } from "../../stores/storeNavStore";
import type { StoreProduct } from "../../types";
import { FormatBadge, DawBadge } from "../common/Badge";
import * as api from "../../api/tauri";

interface UpsellsProps {
  /** Genre from the currently downloading product */
  genre?: string;
  /** Format type from the currently downloading product */
  formatType?: string;
  /** DAW from the currently downloading product */
  daw?: string;
}

function UpsellCard({ product }: { product: StoreProduct }) {
  const [imgError, setImgError] = useState(false);
  const toggle = usePlayerStore((s) => s.toggle);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isCurrentlyPlaying = currentTrack?.id === product.id && isPlaying;
  const ownedIds = useProductStore((s) => s.products).map((p) => p.id);
  const isOwned = ownedIds.includes(product.id);
  const nav = useNavigate();
  const setPendingUrl = useStoreNavStore((s) => s.setPendingUrl);

  const handleBuy = () => {
    if (product.productUrl) {
      setPendingUrl(product.productUrl);
      nav("/store");
    }
  };

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (product.streamUrl) {
      toggle({
        id: product.id,
        name: product.name,
        sku: product.sku,
        thumbnailUrl: product.thumbnailUrl,
        streamUrl: product.streamUrl,
        formatType: product.formatType,
        daws: product.daws,
        genres: product.genres,
        bpm: product.bpm,
        key: product.key,
        creator: product.creator,
        downloadLinks: [], waveform: product.waveform ?? null,
        purchasedAt: "",
        fileSize: null,
      });
    }
  };

  return (
    <div className="flex gap-3 p-3 bg-wmdm-surface rounded-lg border border-wmdm-border hover:border-wmdm-accent/30 transition-colors group">
      {/* Thumbnail */}
      <div className="relative w-16 h-16 rounded-md overflow-hidden shrink-0 bg-wmdm-bg">
        {product.thumbnailUrl && !imgError ? (
          <img
            src={product.thumbnailUrl}
            alt=""
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-wmdm-border">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="4" width="16" height="12" rx="1" />
              <circle cx="7" cy="9" r="1.5" />
              <path d="M2 13l4-3 3 2 4-4 5 4" />
            </svg>
          </div>
        )}
        {/* Play button — always visible */}
        {product.streamUrl && (
          <button
            onClick={handlePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/50 transition-colors"
          >
            {isCurrentlyPlaying ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                <path d="M7 4v16l12-8-12-8z" />
              </svg>
            )}
          </button>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-wmdm-text truncate">{product.name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {product.creator && (
            <span className="text-[11px] text-wmdm-text-muted truncate">{product.creator.name}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <FormatBadge formatType={product.formatType} />
          {product.daws.slice(0, 2).map((d) => (
            <DawBadge key={d} daw={d} />
          ))}
        </div>
      </div>

      {/* Action */}
      <div className="flex flex-col items-end justify-between shrink-0">
        <span className="text-xs font-semibold text-wmdm-accent">
          {product.price === 0 ? "Free" : `$${product.price.toFixed(2)}`}
        </span>
        {isOwned ? (
          <span className="text-[10px] text-wmdm-success font-medium">Owned</span>
        ) : (
          <button
            onClick={handleBuy}
            className="text-[10px] bg-wmdm-accent hover:bg-wmdm-accent-hover text-white px-2.5 py-1 rounded-md font-medium transition-colors"
          >
            Buy
          </button>
        )}
      </div>
    </div>
  );
}

export default function Upsells({ genre, formatType, daw }: UpsellsProps) {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const ownedIds = new Set(useProductStore((s) => s.products).map((p) => p.id));

  useEffect(() => {
    loadRecommendations();
  }, [genre, formatType, daw]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadRecommendations = async () => {
    setIsLoading(true);
    try {
      // Fetch by genre first, then format type as fallback
      const result = await api.getStoreProducts(
        1,
        12,
        undefined,
        formatType || undefined,
        daw || undefined,
        genre || undefined,
      );

      // Filter out owned products, take top 6
      const unowned = result.items.filter((p) => !ownedIds.has(p.id)).slice(0, 6);
      setProducts(unowned);
    } catch {
      // Best effort
    }
    setIsLoading(false);
  };

  if (isLoading || products.length === 0) return null;

  return (
    <section>
      <div className="mb-3">
        <h2 className="text-sm font-medium text-wmdm-text">You might also like</h2>
        <p className="text-[11px] text-wmdm-text-muted mt-0.5">
          Based on what you're downloading
        </p>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {products.map((p) => (
          <UpsellCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
