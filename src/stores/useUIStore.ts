"use client";

import { create } from "zustand";

interface UIState {
  isLoaded: boolean;
  currentSection: number;
  menuOpen: boolean;
  cursorVariant: "default" | "hover" | "text" | "hidden";
  scrollProgress: number;
  setLoaded: (loaded: boolean) => void;
  setSection: (section: number) => void;
  toggleMenu: () => void;
  setMenuOpen: (open: boolean) => void;
  setCursorVariant: (variant: UIState["cursorVariant"]) => void;
  setScrollProgress: (progress: number) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  isLoaded: false,
  currentSection: 0,
  menuOpen: false,
  cursorVariant: "default",
  scrollProgress: 0,
  setLoaded: (loaded) => set({ isLoaded: loaded }),
  setSection: (section) => set({ currentSection: section }),
  toggleMenu: () => set((s) => ({ menuOpen: !s.menuOpen })),
  setMenuOpen: (open) => set({ menuOpen: open }),
  setCursorVariant: (variant) => set({ cursorVariant: variant }),
  setScrollProgress: (progress) => set({ scrollProgress: progress }),
}));
