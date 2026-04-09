"use client";

import { ReactLenis, type LenisRef } from "lenis/react";
import { useEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * Bridges Lenis smooth scroll with GSAP ScrollTrigger via a single RAF loop.
 * Lenis runs with autoRaf: false — GSAP's ticker drives both systems,
 * eliminating frame timing conflicts between two separate loops.
 */

interface SmoothScrollProps {
  children: ReactNode;
}

// iOS: syncTouch hijacks native momentum scrolling, causing janky scroll +
// conflict with Safari's rubber-band physics. Detect once at module load.
const isIOS = typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

export default function SmoothScroll({ children }: SmoothScrollProps) {
  const lenisRef = useRef<LenisRef>(null);

  useEffect(() => {
    // Disable GSAP's lag smoothing — Lenis handles frame timing
    gsap.ticker.lagSmoothing(500, 33);

    // Drive Lenis from GSAP's ticker (single unified RAF loop)
    const tickerCallback = (time: number) => {
      lenisRef.current?.lenis?.raf(time * 1000);
    };

    gsap.ticker.add(tickerCallback);

    return () => {
      gsap.ticker.remove(tickerCallback);
    };
  }, []);

  return (
    <ReactLenis
      ref={lenisRef}
      root
      options={{
        lerp: 0.12, // was 0.08 — faster catch-up reduces sustained video seeking load during fast scroll
        autoRaf: false,
        wheelMultiplier: 1.2,
        touchMultiplier: 0.8,
        gestureOrientation: "vertical",
        syncTouch: !isIOS,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      }}
    >
      {children}
    </ReactLenis>
  );
}
