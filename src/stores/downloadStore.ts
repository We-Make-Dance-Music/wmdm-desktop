// ============================================================
// WMDM Desktop App — Download Store (Zustand)
// ============================================================

import { create } from "zustand";
import { DownloadStatus } from "../types";
import type {
  DownloadItem,
  Product,
  DownloadProgressEvent,
  DownloadCompleteEvent,
  DownloadErrorEvent,
} from "../types";
import * as api from "../api/tauri";

const MAX_HISTORY = 50;

interface DownloadState {
  queue: DownloadItem[];
  history: DownloadItem[];
  activeCount: number;

  startDownload: (product: Product, linkHash: string) => Promise<void>;
  pauseDownload: (id: string) => Promise<void>;
  resumeDownload: (id: string) => Promise<void>;
  cancelDownload: (id: string) => Promise<void>;
  refreshQueue: () => Promise<void>;
  clearHistory: () => void;

  // Event handlers (called from useEventListener hook)
  handleProgress: (event: DownloadProgressEvent) => void;
  handleComplete: (event: DownloadCompleteEvent) => void;
  handleError: (event: DownloadErrorEvent) => void;
}

function countActive(queue: DownloadItem[]): number {
  return queue.filter(
    (item) =>
      item.status === DownloadStatus.Downloading ||
      item.status === DownloadStatus.Extracting ||
      item.status === DownloadStatus.Placing
  ).length;
}

export const useDownloadStore = create<DownloadState>((set) => ({
  queue: [],
  history: [],
  activeCount: 0,

  startDownload: async (product: Product, linkHash: string) => {
    try {
      const item = await api.startDownload(product.id, linkHash);
      set((state) => {
        const newQueue = [...state.queue, item];
        return {
          queue: newQueue,
          activeCount: countActive(newQueue),
        };
      });
    } catch (err) {
      throw err;
    }
  },

  pauseDownload: async (id: string) => {
    await api.pauseDownload(id);
    set((state) => {
      const newQueue = state.queue.map((item) =>
        item.id === id
          ? { ...item, status: DownloadStatus.Paused, speed: 0 }
          : item
      );
      return { queue: newQueue, activeCount: countActive(newQueue) };
    });
  },

  resumeDownload: async (id: string) => {
    await api.resumeDownload(id);
    set((state) => {
      const newQueue = state.queue.map((item) =>
        item.id === id
          ? { ...item, status: DownloadStatus.Downloading }
          : item
      );
      return { queue: newQueue, activeCount: countActive(newQueue) };
    });
  },

  cancelDownload: async (id: string) => {
    await api.cancelDownload(id);
    set((state) => {
      const newQueue = state.queue.filter((item) => item.id !== id);
      return { queue: newQueue, activeCount: countActive(newQueue) };
    });
  },

  refreshQueue: async () => {
    try {
      const items = await api.getDownloadQueue();
      const active = items.filter(
        (i) =>
          i.status !== DownloadStatus.Complete &&
          i.status !== DownloadStatus.Error
      );
      const completed = items.filter(
        (i) => i.status === DownloadStatus.Complete
      );
      const errored = items.filter(
        (i) => i.status === DownloadStatus.Error
      );
      set({
        queue: [...active, ...errored],
        history: completed.slice(0, MAX_HISTORY),
        activeCount: countActive(active),
      });
    } catch {
      // Queue refresh is best-effort
    }
  },

  clearHistory: () => {
    set({ history: [] });
  },

  handleProgress: (event: DownloadProgressEvent) => {
    set((state) => {
      const newQueue = state.queue.map((item) =>
        item.id === event.id
          ? {
              ...item,
              progress: event.progress,
              bytesDownloaded: event.bytesDownloaded,
              totalBytes: event.totalBytes,
              speed: event.speed,
              eta: event.eta,
              status:
                item.status === DownloadStatus.Queued
                  ? DownloadStatus.Downloading
                  : item.status,
            }
          : item
      );
      return { queue: newQueue, activeCount: countActive(newQueue) };
    });
  },

  handleComplete: (event: DownloadCompleteEvent) => {
    set((state) => {
      const completedItem = state.queue.find((item) => item.id === event.id);
      const newQueue = state.queue.filter((item) => item.id !== event.id);

      let newHistory = state.history;
      if (completedItem) {
        const finished: DownloadItem = {
          ...completedItem,
          status: DownloadStatus.Complete,
          progress: 100,
          outputPath: event.outputPath,
          completedAt: new Date().toISOString(),
          speed: 0,
        };
        newHistory = [finished, ...state.history].slice(0, MAX_HISTORY);
      }

      return {
        queue: newQueue,
        history: newHistory,
        activeCount: countActive(newQueue),
      };
    });
  },

  handleError: (event: DownloadErrorEvent) => {
    set((state) => {
      const newQueue = state.queue.map((item) =>
        item.id === event.id
          ? {
              ...item,
              status: DownloadStatus.Error,
              error: event.error,
              speed: 0,
            }
          : item
      );
      return { queue: newQueue, activeCount: countActive(newQueue) };
    });
  },
}));
