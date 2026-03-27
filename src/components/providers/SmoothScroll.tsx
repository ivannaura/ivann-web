"use client";

import { ReactLenis } from "lenis/react";
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

export default function SmoothScroll({ children }: SmoothScrollProps) {
  const lenisRef = useRef<any>(null);

  useEffect(() => {
    // Disable GSAP's lag smoothing — Lenis handles frame timing
    gsap.ticker.lagSmoothing(0);

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
        lerp: 0.08,
        autoRaf: false,
        wheelMultiplier: 1.2,
        touchMultiplier: 0.8,
        syncTouch: true,
      }}
    >
      {children}
    </ReactLenis>
  );
}
