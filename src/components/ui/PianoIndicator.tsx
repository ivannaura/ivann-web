"use client";

import { useEffect, useState } from "react";
import type { FrequencyBands } from "@/lib/audio-momentum";

interface PianoIndicatorProps {
  energy: number;
  bands?: FrequencyBands;
}

/**
 * Visual equalizer driven by real-time audio frequency bands.
 * Each bar maps to a frequency range: bass at center, highs at edges.
 * Falls back to energy-based animation when bands aren't available.
 */
export default function PianoIndicator({ energy, bands }: PianoIndicatorProps) {
  const [showHint, setShowHint] = useState(true);

  const isActive = energy > 0.02;

  useEffect(() => {
    if (isActive) setShowHint(false);
  }, [isActive]);

  useEffect(() => {
    const t = setTimeout(() => setShowHint(false), 8000);
    return () => clearTimeout(t);
  }, []);

  // Bar heights driven by frequency bands (tuned for narrower bass: 0-516Hz)
  const b = bands ?? { bass: 0, mids: 0, highs: 0 };
  const barHeights = [
    0.2 + b.highs * 0.8,   // outer high (broader band → more range)
    0.4 + b.mids * 0.6,    // mid
    0.5 + b.bass * 0.5,    // center bass (narrower band → sharper peaks)
    0.4 + b.mids * 0.6,    // mid
    0.2 + b.highs * 0.8,   // outer high
  ];

  const isGold = energy > 0.3;

  // Per-bar idle animation delays (staggered to avoid synchronous breathing)
  const idleDelays = [0, 0.6, 1.2, 0.4, 0.9];

  return (
    <div
      aria-hidden="true"
      className="fixed z-[997] flex items-end gap-3 transition-opacity duration-700"
      style={{ opacity: isActive ? 1 : 0.4, bottom: "calc(2rem + env(safe-area-inset-bottom))", left: "calc(2rem + env(safe-area-inset-left))" }}
    >
      {/* Equalizer bars — frequency-reactive, cascade stagger from center */}
      <div className="flex items-end gap-[2px] h-5">
        {barHeights.map((h, i) => {
          // Cascade delay: center bar (2) = 0ms, adjacent (1,3) = 20ms, outer (0,4) = 40ms
          const cascadeDelay = Math.abs(i - 2) * 20;
          return (
            <div
              key={i}
              className="w-[2px] rounded-[1px] transition-all duration-150 origin-bottom"
              style={{
                height: `${Math.min(100, h * (20 + energy * 80))}%`,
                transitionDelay: `${cascadeDelay}ms`,
                background: isGold
                  ? "var(--aura-gold)"
                  : "var(--text-muted)",
                // Idle breathing animation when no audio energy
                ...(!isActive ? {
                  animation: `piano-idle ${3 + i * 0.3}s ease-in-out ${idleDelays[i]}s infinite`,
                } : {}),
              }}
            />
          );
        })}
      </div>

      {/* Hint text */}
      {showHint && !isActive && (
        <span
          className="text-[9px] tracking-[0.2em] uppercase animate-pulse"
          style={{ color: "var(--text-muted)" }}
        >
          Scroll o presiona teclas
        </span>
      )}
    </div>
  );
}
