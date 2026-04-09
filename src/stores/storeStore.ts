// ============================================================
// WMDM Desktop App — Store Catalog Store (Zustand)
// Manages the browse & buy store catalog state
// ============================================================

import { create } from "zustand";
import type { StoreProduct, FormatType, StoreSortOption } from "../types";
import * as api from "../api/tauri";

interface StoreFilters {
  formatType: FormatType | null;
  daw: string | null;
  genre: string | null;
}

interface StoreCatalogState {
  products: StoreProduct[];
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  filters: StoreFilters;
  sortBy: StoreSortOption;
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasMore: boolean;

  fetchProducts: (reset?: boolean) => Promise<void>;
  loadMore: () => Promise<void>;
  setSearchQuery: (q: string) => void;
  setFilter: (key: keyof StoreFilters, value: string | null) => void;
  clearFilters: () => void;
  setSortBy: (sort: StoreSortOption) => void;
}

const DEFAULT_FILTERS: StoreFilters = {
  formatType: null,
  daw: null,
  genre: null,
};

export const useStoreCatalogStore = create<StoreCatalogState>((set, get) => ({
  products: [],
  isLoading: false,
  error: null,
  searchQuery: "",
  filters: { ...DEFAULT_FILTERS },
  sortBy: "newest",
  page: 1,
  pageSize: 20,
  totalCount: 0,
  totalPages: 0,
  hasMore: false,

  fetchProducts: async (reset = true) => {
    const { searchQuery, filters, pageSize } = get();
    const page = reset ? 1 : get().page;

    set({ isLoading: true, error: null });
    if (reset) {
      set({ products: [], page: 1 });
    }

    try {
      const result = await api.getStoreProducts(
        page,
        pageSize,
        searchQuery || undefined,
        filters.formatType || undefined,
        filters.daw || undefined,
        filters.genre || undefined
      );

      set((state) => ({
        products: reset ? result.items : [...state.products, ...result.items],
        totalCount: result.totalCount,
        totalPages: result.totalPages,
        page: result.page,
        hasMore: result.page < result.totalPages,
        isLoading: false,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ isLoading: false, error: message });
    }
  },

  loadMore: async () => {
    const { hasMore, isLoading, page } = get();
    if (!hasMore || isLoading) return;
    set({ page: page + 1 });
    return get().fetchProducts(false);
  },

  setSearchQuery: (q: string) => {
    set({ searchQuery: q });
    // Debounce is handled in the component
  },

  setFilter: (key: keyof StoreFilters, value: string | null) => {
    set((state) => ({
      filters: { ...state.filters, [key]: value },
    }));
    get().fetchProducts(true);
  },

  clearFilters: () => {
    set({ filters: { ...DEFAULT_FILTERS }, searchQuery: "" });
    get().fetchProducts(true);
  },

  setSortBy: (sort: StoreSortOption) => {
    set({ sortBy: sort });
    // Sort is client-side since API returns by newest
    // Re-fetch if needed
    get().fetchProducts(true);
  },
}));
