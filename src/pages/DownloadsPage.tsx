// ============================================================
// WMDM Desktop App — Downloads Page
// Active downloads, queue, and recent completions
// ============================================================

import { useEffect, useMemo } from "react";
import { useDownloadStore } from "../stores/downloadStore";
import { useProductStore } from "../stores/productStore";
import { DownloadStatus } from "../types";
import DownloadItemComponent from "../components/downloads/DownloadItem";
import Upsells from "../components/downloads/Upsells";

export default function DownloadsPage() {
  const queue = useDownloadStore((s) => s.queue);
  const history = useDownloadStore((s) => s.history);
  const activeCount = useDownloadStore((s) => s.activeCount);
  const refreshQueue = useDownloadStore((s) => s.refreshQueue);
  const clearHistory = useDownloadStore((s) => s.clearHistory);

  // Refresh queue on mount
  useEffect(() => {
    refreshQueue();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Split queue into active, waiting, and errored
  const activeItems = queue.filter(
    (item) =>
      item.status === DownloadStatus.Downloading ||
      item.status === DownloadStatus.Extracting ||
      item.status === DownloadStatus.Placing
  );
  const waitingItems = queue.filter(
    (item) => item.status === DownloadStatus.Queued
  );
  const pausedItems = queue.filter(
    (item) => item.status === DownloadStatus.Paused
  );
  const errorItems = queue.filter(
    (item) => item.status === DownloadStatus.Error
  );

  const hasAnyItems =
    queue.length > 0 || history.length > 0;

  // Get upsell context from the most recent download's product
  const products = useProductStore((s) => s.products);
  const upsellContext = useMemo(() => {
    const recentItem = [...queue, ...history][0];
    if (!recentItem) return null;
    const product = products.find((p) => p.id === recentItem.productId);
    if (!product) return null;
    return {
      genre: product.genres[0] || undefined,
      formatType: product.formatType || undefined,
      daw: product.daws[0] || undefined,
    };
  }, [queue, history, products]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="shrink-0 px-6 pt-4 pb-4">
        <div className="titlebar-no-drag">
          <h1 className="text-xl font-semibold text-wmdm-text">Downloads</h1>
          <p className="text-xs text-wmdm-text-muted mt-0.5">
            {activeCount > 0
              ? `${activeCount} active download${activeCount !== 1 ? "s" : ""}`
              : "No active downloads"}
          </p>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-6">
        {!hasAnyItems ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-64 text-wmdm-text-muted">
            <svg
              width="48"
              height="48"
              viewBox="0 0 48 48"
              fill="none"
              className="mb-3"
            >
              <path
                d="M24 8v20m0 0l-8-8m8 8l8-8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M8 34v4a2 2 0 002 2h28a2 2 0 002-2v-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="text-sm font-medium">No downloads yet</p>
            <p className="text-xs mt-1">
              Start downloading from your Library
            </p>
          </div>
        ) : (
          <>
            {/* Active Downloads */}
            {activeItems.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-sm font-medium text-wmdm-text">Active</h2>
                  <span className="bg-blue-500/20 text-blue-400 text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {activeItems.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {activeItems.map((item) => (
                    <DownloadItemComponent key={item.id} item={item} />
                  ))}
                </div>
              </section>
            )}

            {/* Paused Downloads */}
            {pausedItems.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-sm font-medium text-wmdm-text">Paused</h2>
                  <span className="bg-amber-500/20 text-amber-400 text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {pausedItems.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {pausedItems.map((item) => (
                    <DownloadItemComponent key={item.id} item={item} />
                  ))}
                </div>
              </section>
            )}

            {/* Queue */}
            {waitingItems.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-sm font-medium text-wmdm-text">Queue</h2>
                  <span className="bg-gray-500/20 text-gray-400 text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {waitingItems.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {waitingItems.map((item) => (
                    <DownloadItemComponent key={item.id} item={item} />
                  ))}
                </div>
              </section>
            )}

            {/* Errors */}
            {errorItems.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-sm font-medium text-wmdm-text">Errors</h2>
                  <span className="bg-red-500/20 text-red-400 text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {errorItems.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {errorItems.map((item) => (
                    <DownloadItemComponent key={item.id} item={item} />
                  ))}
                </div>
              </section>
            )}

            {/* Recent Completions */}
            {history.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-medium text-wmdm-text">
                      Recent
                    </h2>
                    <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {history.length}
                    </span>
                  </div>
                  <button
                    onClick={clearHistory}
                    className="text-xs text-wmdm-text-muted hover:text-wmdm-text transition-default"
                  >
                    Clear
                  </button>
                </div>
                <div className="space-y-2">
                  {history.map((item) => (
                    <DownloadItemComponent key={item.id} item={item} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* Upsell recommendations — show when there are downloads */}
        {hasAnyItems && upsellContext && (
          <Upsells
            genre={upsellContext.genre}
            formatType={upsellContext.formatType}
            daw={upsellContext.daw}
          />
        )}
      </div>
    </div>
  );
}
