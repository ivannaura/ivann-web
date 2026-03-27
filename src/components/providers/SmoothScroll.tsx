"use client";

import { ReactLenis, useLenis } from "lenis/react";
import { useEffect, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * Bridges Lenis smooth scroll with GSAP ScrollTrigger.
 * Ensures ScrollTrigger updates on every Lenis frame for perfect sync.
 */
function LenisGSAPBridge() {
  useLenis(() => {
    ScrollTrigger.update();
  });

  useEffect(() => {
    // Disable GSAP's lag smoothing — Lenis handles frame timing
    gsap.ticker.lagSmoothing(0);
  }, []);

  return null;
}

interface SmoothScrollProps {
  children: ReactNode;
}

export default function SmoothScroll({ children }: SmoothScrollProps) {
  return (
    <ReactLenis root options={{ lerp: 0.1, duration: 1.2 }}>
      <LenisGSAPBridge />
      {children}
    </ReactLenis>
  );
}
