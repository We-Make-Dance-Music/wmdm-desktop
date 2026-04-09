// ============================================================
// WMDM Desktop App — Settings Store (Zustand)
// ============================================================

import { create } from "zustand";
import type { AppSettings, DawInfo } from "../types";
import * as api from "../api/tauri";

interface SettingsState {
  settings: AppSettings;
  dawConfig: DawInfo[];
  isLoading: boolean;
  isDawDetecting: boolean;

  loadSettings: () => Promise<void>;
  saveSetting: (key: string, value: string | number | boolean) => Promise<void>;
  detectDaws: () => Promise<void>;
  setDawPath: (daw: string, path: string) => Promise<void>;
  setDownloadPath: () => Promise<void>;
}

const DEFAULT_SETTINGS: AppSettings = {
  downloadPath: "",
  maxConcurrentDownloads: 3,
  autoUpdate: true,
  launchAtStartup: false,
  notificationsEnabled: true,
  theme: "dark",
  firstRunComplete: false,
};

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: { ...DEFAULT_SETTINGS },
  dawConfig: [],
  isLoading: false,
  isDawDetecting: false,

  loadSettings: async () => {
    set({ isLoading: true });
    try {
      const [settings, dawConfig] = await Promise.all([
        api.getSettings(),
        api.getDawConfig(),
      ]);
      set({
        settings,
        dawConfig: dawConfig.daws,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  saveSetting: async (key: string, value: string | number | boolean) => {
    try {
      await api.setSetting(key, value);
      set((state) => ({
        settings: { ...state.settings, [key]: value },
      }));
    } catch (err) {
      throw err;
    }
  },

  detectDaws: async () => {
    set({ isDawDetecting: true });
    try {
      const daws = await api.detectDaws();
      set({ dawConfig: daws, isDawDetecting: false });
    } catch {
      set({ isDawDetecting: false });
    }
  },

  setDawPath: async (daw: string, path: string) => {
    await api.setDawPath(daw, path);
    set((state) => ({
      dawConfig: state.dawConfig.map((d) =>
        d.slug === daw ? { ...d, contentPath: path } : d
      ),
    }));
  },

  setDownloadPath: async () => {
    const path = await api.pickFolder();
    if (path) {
      await api.setDownloadPath(path);
      set((state) => ({
        settings: { ...state.settings, downloadPath: path },
      }));
    }
  },
}));
