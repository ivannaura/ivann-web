"use client";

import { useEffect } from "react";

interface UsePianoScrollOptions {
  /** Enable/disable the scroll-on-keypress/click system */
  enabled?: boolean;
  /** Pixels to scroll per interaction */
  scrollThreshold?: number;
}

/**
 * Hook that scrolls the page forward on keyboard presses and clicks
 * within the cinema area. The scroll itself triggers momentum-based
 * audio via ScrollVideoPlayer's AudioMomentum integration.
 */
export function usePianoScroll(options: UsePianoScrollOptions = {}) {
  const { enabled = true, scrollThreshold = 80 } = options;

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // Only trigger on letter keys (a-z) to respect WCAG 2.1.4
      // Excludes Space (native page-down), numbers, punctuation, and
      // screen reader shortcuts that happen to be single characters
      if (!/^[a-zA-Z]$/.test(e.key)) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      e.preventDefault();
      window.scrollBy({ top: scrollThreshold, behavior: "smooth" });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, scrollThreshold]);

  useEffect(() => {
    if (!enabled) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("a, button, input, textarea, select, [role='button']")) return;
      if (!target.closest("[data-cinema]")) return;
      window.scrollBy({ top: scrollThreshold, behavior: "smooth" });
    };
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, [enabled, scrollThreshold]);
}
