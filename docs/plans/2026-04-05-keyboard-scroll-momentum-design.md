# Keyboard Scroll Momentum — Design

**Date**: 2026-04-05
**Goal**: Replace the fixed 80px scroll jumps with a physics-based momentum system so keyboard/click scrolling feels as smooth and expressive as trackpad scrolling.

---

## Problem

`usePianoScroll` does `lenis.scrollTo(scroll + 80)` per keypress — discrete 80px jumps. Holding a key causes uncontrolled rapid scrolling from browser key repeat (~30/s). No deceleration curve, no rhythm sensitivity, no inertia.

## Solution

A self-contained physics loop inside `usePianoScroll`. Keypresses add energy to an accumulator. A rAF loop converts energy into smooth scroll deltas with friction-based deceleration.

```
Keypress → energy += impulse (modulated by rhythm)
                    ↓
              energy *= FRICTION (per frame)
                    ↓
         scrollDelta = energy * VELOCITY_SCALE
         lenis.scrollTo(scroll + delta)  ← per frame, smooth
                    ↓
         (ScrollTrigger detects velocity → AudioMomentum reacts automatically)
```

## Rhythm Detection

Track interval between keypresses to create three natural "gears":

| Gear | Interval | Impulse | Feel |
|------|----------|---------|------|
| Isolated tap | > 400ms | `IMPULSE_BASE` | Gentle push, ~200px travel |
| Rhythmic tapping | 100-400ms | `IMPULSE_BASE × RHYTHM_BONUS` | Momentum builds, flows |
| Key held (repeat) | < 50ms | `IMPULSE_BASE × HOLD_DAMPEN` | Sustained controlled scroll |

## Parameters

| Constant | Value | Effect |
|----------|-------|--------|
| `IMPULSE_BASE` | 0.12 | Energy per isolated tap |
| `FRICTION` | 0.955 | Decay/frame (~1s inertia at 60fps) |
| `VELOCITY_SCALE` | 8 | energy → px/frame conversion |
| `RHYTHM_BONUS` | 1.6 | Multiplier when interval < 400ms |
| `HOLD_DAMPEN` | 0.3 | Multiplier for key repeat (< 50ms) |
| `MAX_ENERGY` | 1.0 | Cap to prevent runaway scrolling |
| `STOP_THRESHOLD` | 0.005 | Below this, stop rAF loop |

## Click on Cinema

Click on `[data-cinema]` area uses the same momentum system: one click = one base impulse. Same inertia, same deceleration.

## What Doesn't Change

- ScrollTrigger + Lenis mouse/trackpad scrolling (untouched)
- AudioMomentum receives impulses automatically via ScrollTrigger velocity detection
- `prefers-reduced-motion` disables the entire system
- Only letter keys a-z trigger (WCAG 2.1.4 compliant)
- No `e.preventDefault()` (preserves screen reader shortcuts)

## rAF Loop

Starts when `energy > STOP_THRESHOLD`, stops when it falls below. Zero CPU cost when idle.

## File

All changes in `src/hooks/usePianoScroll.ts`. Hook grows from ~54 to ~90-100 lines. No new files needed.

## Architecture: Specialized + Shared Impulse

The keyboard momentum accumulator is independent from AudioMomentum (different friction, different output). But they share the same impulse chain: keyboard scroll → Lenis position → ScrollTrigger velocity → AudioMomentum.addImpulse() → audio/visual reaction. No explicit coupling needed.
