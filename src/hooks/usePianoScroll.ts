"use client";

import { useEffect } from "react";
import { useLenis } from "lenis/react";

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
  const lenis = useLenis();

  useEffect(() => {
    if (!enabled || !lenis) return;
    // Respect prefers-reduced-motion — no keyboard-triggered scroll
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // Only trigger on letter keys (a-z) to respect WCAG 2.1.4
      // Excludes Space (native page-down), numbers, punctuation, and
      // screen reader shortcuts that happen to be single characters
      if (!/^[a-zA-Z]$/.test(e.key)) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      e.preventDefault();
      lenis.scrollTo(lenis.scroll + scrollThreshold);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, scrollThreshold, lenis]);

  useEffect(() => {
    if (!enabled || !lenis) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("a, button, input, textarea, select, [role='button']")) return;
      if (!target.closest("[data-cinema]")) return;
      lenis.scrollTo(lenis.scroll + scrollThreshold);
    };
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, [enabled, scrollThreshold, lenis]);
}
