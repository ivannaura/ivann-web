"use client";

import { create } from "zustand";

interface UIState {
  isLoaded: boolean;
  menuOpen: boolean;
  cursorVariant: "default" | "hover" | "text" | "hidden";
  setLoaded: (loaded: boolean) => void;
  toggleMenu: () => void;
  setMenuOpen: (open: boolean) => void;
  setCursorVariant: (variant: UIState["cursorVariant"]) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  isLoaded: false,
  menuOpen: false,
  cursorVariant: "default",
  setLoaded: (loaded) => set({ isLoaded: loaded }),
  toggleMenu: () => set((s) => ({ menuOpen: !s.menuOpen })),
  setMenuOpen: (open) => set({ menuOpen: open }),
  setCursorVariant: (variant) => set({ cursorVariant: variant }),
}));
