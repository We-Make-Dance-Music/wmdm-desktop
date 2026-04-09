// Simple store to pass a target URL to the Store page webview
import { create } from "zustand";

interface StoreNavState {
  pendingUrl: string | null;
  setPendingUrl: (url: string | null) => void;
  consumeUrl: () => string | null;
}

export const useStoreNavStore = create<StoreNavState>((set, get) => ({
  pendingUrl: null,
  setPendingUrl: (url) => set({ pendingUrl: url }),
  consumeUrl: () => {
    const url = get().pendingUrl;
    set({ pendingUrl: null });
    return url;
  },
}));
