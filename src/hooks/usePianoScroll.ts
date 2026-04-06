"use client";

import { useEffect, useRef } from "react";
import { useLenis } from "lenis/react";

// ---------------------------------------------------------------------------
// Physics constants
// ---------------------------------------------------------------------------
const IMPULSE_BASE = 0.12; // energy per isolated tap
const FRICTION = 0.955; // decay per frame (~1s inertia at 60fps)
const VELOCITY_SCALE = 8; // energy → px/frame
const RHYTHM_BONUS = 1.6; // multiplier when tapping rhythmically (< 400ms)
const HOLD_DAMPEN = 0.3; // multiplier for held key repeat (< 50ms)
const MAX_ENERGY = 1.0; // cap to prevent runaway
const STOP_THRESHOLD = 0.005; // below this, stop the rAF loop
const RHYTHM_WINDOW = 400; // ms — taps faster than this get bonus
const REPEAT_THRESHOLD = 50; // ms — intervals below this = held key

interface UsePianoScrollOptions {
  /** Enable/disable the scroll-on-keypress/click system */
  enabled?: boolean;
  /** Callback when M key is pressed to toggle mute */
  onMuteToggle?: () => void;
}

/**
 * Physics-based keyboard/click scroll. Each interaction adds energy to a
 * momentum accumulator. A rAF loop converts energy into smooth scroll with
 * friction-based deceleration. Rhythmic tapping builds momentum; holding a
 * key produces sustained gentle scroll. The resulting scroll velocity is
 * detected by ScrollTrigger → AudioMomentum reacts automatically.
 */
export function usePianoScroll(options: UsePianoScrollOptions = {}) {
  const { enabled = true, onMuteToggle } = options;
  const lenis = useLenis();

  // Physics state — refs to avoid re-renders
  const energyRef = useRef(0);
  const rafRef = useRef(0);
  const runningRef = useRef(false);
  const lastTapRef = useRef(0);
  const lastTimeRef = useRef(0);
  // Stable ref to lenis so the rAF loop always has the latest instance
  const lenisRef = useRef(lenis);
  lenisRef.current = lenis;
  // Stable ref to mute toggle callback
  const muteToggleRef = useRef(onMuteToggle);
  muteToggleRef.current = onMuteToggle;

  // --- Physics loop (starts on demand, stops when idle) ---
  useEffect(() => {
    if (!enabled) return;

    const tick = () => {
      const l = lenisRef.current;
      if (!l || energyRef.current < STOP_THRESHOLD) {
        energyRef.current = 0;
        runningRef.current = false;
        return;
      }

      // Delta-time friction
      const now = performance.now();
      const dt = lastTimeRef.current ? Math.min((now - lastTimeRef.current) / 16.667, 3) : 1;
      lastTimeRef.current = now;
      energyRef.current *= Math.pow(FRICTION, dt);

      // Convert energy to scroll delta (dt-scaled)
      const delta = energyRef.current * VELOCITY_SCALE * dt;
      l.scrollTo(l.scroll + delta);

      rafRef.current = requestAnimationFrame(tick);
    };

    const startLoop = () => {
      if (runningRef.current) return;
      runningRef.current = true;
      lastTimeRef.current = performance.now();
      rafRef.current = requestAnimationFrame(tick);
    };

    // --- Impulse function (shared by keyboard + click) ---
    const addImpulse = () => {
      const now = performance.now();
      const interval = now - lastTapRef.current;
      lastTapRef.current = now;

      let impulse = IMPULSE_BASE;

      if (interval < REPEAT_THRESHOLD) {
        // Held key — dampen to prevent runaway
        impulse *= HOLD_DAMPEN;
      } else if (interval < RHYTHM_WINDOW) {
        // Rhythmic tapping — reward with bonus
        impulse *= RHYTHM_BONUS;
      }

      energyRef.current = Math.min(MAX_ENERGY, energyRef.current + impulse);
      startLoop();
    };

    // Respect prefers-reduced-motion
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // --- Keyboard handler ---
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // Only letter keys (a-z) — WCAG 2.1.4
      if (!/^[a-zA-Z]$/.test(e.key)) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      // M key = mute toggle shortcut (keyboard-only users)
      if (e.key === "m" || e.key === "M") {
        muteToggleRef.current?.();
        // Brief visual feedback for keyboard mute toggle
        const indicator = document.getElementById("piano-indicator");
        if (indicator) {
          indicator.style.opacity = "1";
          setTimeout(() => { indicator.style.opacity = ""; }, 300);
        }
        return;
      }

      // No e.preventDefault() — preserves screen reader browse-mode shortcuts
      addImpulse();
    };

    // --- Click handler (cinema area only) ---
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("a, button, input, textarea, select, [role='button']"))
        return;
      if (!target.closest("[data-cinema]")) return;
      addImpulse();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("click", onClick);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("click", onClick);
      cancelAnimationFrame(rafRef.current);
      runningRef.current = false;
      energyRef.current = 0;
    };
  }, [enabled]);
}
