"use client";

import { useEffect, useState } from "react";

interface PianoIndicatorProps {
  energy: number;
}

/**
 * Visual indicator showing current audio energy.
 * Displays a subtle equalizer-like animation in the bottom-left corner
 * driven by the AudioMomentum energy level.
 */
export default function PianoIndicator({ energy }: PianoIndicatorProps) {
  const [showHint, setShowHint] = useState(true);

  const isActive = energy > 0.02;

  // Hide hint when user starts interacting
  useEffect(() => {
    if (isActive) setShowHint(false);
  }, [isActive]);

  // Hide hint after 8 seconds regardless
  useEffect(() => {
    const t = setTimeout(() => setShowHint(false), 8000);
    return () => clearTimeout(t);
  }, []);

  const bars = [0.3, 0.6, 1, 0.7, 0.4];
  const isGold = energy > 0.3;

  return (
    <div
      className="fixed bottom-8 left-8 z-[997] flex items-end gap-3 transition-opacity duration-700"
      style={{ opacity: isActive ? 1 : 0.4 }}
    >
      {/* Equalizer bars */}
      <div className="flex items-end gap-[2px] h-5">
        {bars.map((baseH, i) => (
          <div
            key={i}
            className="w-[2px] rounded-[1px] transition-all duration-150"
            style={{
              height: `${baseH * (20 + energy * 80)}%`,
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
          Scroll o presiona teclas ♪
        </span>
      )}
    </div>
  );
}
