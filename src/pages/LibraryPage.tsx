// ============================================================
// WMDM Desktop App — Library Page
// Product grid with search, filters, and sort
// ============================================================

import { useState, useEffect, useMemo, useCallback } from "react";
import { useProductStore } from "../stores/productStore";
import type { Product, SortOption } from "../types";
import { FormatBadge } from "../components/common/Badge";
import ProductCard from "../components/library/ProductCard";
import ProductDetail from "../components/library/ProductDetail";
import FilterBar from "../components/library/FilterBar";
import SampleLibraryPanel from "../components/library/SampleLibraryPanel";

type LibraryTab = "products" | "samples";

function SearchIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <circle cx="8" cy="8" r="5.5" />
      <path d="M12.5 12.5L16 16" />
    </svg>
  );
}

function SyncIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={spinning ? "animate-spin" : ""}
    >
      <path d="M1.5 8a6.5 6.5 0 0111.3-4.3" />
      <path d="M14.5 8a6.5 6.5 0 01-11.3 4.3" />
      <path d="M12.8 1v2.7H10" />
      <path d="M3.2 15v-2.7H6" />
    </svg>
  );
}

function NewThisWeekCard({
  product,
  onClick,
}: {
  product: Product;
  onClick: (product: Product) => void;
}) {
  const [imgError, setImgError] = useState(false);
  return (
    <button
      onClick={() => onClick(product)}
      className="shrink-0 w-40 text-left bg-wmdm-surface rounded-lg border border-wmdm-border
                 hover:border-wmdm-accent/40 transition-default overflow-hidden focus-ring"
    >
      <div className="relative aspect-[4/3] bg-wmdm-bg overflow-hidden">
        {product.thumbnailUrl && !imgError ? (
          <img
            src={product.thumbnailUrl}
            alt={product.name}
            loading="lazy"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 40 40" fill="none" className="text-wmdm-border">
              <rect x="4" y="8" width="32" height="24" rx="2" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </div>
        )}
        <div className="absolute top-1.5 left-1.5">
          <FormatBadge formatType={product.formatType} size="sm" />
        </div>
      </div>
      <div className="p-2">
        <p className="text-xs font-medium text-wmdm-text leading-tight line-clamp-2">
          {product.name}
        </p>
      </div>
    </button>
  );
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "recent", label: "Recent Purchases" },
  { value: "name-asc", label: "Name A-Z" },
  { value: "name-desc", label: "Name Z-A" },
  { value: "creator", label: "Creator" },
  { value: "format", label: "Format" },
];

export default function LibraryPage() {
  const products = useProductStore((s) => s.products);
  const filteredProducts = useProductStore((s) => s.filteredProducts);
  const isSyncing = useProductStore((s) => s.isSyncing);
  const syncError = useProductStore((s) => s.syncError);
  const lastSync = useProductStore((s) => s.lastSync);
  const filters = useProductStore((s) => s.filters);
  const searchQuery = useProductStore((s) => s.searchQuery);
  const sortBy = useProductStore((s) => s.sortBy);
  const setSearchQuery = useProductStore((s) => s.setSearchQuery);
  const setFilters = useProductStore((s) => s.setFilters);
  const clearFilters = useProductStore((s) => s.clearFilters);
  const setSortBy = useProductStore((s) => s.setSortBy);
  const syncAll = useProductStore((s) => s.syncAll);
  const syncDelta = useProductStore((s) => s.syncDelta);
  const selectedProduct = useProductStore((s) => s.selectedProduct);
  const setSelectedProduct = useProductStore((s) => s.setSelectedProduct);

  const [showFilters, setShowFilters] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [tab, setTab] = useState<LibraryTab>("products");
  const favoriteIds = useProductStore((s) => s.favoriteIds);
  const downloadedIds = useProductStore((s) => s.downloadedIds);

  // New This Week: products purchased in the last 7 days
  const newThisWeek = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return products
      .filter((p) => {
        const d = new Date(p.purchasedAt).getTime();
        return !isNaN(d) && d >= sevenDaysAgo;
      })
      .sort(
        (a, b) =>
          new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime()
      );
  }, [products]);

  const loadFromCache = useProductStore((s) => s.loadFromCache);

  // Load from cache first (instant), then sync from API
  useEffect(() => {
    if (products.length === 0 && !isSyncing) {
      loadFromCache().then(() => {
        syncAll().catch(() => {});
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Collect unique genres from all products
  const availableGenres = useMemo(() => {
    const genres = new Set<string>();
    for (const p of products) {
      for (const g of p.genres) {
        genres.add(g);
      }
    }
    return Array.from(genres).sort();
  }, [products]);

  const handleSync = useCallback(() => {
    if (isSyncing) return;
    if (lastSync) {
      syncDelta().catch(() => {});
    } else {
      syncAll().catch(() => {});
    }
  }, [isSyncing, lastSync, syncAll, syncDelta]);

  const formatLastSync = (iso: string | null) => {
    if (!iso) return "Never";
    const date = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  const activeFilterCount =
    filters.daw.length +
    filters.formatType.length +
    filters.genre.length +
    (filters.bpmRange ? 1 : 0) +
    (filters.key ? 1 : 0);

  return (
    <div className="flex flex-col h-full">
      {/* Top-level tab switch: Products ↔ Sample Library (Bridge) */}
      <div className="shrink-0 px-6 pt-3 flex items-center gap-1 border-b border-wmdm-border">
        <button
          onClick={() => setTab("products")}
          className={`px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors ${
            tab === "products"
              ? "text-wmdm-accent border-b-2 border-wmdm-accent"
              : "text-wmdm-text-muted hover:text-wmdm-text"
          }`}
        >
          Products
        </button>
        <button
          onClick={() => setTab("samples")}
          className={`px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors ${
            tab === "samples"
              ? "text-wmdm-accent border-b-2 border-wmdm-accent"
              : "text-wmdm-text-muted hover:text-wmdm-text"
          }`}
        >
          Sample Library
          <span className="ml-1.5 text-[9px] font-semibold px-1 py-0.5 rounded bg-wmdm-accent/15 text-wmdm-accent">
            BRIDGE
          </span>
        </button>
      </div>

      {tab === "samples" ? (
        <SampleLibraryPanel />
      ) : (
      <>
      {/* Header */}
      <header className="shrink-0 px-6 pt-4 pb-4 space-y-4">
        {/* Actions row */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-wmdm-text-muted">
            {filteredProducts.length !== products.length
              ? `${filteredProducts.length} of ${products.length} products`
              : `${products.length} products`}
          </p>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-wmdm-text-muted">
              Synced {formatLastSync(lastSync)}
            </span>
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
            >
              <SyncIcon spinning={isSyncing} />
              {isSyncing ? "Syncing..." : "Sync"}
            </button>
            {filteredProducts.length > 0 && (
              <button
                onClick={async () => {
                  const { startDownload } = await import("../stores/downloadStore").then(m => ({ startDownload: m.useDownloadStore.getState().startDownload }));
                  for (const p of filteredProducts) {
                    if (p.downloadLinks.length > 0 && !downloadedIds.has(p.id)) {
                      try {
                        await startDownload(p, p.downloadLinks[0].hash);
                      } catch { break; } // Stop on first error (rate limit etc)
                    }
                  }
                }}
                className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M7 2v7m0 0L4.5 6.5M7 9l2.5-2.5" />
                  <path d="M2 10.5v1a1 1 0 001 1h8a1 1 0 001-1v-1" />
                </svg>
                Download All
              </button>
            )}
          </div>
        </div>

        {/* Quick format tabs */}
        <div className="flex items-center gap-1">
          {[
            { label: "All", value: "" },
            { label: "Templates", value: "template" },
            { label: "Presets", value: "preset" },
            { label: "Samples", value: "sample" },
            { label: "MIDI", value: "midi" },
            { label: "\u2605 Favorites", value: "favorites" },
          ].map((tab) => {
            const isActive = tab.value === "favorites"
              ? showFavoritesOnly
              : !showFavoritesOnly && (filters.formatType.length === 0
                ? tab.value === ""
                : filters.formatType.length === 1 && filters.formatType[0] === tab.value);
            return (
              <button
                key={tab.value}
                onClick={() => {
                  if (tab.value === "favorites") {
                    setShowFavoritesOnly(!showFavoritesOnly);
                    setFilters({ formatType: [] });
                  } else if (tab.value === "") {
                    setShowFavoritesOnly(false);
                    setFilters({ formatType: [] });
                  } else {
                    setShowFavoritesOnly(false);
                    setFilters({ formatType: [tab.value as import("../types").FormatType] });
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-wmdm-accent text-white"
                    : "text-wmdm-text-muted hover:text-wmdm-text hover:bg-wmdm-surface"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search + filter + sort row */}
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-wmdm-text-muted">
              <SearchIcon />
            </div>
            <input
              data-search-input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products, creators, genres..."
              className="input-base pl-10"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-wmdm-text-muted hover:text-wmdm-text"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                >
                  <path d="M3 3l8 8M11 3l-8 8" />
                </svg>
              </button>
            )}
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-secondary text-xs px-3 py-2 flex items-center gap-1.5 ${
              showFilters || activeFilterCount > 0
                ? "border-wmdm-accent/40 text-wmdm-accent"
                : ""
            }`}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <path d="M2 4h12M4 8h8M6 12h4" />
            </svg>
            Filters
            {activeFilterCount > 0 && (
              <span className="bg-wmdm-accent text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="text-xs bg-wmdm-surface border border-wmdm-border rounded-lg px-3 py-2
                       text-wmdm-text focus:outline-none focus:ring-1 focus:ring-wmdm-accent
                       appearance-none pr-8 cursor-pointer"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394a3b8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 8px center",
            }}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Filter bar */}
        {showFilters && (
          <div className="titlebar-no-drag">
            <FilterBar
              filters={filters}
              onFilterChange={setFilters}
              onClear={clearFilters}
              availableGenres={availableGenres}
            />
          </div>
        )}
      </header>

      {/* Product grid */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {/* New This Week */}
        {newThisWeek.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-semibold text-wmdm-text">New This Week</h3>
              <span className="text-[10px] font-bold bg-wmdm-accent/20 text-wmdm-accent px-1.5 py-0.5 rounded-full">
                {newThisWeek.length}
              </span>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
              {newThisWeek.map((product) => (
                <NewThisWeekCard
                  key={product.id}
                  product={product}
                  onClick={setSelectedProduct}
                />
              ))}
            </div>
          </div>
        )}
        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {(showFavoritesOnly ? filteredProducts.filter(p => favoriteIds.has(p.id)) : filteredProducts).map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onClick={setSelectedProduct}
              />
            ))}
          </div>
        ) : isSyncing ? (
          <div className="flex flex-col items-center justify-center h-64 text-wmdm-text-muted">
            <svg
              className="animate-spin mb-3"
              width="32"
              height="32"
              viewBox="0 0 32 32"
              fill="none"
            >
              <circle
                cx="16"
                cy="16"
                r="12"
                stroke="currentColor"
                strokeWidth="2"
                opacity="0.2"
              />
              <path
                d="M28 16a12 12 0 00-12-12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <p className="text-sm">Syncing your library...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-wmdm-text-muted">
            <svg
              width="48"
              height="48"
              viewBox="0 0 48 48"
              fill="none"
              className="mb-3"
            >
              <rect
                x="6"
                y="6"
                width="36"
                height="36"
                rx="4"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M18 20h12M18 26h8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <p className="text-sm font-medium">No products yet</p>
            <p className="text-xs mt-1">
              Click Sync to load your purchased products
            </p>
            {syncError && (
              <p className="text-xs mt-3 text-wmdm-error bg-red-500/10 px-3 py-2 rounded max-w-md break-all">
                Sync error: {syncError}
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-wmdm-text-muted">
            <svg
              width="48"
              height="48"
              viewBox="0 0 48 48"
              fill="none"
              className="mb-3"
            >
              <circle cx="20" cy="20" r="14" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="M30 30l12 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <p className="text-sm font-medium">No matches found</p>
            <p className="text-xs mt-1">
              Try adjusting your search or filters
            </p>
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="text-xs text-wmdm-accent hover:text-wmdm-accent-hover mt-2"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Product detail panel */}
      {selectedProduct && (
        <ProductDetail
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
      </>
      )}
    </div>
  );
}
