// ============================================================
// WMDM Desktop App — Audio Player Store (Zustand)
// ============================================================

import { create } from "zustand";
import type { Product } from "../types";

interface PlayerState {
  currentTrack: Product | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  audio: HTMLAudioElement | null;

  play: (product: Product) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  toggle: (product: Product) => void;
  seek: (time: number) => void;
  setVolume: (vol: number) => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.8,
  audio: null,

  play: (product: Product) => {
    const { audio: existing, currentTrack } = get();

    // If same track, just resume
    if (currentTrack?.id === product.id && existing) {
      existing.play();
      set({ isPlaying: true });
      return;
    }

    // Stop current track
    if (existing) {
      existing.pause();
      existing.src = "";
    }

    if (!product.streamUrl) return;

    const audio = new Audio(product.streamUrl);
    audio.volume = get().volume;

    audio.addEventListener("timeupdate", () => {
      set({ currentTime: audio.currentTime });
    });

    audio.addEventListener("loadedmetadata", () => {
      set({ duration: audio.duration });
    });

    audio.addEventListener("ended", () => {
      set({ isPlaying: false, currentTime: 0 });
    });

    audio.addEventListener("error", () => {
      set({ isPlaying: false });
    });

    audio.play();
    set({ audio, currentTrack: product, isPlaying: true, currentTime: 0 });
  },

  pause: () => {
    get().audio?.pause();
    set({ isPlaying: false });
  },

  resume: () => {
    get().audio?.play();
    set({ isPlaying: true });
  },

  stop: () => {
    const { audio } = get();
    if (audio) {
      audio.pause();
      audio.src = "";
    }
    set({ currentTrack: null, isPlaying: false, currentTime: 0, duration: 0, audio: null });
  },

  toggle: (product: Product) => {
    const { currentTrack, isPlaying } = get();
    if (currentTrack?.id === product.id) {
      if (isPlaying) {
        get().pause();
      } else {
        get().resume();
      }
    } else {
      get().play(product);
    }
  },

  seek: (time: number) => {
    const { audio } = get();
    if (audio) {
      audio.currentTime = time;
      set({ currentTime: time });
    }
  },

  setVolume: (vol: number) => {
    const { audio } = get();
    if (audio) audio.volume = vol;
    set({ volume: vol });
  },
}));
