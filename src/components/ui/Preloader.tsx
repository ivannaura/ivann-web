"use client";

import { useEffect, useState } from "react";
import { useUIStore } from "@/stores/useUIStore";

export default function Preloader() {
  const [progress, setProgress] = useState(0);
  const [hidden, setHidden] = useState(false);
  const setLoaded = useUIStore((s) => s.setLoaded);

  useEffect(() => {
    let frame: number;
    let dismissTimer: ReturnType<typeof setTimeout>;
    let start: number | null = null;
    const duration = 1800;

    const animate = (ts: number) => {
      if (!start) start = ts;
      const elapsed = ts - start;
      const p = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setProgress(eased * 100);

      if (p < 1) {
        frame = requestAnimationFrame(animate);
      } else {
        // Fade out then hide
        dismissTimer = setTimeout(() => {
          setHidden(true);
          setLoaded(true);
        }, 500);
      }
    };

    frame = requestAnimationFrame(animate);

    // Safety fallback — always dismiss after 4s
    const fallback = setTimeout(() => {
      setHidden(true);
      setLoaded(true);
    }, 4000);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(dismissTimer);
      clearTimeout(fallback);
    };
  }, [setLoaded]);

  if (hidden) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100000,
        background: "var(--bg-void)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        opacity: progress >= 100 ? 0 : 1,
        transition: "opacity 0.5s ease-out",
        pointerEvents: progress >= 100 ? "none" : "auto",
      }}
    >
      <div style={{ marginBottom: 32 }}>
        <span
          style={{
            fontSize: 14,
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
          }}
        >
          IVANN AURA
        </span>
      </div>
      <div
        style={{
          width: 120,
          height: 1,
          background: "var(--text-muted)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            height: "100%",
            width: `${progress}%`,
            background: "var(--aura-gold)",
            transition: "width 0.1s ease-out",
          }}
        />
      </div>
      <div style={{ marginTop: 16 }}>
        <span
          style={{
            fontSize: 12,
            fontFamily: "monospace",
            color: "var(--text-muted)",
          }}
        >
          {Math.round(progress)}%
        </span>
      </div>
    </div>
  );
}
