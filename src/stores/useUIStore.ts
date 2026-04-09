import { create } from "zustand";

type CursorVariant = "default" | "hover" | "hidden";

interface UIState {
  menuOpen: boolean;
  cursorVariant: CursorVariant;
  cursorLabel: string | null;
  soundMuted: boolean;
  toggleMenu: () => void;
  setMenuOpen: (open: boolean) => void;
  setCursorVariant: (variant: CursorVariant) => void;
  setCursorLabel: (label: string | null) => void;
  setSoundMuted: (muted: boolean) => void;
  toggleSoundMuted: () => void;
}

const getInitialMuted = (): boolean => {
  if (typeof window === 'undefined') return false;
  try { return localStorage.getItem('ivann-sound-muted') === 'true'; } catch { return false; }
};

export const useUIStore = create<UIState>()((set) => ({
  menuOpen: false,
  cursorVariant: "default" as CursorVariant,
  cursorLabel: null,
  soundMuted: getInitialMuted(),
  toggleMenu: () => set((s) => ({ menuOpen: !s.menuOpen })),
  setMenuOpen: (open) => set({ menuOpen: open }),
  setCursorVariant: (variant) => set({ cursorVariant: variant }),
  setCursorLabel: (label) => set({ cursorLabel: label }),
  setSoundMuted: (muted) => {
    try { localStorage.setItem('ivann-sound-muted', String(muted)); } catch {}
    set({ soundMuted: muted });
  },
  toggleSoundMuted: () => set((s) => {
    const next = !s.soundMuted;
    try { localStorage.setItem('ivann-sound-muted', String(next)); } catch {}
    return { soundMuted: next };
  }),
}));
