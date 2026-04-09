// ============================================================
// WMDM Desktop App — Store Product Detail Panel (Slide-over)
// Upsell-focused detail view for store products
// ============================================================

import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { StoreProduct } from "../../types";
import { FormatBadge, DawBadge } from "../common/Badge";
import { usePlayerStore } from "../../stores/playerStore";
import { useProductStore } from "../../stores/productStore";
import { getStoreProducts } from "../../api/tauri";
import CheckoutModal from "./CheckoutModal";

/** Navigate the embedded store webview to a product URL */
async function navigateStore(url: string) {
  await invoke("close_store_window");
  await invoke("open_store_window", { url });
}

function RelatedProductRow({ product, isOwned }: { product: StoreProduct; isOwned: boolean }) {
  const playerToggle = usePlayerStore((s) => s.toggle);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isCurrentlyPlaying = currentTrack?.id === product.id && isPlaying;

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (product.streamUrl) {
      playerToggle({
        id: product.id, name: product.name, sku: product.sku,
        thumbnailUrl: product.thumbnailUrl, streamUrl: product.streamUrl,
        waveform: product.waveform ?? null, formatType: product.formatType,
        daws: product.daws, genres: product.genres, bpm: product.bpm,
        key: product.key, creator: product.creator,
        downloadLinks: [], purchasedAt: "", fileSize: null,
      });
    }
  };

  return (
    <div className="flex items-center gap-3 p-2 bg-wmdm-bg rounded-lg border border-wmdm-border group">
      {/* Thumbnail + play */}
      <div className="relative w-10 h-10 rounded bg-wmdm-border overflow-hidden shrink-0">
        {product.thumbnailUrl && (
          <img src={product.thumbnailUrl} alt="" className="w-full h-full object-cover" />
        )}
        {product.streamUrl && (
          <button
            onClick={handlePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/50 transition-colors"
          >
            {isCurrentlyPlaying ? (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="white">
                <rect x="4" y="3" width="3.5" height="12" rx="0.5" />
                <rect x="10.5" y="3" width="3.5" height="12" rx="0.5" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="white">
                <path d="M5 2v14l10-7-10-7z" />
              </svg>
            )}
          </button>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-wmdm-text truncate">{product.name}</p>
        <p className="text-[10px] text-wmdm-text-muted">{product.creator?.name}</p>
        <div className="flex items-center gap-1 mt-0.5">
          <FormatBadge formatType={product.formatType} />
          {product.daws.slice(0, 1).map((d) => (
            <DawBadge key={d} daw={d} />
          ))}
          {product.bpm && (
            <span className="text-[9px] text-wmdm-text-muted">{product.bpm} BPM</span>
          )}
        </div>
      </div>

      {/* Action */}
      {isOwned ? (
        <span className="text-[9px] text-wmdm-success font-medium shrink-0">Owned</span>
      ) : (
        <button
          onClick={() => product.productUrl && navigateStore(product.productUrl)}
          className="text-[9px] bg-wmdm-accent/80 hover:bg-wmdm-accent text-white px-2.5 py-1 rounded font-medium shrink-0 transition-colors"
        >
          {product.price === 0 ? "Free" : `$${product.price.toFixed(2)}`}
        </button>
      )}
    </div>
  );
}

function DescriptionBlock({ html }: { html: string }) {
  const [expanded, setExpanded] = useState(false);

  // Strip HTML tags for the preview text
  const plainText = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

  // Short preview: first ~150 chars
  const preview = plainText.length > 150
    ? plainText.slice(0, 150).trim() + "..."
    : plainText;

  if (!plainText) return null;

  return (
    <div>
      <p className="text-[10px] text-wmdm-text-muted uppercase tracking-wider mb-2">Description</p>
      {expanded ? (
        <>
          <div
            className="text-xs text-wmdm-text-muted leading-relaxed space-y-2"
            dangerouslySetInnerHTML={{ __html: html }}
          />
          <button
            onClick={() => setExpanded(false)}
            className="text-[11px] text-wmdm-accent hover:text-wmdm-accent-hover mt-2 transition-colors"
          >
            Show less
          </button>
        </>
      ) : (
        <>
          <p className="text-xs text-wmdm-text-muted leading-relaxed">{preview}</p>
          {plainText.length > 150 && (
            <button
              onClick={() => setExpanded(true)}
              className="text-[11px] text-wmdm-accent hover:text-wmdm-accent-hover mt-1 transition-colors"
            >
              Show more
            </button>
          )}
        </>
      )}
    </div>
  );
}

interface StoreProductDetailProps {
  product: StoreProduct;
  onClose: () => void;
}

export default function StoreProductDetail({ product, onClose }: StoreProductDetailProps) {
  const [imgError, setImgError] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState<StoreProduct[]>([]);
  const [showCheckout, setShowCheckout] = useState(false);

  const toggle = usePlayerStore((s) => s.toggle);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isCurrentlyPlaying = currentTrack?.id === product.id && isPlaying;

  const ownedProducts = useProductStore((s) => s.products);
  const isOwned = ownedProducts.some((p) => p.id === product.id);

  // Load related products from same creator or genre
  useEffect(() => {
    const searchTerm = product.creator?.name || product.genres[0] || "";
    if (!searchTerm) return;
    getStoreProducts(1, 6, searchTerm)
      .then((result) => {
        setRelatedProducts(result.items.filter((p) => p.id !== product.id).slice(0, 4));
      })
      .catch(() => {});
  }, [product.id, product.creator?.name, product.genres]);

  const handlePlay = () => {
    if (product.streamUrl) {
      toggle({
        id: product.id,
        name: product.name,
        sku: product.sku,
        thumbnailUrl: product.thumbnailUrl,
        streamUrl: product.streamUrl,
        waveform: product.waveform ?? null,
        formatType: product.formatType,
        daws: product.daws,
        genres: product.genres,
        bpm: product.bpm,
        key: product.key,
        creator: product.creator,
        downloadLinks: [],
        purchasedAt: "",
        fileSize: null,
      });
    }
  };

  const handleBuy = () => {
    if (product.price === 0) {
      // Free products: open in browser
      if (product.productUrl) {
        if (product.productUrl) navigateStore(product.productUrl);
      }
    } else {
      // Paid products: open in-app checkout
      setShowCheckout(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-wmdm-surface border-l border-wmdm-border overflow-y-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round">
            <path d="M3 3l8 8M11 3l-8 8" />
          </svg>
        </button>

        {/* Hero image */}
        <div className="relative aspect-video bg-wmdm-bg overflow-hidden">
          {product.thumbnailUrl && !imgError ? (
            <img
              src={product.thumbnailUrl}
              alt={product.name}
              onError={() => setImgError(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="text-wmdm-border">
                <rect x="4" y="8" width="40" height="32" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="16" cy="20" r="4" stroke="currentColor" strokeWidth="1.5" />
                <path d="M4 34l10-8 8 5 10-10 12 10" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </div>
          )}

          {/* Play overlay */}
          {product.streamUrl && (
            <button
              onClick={handlePlay}
              className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors group"
            >
              <div className="w-14 h-14 rounded-full bg-wmdm-accent/90 group-hover:bg-wmdm-accent flex items-center justify-center shadow-lg transition-colors">
                {isCurrentlyPlaying ? (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="white">
                    <rect x="5" y="3" width="4" height="14" rx="0.5" />
                    <rect x="11" y="3" width="4" height="14" rx="0.5" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="white">
                    <path d="M6 3v14l10-7-10-7z" />
                  </svg>
                )}
              </div>
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {/* Title + Creator */}
          <div>
            <h2 className="text-lg font-semibold text-wmdm-text leading-tight">
              {product.name}
            </h2>
            {product.creator && (
              <p className="text-sm text-wmdm-text-muted mt-1">
                by {product.creator.name}
              </p>
            )}
          </div>

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <FormatBadge formatType={product.formatType} />
            {product.daws.map((daw) => (
              <DawBadge key={daw} daw={daw} />
            ))}
          </div>

          {/* BPM + Key */}
          {(product.bpm || product.key) && (
            <div className="flex gap-3">
              {product.bpm && (
                <div className="bg-wmdm-bg rounded-lg px-4 py-2.5 border border-wmdm-border">
                  <p className="text-[10px] text-wmdm-text-muted uppercase">BPM</p>
                  <p className="text-lg font-semibold text-wmdm-text">{product.bpm}</p>
                </div>
              )}
              {product.key && (
                <div className="bg-wmdm-bg rounded-lg px-4 py-2.5 border border-wmdm-border">
                  <p className="text-[10px] text-wmdm-text-muted uppercase">Key</p>
                  <p className="text-lg font-semibold text-wmdm-text">{product.key}</p>
                </div>
              )}
            </div>
          )}

          {/* Description (collapsible — show first 3 lines, expand for full) */}
          {product.description && (
            <DescriptionBlock html={product.description} />
          )}

          {/* Genres */}
          {product.genres.length > 0 && (
            <div>
              <p className="text-[10px] text-wmdm-text-muted uppercase tracking-wider mb-2">Genres</p>
              <div className="flex flex-wrap gap-1.5">
                {product.genres.map((genre) => (
                  <span key={genre} className="text-xs bg-wmdm-bg text-wmdm-text-muted px-2 py-1 rounded">
                    {genre}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Price + Buy CTA */}
          <div className="bg-gradient-to-r from-wmdm-accent/10 to-violet-600/10 rounded-xl p-4 border border-wmdm-accent/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-wmdm-text">
                  {product.price === 0 ? "Free" : `$${product.price.toFixed(2)}`}
                </p>
                {isOwned && (
                  <p className="text-xs text-wmdm-success font-medium mt-0.5">You own this product</p>
                )}
              </div>
              {isOwned ? (
                <span className="bg-wmdm-success/20 text-wmdm-success text-sm font-medium px-4 py-2 rounded-lg">
                  Purchased
                </span>
              ) : (
                <button
                  onClick={handleBuy}
                  className="bg-wmdm-accent hover:bg-wmdm-accent-hover text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors shadow-lg shadow-wmdm-accent/20"
                >
                  {product.price === 0 ? "Get Free" : "Buy Now"}
                </button>
              )}
            </div>
          </div>

          {/* Related products */}
          {relatedProducts.length > 0 && (
            <div>
              <p className="text-[10px] text-wmdm-text-muted uppercase tracking-wider mb-2">
                You might also like
              </p>
              <div className="space-y-2">
                {relatedProducts.map((rp) => {
                  const rpOwned = ownedProducts.some((p) => p.id === rp.id);
                  return (
                    <RelatedProductRow key={rp.id} product={rp} isOwned={rpOwned} />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Checkout Modal */}
      {showCheckout && (
        <CheckoutModal
          product={product}
          onClose={() => setShowCheckout(false)}
        />
      )}
    </div>
  );
}
