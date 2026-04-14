"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { createFractalRenderer, type FractalRenderer } from "@/lib/fractal-gl";
import { useUIStore } from "@/stores/useUIStore";
import { primerAudioContext } from "@/lib/shared-audio-context";

/* ───────────────────────────────────────────────────────────── */
/*  Fractal Preloader                                           */
/*  Julia Set fractal implodes over ~3.5s, then explodes with   */
/*  a golden flash revealing the portal underneath.             */
/* ───────────────────────────────────────────────────────────── */

export default function FractalPreloader() {
  const [hidden, setHidden] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fractalRef = useRef<FractalRenderer | null>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Prime audio context for iOS — registers touchstart/click listeners
    // that resume the AudioContext on the first real user gesture
    primerAudioContext();

    // Try to create the fractal renderer (returns null if no WebGL or reduced-motion)
    const fractal = createFractalRenderer(canvas);
    fractalRef.current = fractal;

    // --- Reduced-motion / no WebGL fallback ---
    if (!fractal) {
      const fallbackTimeout = setTimeout(() => {
        useUIStore.getState().setPreloaderDone(true);
        setDismissed(true);
        setTimeout(() => setHidden(true), 400);
      }, 1000);
      return () => clearTimeout(fallbackTimeout);
    }

    // --- Resize handler ---
    const handleResize = () => fractal.resize();
    window.addEventListener("resize", handleResize);

    // --- Exit sequence ---
    let exitStarted = false;
    const startExit = () => {
      if (exitStarted) return;
      exitStarted = true;

      const flash = flashRef.current;
      const tl = gsap.timeline();

      // Step 1: Golden flash overlay fades in
      if (flash) {
        tl.to(flash, { opacity: 1, duration: 0.2, ease: "power2.out" });
      }

      // Step 2: Fractal canvas fades out
      tl.to(canvas, { opacity: 0, duration: 0.3, ease: "power2.inOut" }, "+=0.05");

      // Step 3: Flash fades out
      if (flash) {
        tl.to(flash, { opacity: 0, duration: 0.3, ease: "power2.inOut" }, "-=0.15");
      }

      // Step 4: Container dismissed (CSS transition handles fade)
      tl.call(() => {
        setDismissed(true);
      });

      // Step 5: Signal preloader done → triggers particle burst in portal
      tl.call(
        () => {
          useUIStore.getState().setPreloaderDone(true);
        },
        undefined,
        "+=0.2",
      );

      // Step 6: Remove from DOM after fade-out transition completes
      tl.call(
        () => {
          setHidden(true);
        },
        undefined,
        "+=0.35",
      );
    };

    // --- Animate progress 0 → 1 over ~3.5 seconds ---
    const proxy = { progress: 0 };
    const tween = gsap.to(proxy, {
      progress: 1,
      duration: 3.5,
      ease: "power2.in", // slow start, accelerating collapse
      onUpdate: () => {
        fractal.setProgress(proxy.progress);
        // Update percentage text (decorative — timed animation, not load-dependent)
        if (pctRef.current) {
          pctRef.current.textContent = `${Math.round(proxy.progress * 100)}%`;
        }
      },
      onComplete: () => startExit(),
    });

    return () => {
      tween.kill();
      window.removeEventListener("resize", handleResize);
      fractalRef.current?.destroy();
      fractalRef.current = null;
    };
  }, []);

  if (hidden) return null;

  // --- Reduced-motion / no WebGL: simple text fallback ---
  const isReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Cargando IVANN AURA"
      className={`fixed inset-0 z-[100000] transition-opacity duration-300 ${
        dismissed ? "opacity-0 pointer-events-none" : ""
      }`}
      style={{ background: "var(--bg-void)" }}
    >
      {isReducedMotion ? (
        /* Reduced-motion fallback: simple centered text */
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            style={{
              fontFamily: "var(--font-display)",
              color: "var(--aura-gold)",
              fontSize: "clamp(18px, 3vw, 28px)",
              letterSpacing: "0.3em",
            }}
          >
            IVANN AURA
          </span>
        </div>
      ) : (
        <>
          {/* WebGL fractal canvas */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
            aria-hidden="true"
          />

          {/* Golden flash overlay */}
          <div
            ref={flashRef}
            className="absolute inset-0 opacity-0 pointer-events-none"
            aria-hidden="true"
            style={{
              background:
                "radial-gradient(circle at 50% 50%, rgba(201,168,76,0.6), transparent 70%)",
            }}
          />

          {/* Progress percentage — bottom-right */}
          <span
            ref={pctRef}
            aria-hidden="true"
            style={{
              position: "absolute",
              bottom: "clamp(16px, 4vh, 32px)",
              right: "clamp(16px, 4vw, 32px)",
              fontSize: "clamp(11px, 1.2vw, 13px)",
              letterSpacing: "0.3em",
              color: "var(--text-muted)",
              fontFamily: "var(--font-body)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            0%
          </span>
        </>
      )}
    </div>
  );
}
