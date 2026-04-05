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

  return (
    <div
      aria-hidden="true"
      className="fixed bottom-8 left-8 z-[997] flex items-end gap-3 transition-opacity duration-700"
      style={{ opacity: isActive ? 1 : 0.4 }}
    >
      {/* Equalizer bars — frequency-reactive */}
      <div className="flex items-end gap-[2px] h-5">
        {barHeights.map((h, i) => (
          <div
            key={i}
            className="w-[2px] rounded-[1px] transition-all duration-150"
            style={{
              height: `${h * (20 + energy * 80)}%`,
              background: isGold
                ? "var(--aura-gold)"
                : "var(--text-muted)",
            }}
          />
        ))}
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
