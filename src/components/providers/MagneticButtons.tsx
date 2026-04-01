"use client";

import { useEffect } from "react";

/**
 * Global magnetic button effect — elements with .magnetic-btn class
 * subtly follow the cursor within their bounding box.
 * Desktop only, respects prefers-reduced-motion.
 */
export default function MagneticButtons() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;

    const strength = 0.3;
    let currentBtn: HTMLElement | null = null;

    const onMove = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>(".magnetic-btn");
      if (btn !== currentBtn) {
        if (currentBtn) currentBtn.style.transform = "";
        currentBtn = btn;
      }
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      btn.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
    };

    document.addEventListener("mousemove", onMove, { passive: true });

    return () => {
      document.removeEventListener("mousemove", onMove);
      if (currentBtn) currentBtn.style.transform = "";
    };
  }, []);

  return null;
}
