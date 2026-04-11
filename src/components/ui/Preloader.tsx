"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import gsap from "gsap";
import { useUIStore } from "@/stores/useUIStore";

/* ───────────────────────────────────────────────────────────── */
/*  Constellation Preloader                                     */
/*  Golden SVG lines converge from viewport edges → center      */
/*  Collapses to a point when buffer >= 99%                     */
/* ───────────────────────────────────────────────────────────── */

interface ConstellationLine {
  /** Start position on a viewport edge (0-100 viewBox units) */
  x1: number;
  y1: number;
  /** End position near center (with slight organic offset) */
  x2: number;
  y2: number;
  /** Total drawn length for stroke-dasharray */
  length: number;
}

/** Generate 14 lines from random edge positions converging near center */
function generateLines(count: number): ConstellationLine[] {
  const lines: ConstellationLine[] = [];
  const cx = 50;
  const cy = 50;

  for (let i = 0; i < count; i++) {
    // Distribute lines across all 4 edges with some randomness
    const edge = i % 4;
    let x1: number, y1: number;

    switch (edge) {
      case 0: // top
        x1 = 10 + Math.random() * 80;
        y1 = -2;
        break;
      case 1: // right
        x1 = 102;
        y1 = 10 + Math.random() * 80;
        break;
      case 2: // bottom
        x1 = 10 + Math.random() * 80;
        y1 = 102;
        break;
      default: // left
        x1 = -2;
        y1 = 10 + Math.random() * 80;
        break;
    }

    // End near center with slight organic offset (not perfect bullseye)
    const offsetX = (Math.random() - 0.5) * 6;
    const offsetY = (Math.random() - 0.5) * 6;
    const x2 = cx + offsetX;
    const y2 = cy + offsetY;

    // Euclidean length in viewBox units
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);

    lines.push({ x1, y1, x2, y2, length });
  }

  return lines;
}

const LINE_COUNT = 14;
// Pre-generate so layout is stable across renders (but random per mount)
let cachedLines: ConstellationLine[] | null = null;
function getLines(): ConstellationLine[] {
  if (!cachedLines) cachedLines = generateLines(LINE_COUNT);
  return cachedLines;
}

export default function Preloader() {
  const [hidden, setHidden] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const lineRefs = useRef<(SVGLineElement | null)[]>([]);
  const flashRef = useRef<SVGCircleElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);

  const setLineRef = useCallback(
    (index: number) => (el: SVGLineElement | null) => {
      lineRefs.current[index] = el;
    },
    [],
  );

  useEffect(() => {
    const container = containerRef.current;
    const svg = svgRef.current;
    const flash = flashRef.current;
    if (!container || !svg || !flash) return;

    let dismissTimeout: ReturnType<typeof setTimeout>;
    let progressInterval: ReturnType<typeof setInterval>;
    let videoEl: HTMLVideoElement | null = null;
    let introComplete = false;
    let exitStarted = false;

    const dismiss = () => {
      useUIStore.getState().setPreloaderDone(true);
      setDismissed(true);
      dismissTimeout = setTimeout(() => setHidden(true), 800);
    };

    // Reduced-motion: skip all animations, dismiss quickly
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const rmTimeout = setTimeout(dismiss, 500);
      return () => {
        clearTimeout(rmTimeout);
        clearTimeout(dismissTimeout);
      };
    }

    // --- Exit sequence: lines converge to center, flash, fade out ---
    const startExit = () => {
      if (exitStarted) return;
      exitStarted = true;
      clearInterval(progressInterval);

      if (pctRef.current) pctRef.current.textContent = "100%";

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        dismiss();
        return;
      }

      const lines = lineRefs.current.filter(Boolean) as SVGLineElement[];
      const tl = gsap.timeline({ onComplete: dismiss });

      // All lines snap endpoints to exact center (50,50)
      tl.to(lines, {
        attr: { x1: 50, y1: 50, x2: 50, y2: 50 },
        duration: 0.5,
        ease: "power3.in",
        stagger: 0.02,
      });

      // Golden flash at center
      tl.fromTo(
        flash,
        { attr: { r: 0 }, opacity: 1 },
        { attr: { r: 8 }, opacity: 0, duration: 0.4, ease: "power2.out" },
        "-=0.15",
      );

      // Fade percentage text
      if (pctRef.current) {
        tl.to(pctRef.current, { opacity: 0, duration: 0.25 }, "-=0.4");
      }

      // Container fade out
      tl.to(container, { opacity: 0, duration: 0.4, ease: "power2.inOut" });
    };

    // --- Buffer progress tracking ---
    const getBufferProgress = (): number => {
      const video = videoEl || document.querySelector("video");
      if (!videoEl && video) videoEl = video;
      if (!video || !video.duration || !video.buffered.length) return 0;
      let maxEnd = 0;
      for (let i = 0; i < video.buffered.length; i++) {
        if (video.buffered.start(i) <= 0.5) {
          maxEnd = Math.max(maxEnd, video.buffered.end(i));
        }
      }
      return maxEnd / video.duration;
    };

    const isVideoReady = (): boolean => {
      const video = videoEl || document.querySelector("video");
      if (!video) return false;
      return getBufferProgress() >= 0.99;
    };

    const checkReady = () => {
      const progress = getBufferProgress();
      if (pctRef.current) {
        pctRef.current.textContent =
          progress > 0.01
            ? `${Math.round(progress * 100)}%`
            : "Conectando...";
      }
      if (introComplete && isVideoReady()) {
        startExit();
      }
    };

    // Start polling buffer progress immediately
    progressInterval = setInterval(checkReady, 250);
    checkReady();

    // Bind to <video> element — it may mount late (dynamic import).
    // Use MutationObserver to detect it instantly instead of polling.
    const onCanPlayThrough = () => {
      if (introComplete) startExit();
    };
    const bindVideo = (video: HTMLVideoElement) => {
      if (videoEl) return;
      videoEl = video;
      if (video.readyState >= 4) {
        onCanPlayThrough();
      } else {
        video.addEventListener("canplaythrough", onCanPlayThrough, {
          once: true,
        });
      }
      checkReady();
    };

    // Try immediately
    const existing = document.querySelector("video");
    if (existing) {
      bindVideo(existing);
    }

    // Watch for <video> added later by dynamic import
    let observer: MutationObserver | null = null;
    if (!videoEl) {
      observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            if (node instanceof HTMLVideoElement) {
              bindVideo(node);
              observer?.disconnect();
              return;
            }
            if (node instanceof HTMLElement) {
              const vid = node.querySelector("video");
              if (vid) {
                bindVideo(vid);
                observer?.disconnect();
                return;
              }
            }
          }
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    // --- Intro animation: lines draw in from edges toward center ---
    const linesData = getLines();
    const lineEls = lineRefs.current.filter(Boolean) as SVGLineElement[];

    const ctx = gsap.context(() => {
      // Set initial state: each line fully hidden via stroke-dashoffset
      lineEls.forEach((line, i) => {
        const data = linesData[i];
        if (!data) return;
        // Scale the SVG viewBox length to approximate rendered pixel length
        // We use the viewBox-unit length directly since dasharray is in viewBox coords
        const len = data.length;
        gsap.set(line, {
          attr: { "stroke-dasharray": len, "stroke-dashoffset": len },
          opacity: 0,
        });
      });

      const tl = gsap.timeline({
        onComplete: () => {
          introComplete = true;
          if (isVideoReady()) {
            startExit();
          }
        },
      });

      // Lines fade in and draw toward center with stagger
      lineEls.forEach((line, i) => {
        const data = linesData[i];
        if (!data) return;
        const delay = i * 0.07;

        tl.to(
          line,
          { opacity: 0.7 + Math.random() * 0.3, duration: 0.3 },
          delay,
        );
        tl.to(
          line,
          {
            attr: { "stroke-dashoffset": 0 },
            duration: 1.2 + Math.random() * 0.4,
            ease: "power2.inOut",
          },
          delay,
        );
      });

      // Brief hold so the constellation is visible before exit check
      tl.to({}, { duration: 0.3 });
    }, container);

    // Fallback: force dismiss after 45s
    const fallback = setTimeout(() => {
      if (!exitStarted) startExit();
    }, 45000);

    return () => {
      ctx.revert();
      clearTimeout(fallback);
      clearTimeout(dismissTimeout);
      clearInterval(progressInterval);
      observer?.disconnect();
      if (videoEl) {
        videoEl.removeEventListener("canplaythrough", onCanPlayThrough);
      }
    };
  }, []);

  if (hidden) return null;

  const lines = getLines();

  return (
    <div
      ref={containerRef}
      role="status"
      aria-live="polite"
      aria-label="Cargando IVANN AURA"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100000,
        background: "var(--bg-void)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: dismissed ? "none" : "auto",
      }}
    >
      {/* Subtle grain texture overlay */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: 0.08,
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")",
          backgroundRepeat: "repeat",
        }}
      />

      {/* SVG constellation container */}
      <svg
        ref={svgRef}
        aria-hidden="true"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      >
        {/* Converging golden lines */}
        {lines.map((line, i) => (
          <line
            key={i}
            ref={setLineRef(i)}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke="var(--aura-gold)"
            strokeWidth={0.15}
            strokeLinecap="round"
            opacity={0}
          />
        ))}

        {/* Golden flash circle at center (hidden until exit) */}
        <circle
          ref={flashRef}
          cx={50}
          cy={50}
          r={0}
          fill="none"
          stroke="var(--aura-gold-bright)"
          strokeWidth={0.3}
          opacity={0}
        />
      </svg>

      {/* Loading percentage — bottom-right */}
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
        Conectando...
      </span>
    </div>
  );
}
