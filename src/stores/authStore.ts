// ============================================================
// WMDM Desktop App — Auth Store (Zustand)
// ============================================================

import { create } from "zustand";
import type { UserProfile } from "../types";
import * as api from "../api/tauri";

interface AuthState {
  user: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  sessionChecked: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  error: null,
  isAuthenticated: false,
  sessionChecked: false,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const session = await api.login(email, password);
      set({
        user: session.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err);
      set({
        isLoading: false,
        error: message,
        isAuthenticated: false,
        user: null,
      });
      throw err;
    }
  },

  register: async (email: string, password: string, firstName: string, lastName: string) => {
    set({ isLoading: true, error: null });
    try {
      const session = await api.register(email, password, firstName, lastName);
      set({
        user: session.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err);
      set({
        isLoading: false,
        error: message,
        isAuthenticated: false,
        user: null,
      });
      throw err;
    }
  },

  logout: async () => {
    try {
      await api.logout();
    } catch {
      // Logout best-effort
    }
    // Clear per-account in-memory state so the next login starts fresh
    const { useProductStore } = await import("./productStore");
    const { useDownloadStore } = await import("./downloadStore");
    useProductStore.setState({
      products: [],
      filteredProducts: [],
      downloadedIds: new Set<number>(),
      favoriteIds: new Set<number>(),
      lastSync: null,
      totalCount: 0,
      selectedProduct: null,
    });
    useDownloadStore.setState({
      queue: [],
      history: [],
      activeCount: 0,
    });
    set({
      user: null,
      isAuthenticated: false,
      error: null,
    });
  },

  checkSession: async () => {
    set({ isLoading: true });
    try {
      const session = await api.getSession();
      if (session) {
        set({
          user: session.user,
          isAuthenticated: true,
          isLoading: false,
          sessionChecked: true,
        });
      } else {
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          sessionChecked: true,
        });
      }
    } catch {
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        sessionChecked: true,
      });
    }
  },

  clearError: () => set({ error: null }),
}));
