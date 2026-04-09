// ============================================================
// WMDM Desktop App — Product Store (Zustand)
// ============================================================

import { create } from "zustand";
import type { Product, ProductFilters, SortOption } from "../types";
import * as api from "../api/tauri";

interface ProductState {
  products: Product[];
  filteredProducts: Product[];
  downloadedIds: Set<number>;
  favoriteIds: Set<number>;
  isLoading: boolean;
  isSyncing: boolean;
  syncError: string | null;
  lastSync: string | null;
  filters: ProductFilters;
  searchQuery: string;
  sortBy: SortOption;
  totalCount: number;
  selectedProduct: Product | null;

  loadFromCache: () => Promise<void>;
  syncAll: () => Promise<void>;
  syncDelta: () => Promise<void>;
  refreshDownloadedIds: () => Promise<void>;
  refreshFavorites: () => Promise<void>;
  toggleFavorite: (productId: number) => Promise<void>;
  setSearchQuery: (q: string) => void;
  setFilters: (f: Partial<ProductFilters>) => void;
  clearFilters: () => void;
  setSortBy: (sort: SortOption) => void;
  setSelectedProduct: (product: Product | null) => void;
  applyFiltersAndSearch: () => void;
}

const DEFAULT_FILTERS: ProductFilters = {
  daw: [],
  formatType: [],
  genre: [],
  bpmRange: null,
  key: null,
};

function matchesSearch(product: Product, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    product.name.toLowerCase().includes(q) ||
    product.sku.toLowerCase().includes(q) ||
    (product.creator?.name.toLowerCase().includes(q) ?? false) ||
    product.genres.some((g) => g.toLowerCase().includes(q)) ||
    product.daws.some((d) => d.toLowerCase().includes(q))
  );
}

function matchesFilters(product: Product, filters: ProductFilters): boolean {
  if (filters.daw.length > 0) {
    const match = product.daws.some((d) =>
      filters.daw.some((fd) => d.toLowerCase().includes(fd.toLowerCase()))
    );
    if (!match) return false;
  }

  if (filters.formatType.length > 0) {
    if (!filters.formatType.includes(product.formatType)) return false;
  }

  if (filters.genre.length > 0) {
    const match = product.genres.some((g) =>
      filters.genre.some((fg) => g.toLowerCase().includes(fg.toLowerCase()))
    );
    if (!match) return false;
  }

  if (filters.bpmRange && product.bpm) {
    const [min, max] = filters.bpmRange;
    if (product.bpm < min || product.bpm > max) return false;
  }

  if (filters.key && product.key) {
    if (product.key !== filters.key) return false;
  }

  return true;
}

function sortProducts(products: Product[], sortBy: SortOption): Product[] {
  const sorted = [...products];
  switch (sortBy) {
    case "recent":
      return sorted.sort(
        (a, b) =>
          new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime()
      );
    case "name-asc":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case "name-desc":
      return sorted.sort((a, b) => b.name.localeCompare(a.name));
    case "creator":
      return sorted.sort((a, b) =>
        (a.creator?.name ?? "").localeCompare(b.creator?.name ?? "")
      );
    case "format":
      return sorted.sort((a, b) => a.formatType.localeCompare(b.formatType));
    default:
      return sorted;
  }
}

export const useProductStore = create<ProductState>((set, get) => ({
  products: [],
  filteredProducts: [],
  downloadedIds: new Set<number>(),
  favoriteIds: new Set<number>(),
  isLoading: false,
  isSyncing: false,
  syncError: null,
  lastSync: null,
  filters: { ...DEFAULT_FILTERS },
  searchQuery: "",
  sortBy: "recent",
  totalCount: 0,
  selectedProduct: null,

  loadFromCache: async () => {
    try {
      const cached = await api.loadCachedProducts();
      if (cached.length > 0) {
        set({
          products: cached,
          totalCount: cached.length,
        });
        get().applyFiltersAndSearch();
        get().refreshDownloadedIds();
      }
    } catch {
      // Cache load is best effort
    }
  },

  syncAll: async () => {
    set({ isSyncing: true, syncError: null });
    try {
      let allProducts: Product[] = [];
      let page = 1;
      const pageSize = 500; // Large pages to reduce API calls (Cloudflare rate limits)
      let hasMore = true;

      while (hasMore) {
        console.log(`[WMDM] Syncing page ${page}...`);
        const result = await api.syncProducts(page, pageSize);
        console.log(`[WMDM] Page ${page}: got ${result.products.length} products, hasMore=${result.hasMore}`);
        allProducts = [...allProducts, ...result.products];
        hasMore = result.hasMore;
        page++;
        // Small delay between pages to be polite to the API
        if (hasMore) {
          await new Promise((r) => setTimeout(r, 300));
        }
      }

      console.log(`[WMDM] Sync complete: ${allProducts.length} total products`);
      set({
        products: allProducts,
        totalCount: allProducts.length,
        isSyncing: false,
        syncError: null,
        lastSync: new Date().toISOString(),
      });
      get().applyFiltersAndSearch();
      get().refreshDownloadedIds();
      get().refreshFavorites();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[WMDM] Sync failed:`, message);
      set({ isSyncing: false, syncError: message });
    }
  },

  refreshDownloadedIds: async () => {
    try {
      const ids = await api.getDownloadedProductIds();
      set({ downloadedIds: new Set(ids) });
    } catch {
      // Best effort
    }
  },

  refreshFavorites: async () => {
    try {
      const ids = await api.getFavoriteIds();
      set({ favoriteIds: new Set(ids) });
    } catch {
      // Best effort
    }
  },

  toggleFavorite: async (productId: number) => {
    const isFav = await api.toggleFavorite(productId);
    set((state) => {
      const newFavs = new Set(state.favoriteIds);
      if (isFav) {
        newFavs.add(productId);
      } else {
        newFavs.delete(productId);
      }
      return { favoriteIds: newFavs };
    });
  },

  syncDelta: async () => {
    const { lastSync, products } = get();
    if (!lastSync) {
      return get().syncAll();
    }

    set({ isSyncing: true });
    try {
      const delta = await api.syncDelta(lastSync);

      let updated = [...products];

      // Remove deleted products
      if (delta.removed.length > 0) {
        const removedSet = new Set(delta.removed);
        updated = updated.filter((p) => !removedSet.has(p.id));
      }

      // Update existing products
      for (const product of delta.updated) {
        const idx = updated.findIndex((p) => p.id === product.id);
        if (idx >= 0) {
          updated[idx] = product;
        }
      }

      // Add new products
      updated = [...delta.added, ...updated];

      set({
        products: updated,
        totalCount: updated.length,
        isSyncing: false,
        lastSync: new Date().toISOString(),
      });
      get().applyFiltersAndSearch();
    } catch (err) {
      set({ isSyncing: false });
      throw err;
    }
  },

  setSearchQuery: (q: string) => {
    set({ searchQuery: q });
    get().applyFiltersAndSearch();
  },

  setFilters: (f: Partial<ProductFilters>) => {
    set((state) => ({
      filters: { ...state.filters, ...f },
    }));
    get().applyFiltersAndSearch();
  },

  clearFilters: () => {
    set({ filters: { ...DEFAULT_FILTERS }, searchQuery: "" });
    get().applyFiltersAndSearch();
  },

  setSortBy: (sort: SortOption) => {
    set({ sortBy: sort });
    get().applyFiltersAndSearch();
  },

  setSelectedProduct: (product: Product | null) => {
    set({ selectedProduct: product });
  },

  applyFiltersAndSearch: () => {
    const { products, searchQuery, filters, sortBy } = get();
    let result = products.filter(
      (p) => matchesSearch(p, searchQuery) && matchesFilters(p, filters)
    );
    result = sortProducts(result, sortBy);
    set({ filteredProducts: result });
  },
}));
