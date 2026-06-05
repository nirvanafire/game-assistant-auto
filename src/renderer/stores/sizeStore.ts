import { create } from 'zustand';

interface SizeState {
  windowSize: { width: number; height: number } | null;
  browserSize: { width: number; height: number } | null;
  setWindowSize: (size: { width: number; height: number } | null) => void;
  setBrowserSize: (size: { width: number; height: number } | null) => void;
}

export const useSizeStore = create<SizeState>((set) => ({
  windowSize: null,
  browserSize: null,
  setWindowSize: (windowSize) => set({ windowSize }),
  setBrowserSize: (browserSize) => set({ browserSize }),
}));
