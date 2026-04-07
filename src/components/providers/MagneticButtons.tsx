"use client";

import { useEffect } from "react";

/**
 * Global magnetic button effect — elements with .magnetic-btn class
 * subtly follow the cursor within their bounding box.
 * Desktop only, respects prefers-reduced-motion.
 *
 * Uses mousemove for tracking + mouseout (bubbles, unlike mouseleave)
 * for resetting transform when cursor exits a button.
 */
export default function MagneticButtons() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;

    const strength = 0.3;
    let currentBtn: HTMLElement | null = null;
    let cachedRect: DOMRect | null = null;

    const onMove = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>(".magnetic-btn");
      if (btn !== currentBtn) {
        if (currentBtn) currentBtn.style.transform = "";
        currentBtn = btn;
        cachedRect = btn ? btn.getBoundingClientRect() : null;
      }
      if (!btn || !cachedRect) return;
      // Re-read rect if scroll has moved since last cache (Lenis smooth scroll)
      if (rectStale) {
        cachedRect = btn.getBoundingClientRect();
        rectStale = false;
      }
      const x = e.clientX - cachedRect.left - cachedRect.width / 2;
      const y = e.clientY - cachedRect.top - cachedRect.height / 2;
      btn.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
    };

    // mouseout bubbles (unlike mouseleave), so event delegation works.
    // Fires when cursor leaves a .magnetic-btn for any other element.
    const onOut = (e: MouseEvent) => {
      if (!currentBtn) return;
      const related = e.relatedTarget as HTMLElement | null;
      // If relatedTarget is still inside the same button, ignore
      if (related && currentBtn.contains(related)) return;
      const leaving = (e.target as HTMLElement).closest<HTMLElement>(".magnetic-btn");
      if (leaving === currentBtn) {
        currentBtn.style.transform = "";
        currentBtn = null;
        cachedRect = null;
      }
    };

    // Invalidate cached rect on resize or scroll (layout may have shifted)
    let rectStale = false;
    const onResize = () => {
      cachedRect = null;
    };
    const onScroll = () => {
      rectStale = true;
    };

    document.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseout", onOut, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseout", onOut);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll);
      if (currentBtn) currentBtn.style.transform = "";
    };
  }, []);

  return null;
}
