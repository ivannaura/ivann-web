"use client";

import { create } from "zustand";

interface UIState {
  menuOpen: boolean;
  cursorVariant: "default" | "hover" | "hidden";
  toggleMenu: () => void;
  setMenuOpen: (open: boolean) => void;
  setCursorVariant: (variant: UIState["cursorVariant"]) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  menuOpen: false,
  cursorVariant: "default",
  toggleMenu: () => set((s) => ({ menuOpen: !s.menuOpen })),
  setMenuOpen: (open) => set({ menuOpen: open }),
  setCursorVariant: (variant) => set({ cursorVariant: variant }),
}));
