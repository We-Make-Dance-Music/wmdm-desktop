// Bridge plugin: sample library store.
// Tracks library_roots + indexer status for the Sample Library tab.

import { create } from "zustand";
import * as api from "../api/tauri";
import type { LibraryRoot, IndexStatus } from "../api/tauri";

interface SampleLibraryState {
  roots: LibraryRoot[];
  status: IndexStatus;
  isLoading: boolean;
  error: string | null;

  loadRoots: () => Promise<void>;
  addRoot: () => Promise<void>;
  removeRoot: (id: number) => Promise<void>;
  toggleRoot: (id: number, enabled: boolean) => Promise<void>;
  rescan: () => Promise<void>;
  pollStatus: () => Promise<void>;
}

const DEFAULT_STATUS: IndexStatus = {
  scanning: false,
  totalFiles: 0,
  taggedFiles: 0,
  currentFile: null,
};

export const useSampleLibraryStore = create<SampleLibraryState>((set, get) => ({
  roots: [],
  status: DEFAULT_STATUS,
  isLoading: false,
  error: null,

  loadRoots: async () => {
    set({ isLoading: true, error: null });
    try {
      const [roots, status] = await Promise.all([
        api.listLibraryRoots(),
        api.getIndexStatus(),
      ]);
      set({ roots, status, isLoading: false });
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  addRoot: async () => {
    const path = await api.pickFolder();
    if (!path) return;
    try {
      await api.addLibraryRoot(path, "user");
      await get().loadRoots();
    } catch (e) {
      set({ error: String(e) });
    }
  },

  removeRoot: async (id: number) => {
    try {
      await api.removeLibraryRoot(id);
      await get().loadRoots();
    } catch (e) {
      set({ error: String(e) });
    }
  },

  toggleRoot: async (id: number, enabled: boolean) => {
    try {
      await api.setLibraryRootEnabled(id, enabled);
      await get().loadRoots();
    } catch (e) {
      set({ error: String(e) });
    }
  },

  rescan: async () => {
    try {
      await api.scanLibraryRoots();
      // Don't await — the scan runs in the background.
      set((s) => ({ status: { ...s.status, scanning: true } }));
    } catch (e) {
      set({ error: String(e) });
    }
  },

  pollStatus: async () => {
    try {
      const status = await api.getIndexStatus();
      set({ status });
      // Auto-refresh roots when a scan finishes so counts update.
      if (!status.scanning && get().status.scanning) {
        await get().loadRoots();
      }
    } catch {
      /* silent — polling */
    }
  },
}));
