// ============================================================
// WMDM Desktop App — Product Detail Panel (Slide-over)
// ============================================================

import { useState, useMemo, useEffect } from "react";
import { open } from "@tauri-apps/plugin-shell";
import type { Product, DownloadLink, StoreProduct } from "../../types";
import { FormatBadge, DawBadge } from "../common/Badge";
import { useDownloadStore } from "../../stores/downloadStore";
import { useProductStore } from "../../stores/productStore";
import { usePlayerStore } from "../../stores/playerStore";
import { revealInFinder, getStoreProducts } from "../../api/tauri";
import { DownloadStatus } from "../../types";

interface ProductDetailProps {
  product: Product;
  onClose: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function DownloadLinkRow({
  link,
  product,
}: {
  link: DownloadLink;
  product: Product;
}) {
  const [isStarting, setIsStarting] = useState(false);
  const startDownload = useDownloadStore((s) => s.startDownload);
  const queue = useDownloadStore((s) => s.queue);
  const history = useDownloadStore((s) => s.history);

  // Check if this link is currently downloading or completed
  const inQueue = queue.find(
    (item) => item.linkHash === link.hash && item.productId === product.id
  );
  const inHistory = history.find(
    (item) =>
      item.linkHash === link.hash &&
      item.productId === product.id &&
      item.status === DownloadStatus.Complete
  );

  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleDownload = async () => {
    setIsStarting(true);
    setDownloadError(null);
    try {
      await startDownload(product, link.hash);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setDownloadError(msg);
      console.error("[WMDM] Download error:", msg);
    }
    setIsStarting(false);
  };

  const handleReveal = async () => {
    if (inHistory?.outputPath) {
      await revealInFinder(inHistory.outputPath);
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-wmdm-bg rounded-lg border border-wmdm-border">
      {/* File icon */}
      <div className="shrink-0">
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-wmdm-text-muted"
        >
          <path d="M4 3h8l4 4v10a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1z" />
          <path d="M12 3v4h4" />
        </svg>
      </div>

      {/* File info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-wmdm-text truncate">{product.name}</p>
        <div className="flex items-center gap-2 text-[11px] text-wmdm-text-muted">
          {link.fileSize > 0 && <span>{formatBytes(link.fileSize)}</span>}
          {link.remainingDownloads !== null && (
            <>
              {link.fileSize > 0 && <span className="w-0.5 h-0.5 rounded-full bg-wmdm-text-muted" />}
              <span>{link.remainingDownloads} downloads left</span>
            </>
          )}
          {link.fileSize === 0 && link.remainingDownloads === null && (
            <span>Ready to download</span>
          )}
        </div>
      </div>

      {/* Action */}
      {inHistory ? (
        <button
          onClick={handleReveal}
          className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M2 7h10M8 3l4 4-4 4" />
          </svg>
          Show in Finder
        </button>
      ) : inQueue ? (
        <span className="text-xs text-wmdm-accent font-medium">
          {inQueue.status === DownloadStatus.Downloading
            ? `${Math.round(inQueue.progress)}%`
            : inQueue.status === DownloadStatus.Queued
              ? "Queued"
              : inQueue.status}
        </span>
      ) : (
        <button
          onClick={handleDownload}
          disabled={isStarting}
          className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"
        >
          {isStarting ? (
            <svg
              className="animate-spin"
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
            >
              <circle
                cx="7"
                cy="7"
                r="5.5"
                stroke="currentColor"
                strokeWidth="1.5"
                opacity="0.3"
              />
              <path
                d="M12.5 7a5.5 5.5 0 00-5.5-5.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          ) : (
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M7 2v7m0 0L4.5 6.5M7 9l2.5-2.5" />
              <path d="M2 10.5v1a1 1 0 001 1h8a1 1 0 001-1v-1" />
            </svg>
          )}
          Download
        </button>
      )}
      {downloadError && (
        <p className="text-xs text-wmdm-error mt-1 break-all">{downloadError}</p>
      )}
    </div>
  );
}

function UpsellCard({ item, isOwned }: { item: StoreProduct; isOwned: boolean }) {
  const [imgErr, setImgErr] = useState(false);
  const toggle = usePlayerStore((s) => s.toggle);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isCurrentlyPlaying = currentTrack?.id === item.id && isPlaying;

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.streamUrl) {
      toggle({
        id: item.id, name: item.name, sku: item.sku,
        thumbnailUrl: item.thumbnailUrl, streamUrl: item.streamUrl,
        waveform: null, formatType: item.formatType,
        daws: item.daws, genres: item.genres, bpm: item.bpm,
        key: item.key, creator: item.creator,
        downloadLinks: [], purchasedAt: "", fileSize: null,
      });
    }
  };

  return (
    <div className="shrink-0 w-36 bg-wmdm-bg rounded-lg border border-wmdm-border overflow-hidden group">
      <div className="relative aspect-[4/3] bg-wmdm-bg overflow-hidden">
        {item.thumbnailUrl && !imgErr ? (
          <img src={item.thumbnailUrl} alt="" loading="lazy" onError={() => setImgErr(true)}
               className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-wmdm-border">
            <svg width="20" height="20" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="4" y="8" width="32" height="24" rx="2" />
            </svg>
          </div>
        )}
        <div className="absolute top-1 left-1">
          <FormatBadge formatType={item.formatType} />
        </div>
        {item.streamUrl && (
          <button onClick={handlePlay}
            className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-black/50 hover:bg-wmdm-accent flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
          >
            {isCurrentlyPlaying ? (
              <svg width="8" height="8" viewBox="0 0 8 8" fill="white"><rect x="1" y="0.5" width="2" height="7" rx="0.5"/><rect x="5" y="0.5" width="2" height="7" rx="0.5"/></svg>
            ) : (
              <svg width="8" height="8" viewBox="0 0 8 8" fill="white"><path d="M2 1v6l5-3-5-3z"/></svg>
            )}
          </button>
        )}
      </div>
      <div className="p-1.5">
        <p className="text-[10px] font-medium text-wmdm-text leading-tight line-clamp-2 mb-1">{item.name}</p>
        {isOwned ? (
          <span className="text-[9px] text-wmdm-success font-medium">Purchased</span>
        ) : (
          <button onClick={() => item.productUrl && open(item.productUrl)}
            className="text-[9px] bg-wmdm-accent hover:bg-wmdm-accent-hover text-white px-2 py-0.5 rounded font-medium transition-colors">
            {item.price === 0 ? "Free" : `Buy $${item.price.toFixed(2)}`}
          </button>
        )}
      </div>
    </div>
  );
}

export default function ProductDetail({ product, onClose }: ProductDetailProps) {
  const [imgError, setImgError] = useState(false);
  const products = useProductStore((s) => s.products);

  // More from this creator: fetch from store API (upsell — not just owned products)
  const [creatorUpsells, setCreatorUpsells] = useState<StoreProduct[]>([]);
  const ownedIds = useMemo(() => new Set(products.map(p => p.id)), [products]);

  useEffect(() => {
    if (!product.creator?.name) return;
    getStoreProducts(1, 8, product.creator.name, undefined, undefined, undefined)
      .then((result) => {
        const filtered = result.items.filter(p => p.id !== product.id).slice(0, 6);
        setCreatorUpsells(filtered);
      })
      .catch(() => {});
  }, [product.id, product.creator?.name]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-wmdm-surface border-l border-wmdm-border overflow-y-auto animate-slide-in">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 btn-icon z-10"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <path d="M5 5l10 10M15 5L5 15" />
          </svg>
        </button>

        {/* Thumbnail */}
        <div className="relative aspect-video bg-wmdm-bg">
          {product.thumbnailUrl && !imgError ? (
            <img
              src={product.thumbnailUrl}
              alt={product.name}
              onError={() => setImgError(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg
                width="60"
                height="60"
                viewBox="0 0 60 60"
                fill="none"
                className="text-wmdm-border"
              >
                <rect
                  x="6"
                  y="12"
                  width="48"
                  height="36"
                  rx="3"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <circle cx="21" cy="27" r="4.5" stroke="currentColor" strokeWidth="1.5" />
                <path
                  d="M6 39l12-9 9 6 12-12 15 12"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Title */}
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
          <div className="flex flex-wrap gap-2">
            <FormatBadge formatType={product.formatType} size="md" />
            {product.daws.map((daw) => (
              <DawBadge key={daw} daw={daw} size="md" />
            ))}
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-3">
            {product.bpm && (
              <div className="bg-wmdm-bg rounded-lg p-3">
                <p className="text-[10px] text-wmdm-text-muted uppercase tracking-wider">
                  BPM
                </p>
                <p className="text-sm font-medium text-wmdm-text mt-0.5">
                  {product.bpm}
                </p>
              </div>
            )}
            {product.key && (
              <div className="bg-wmdm-bg rounded-lg p-3">
                <p className="text-[10px] text-wmdm-text-muted uppercase tracking-wider">
                  Key
                </p>
                <p className="text-sm font-medium text-wmdm-text mt-0.5">
                  {product.key}
                </p>
              </div>
            )}
          </div>

          {/* Genres */}
          {product.genres.length > 0 && (
            <div>
              <p className="text-[10px] text-wmdm-text-muted uppercase tracking-wider mb-2">
                Genres
              </p>
              <div className="flex flex-wrap gap-1.5">
                {product.genres.map((genre) => (
                  <span
                    key={genre}
                    className="text-xs bg-wmdm-bg text-wmdm-text-muted px-2 py-1 rounded"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Download Links */}
          <div>
            <p className="text-[10px] text-wmdm-text-muted uppercase tracking-wider mb-2">
              Downloads
            </p>
            <div className="space-y-2">
              {product.downloadLinks.map((link) => (
                <DownloadLinkRow
                  key={link.hash}
                  link={link}
                  product={product}
                />
              ))}
              {product.downloadLinks.length === 0 && (
                <p className="text-sm text-wmdm-text-muted italic">
                  No download links available
                </p>
              )}
            </div>
          </div>

          {/* More from this creator (upsell) */}
          {product.creator && creatorUpsells.length > 0 && (
            <div>
              <p className="text-[10px] text-wmdm-text-muted uppercase tracking-wider mb-2">
                More from {product.creator.name}
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                {creatorUpsells.map((item) => (
                  <UpsellCard key={item.id} item={item} isOwned={ownedIds.has(item.id)} />
                ))}
              </div>
            </div>
          )}

          {/* Purchase date */}
          <div className="pt-3 border-t border-wmdm-border">
            <p className="text-xs text-wmdm-text-muted">
              {product.purchasedAt && !isNaN(new Date(product.purchasedAt).getTime())
                ? `Purchased ${new Date(product.purchasedAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}`
                : "Purchased"}
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slide-in {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in {
          animation: slide-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
