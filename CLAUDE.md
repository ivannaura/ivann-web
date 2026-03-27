# IVANN AURA — Scroll Cinema Website

@AGENTS.md

## Project

Awwwards-quality immersive website for IVANN AURA, a Colombian pianist and live show performer. The entire page is a single scroll-driven cinematic experience built on top of his concert video "Flamenco de Esfera".

## Stack

- **Next.js 16.2.1** (App Router, Turbopack)
- **React 19.2.4** + TypeScript
- **Tailwind CSS v4** (with `@theme inline` custom properties)
- **Lenis** for smooth scrolling (intercepts `window.scrollTo`)
- **Zustand** for UI state (cursor, menu, scroll progress)

## Architecture

```
page.tsx
 ├── CustomCursor          (dot + ring following mouse, desktop only)
 ├── Navigation            (fixed nav, scroll progress, mobile menu)
 ├── PianoIndicator        (energy-driven equalizer, bottom-left)
 │
 ├── ScrollVideoPlayer     (scroll → vinyl inertia → video.currentTime)
 │    ├── AudioMomentum    (physics engine: impulse → energy → playbackRate)
 │    └── ScrollStoryOverlay (20+ frame-synced story beats over video)
 │
 ├── Contact               (booking form + social links)
 └── Footer                (branding, socials, quote)
```

### Key Components

| Component | File | Purpose |
|-----------|------|---------|
| `ScrollVideoPlayer` | `ui/ScrollVideoPlayer.tsx` | Scroll-driven video with vinyl inertia + AudioMomentum |
| `AudioMomentum` | `lib/audio-momentum.ts` | Physics engine: energy/friction → playbackRate + volume |
| `ScrollStoryOverlay` | `ui/ScrollStoryOverlay.tsx` | 20+ story beats with fade/slide/typewriter animations |
| `usePianoScroll` | `hooks/usePianoScroll.ts` | Keyboard/click → smooth scroll forward |
| `PianoIndicator` | `ui/PianoIndicator.tsx` | Energy-driven equalizer (gold when energy > 0.3) |
| `Navigation` | `ui/Navigation.tsx` | Fixed nav, scroll progress bar, mobile hamburger |
| `CustomCursor` | `ui/CustomCursor.tsx` | Animated dot + ring cursor (desktop only) |
| `Preloader` | `ui/Preloader.tsx` | Branded loading screen (1.8s ease-out) |
| `SmoothScroll` | `providers/SmoothScroll.tsx` | Lenis wrapper (lerp 0.1, duration 1.2s) |

### Dead code (safe to delete)

- `ScrollFramePlayer.tsx` — old canvas-based frame player, replaced by ScrollVideoPlayer
- `Hero.tsx`, `Experience.tsx`, `Music.tsx`, `LiveShow.tsx` — original sections, replaced by scroll cinema
- `frames/all/` — 49MB obsolete frame sequence

## Audio Momentum System

Physics-driven audio that responds to user interaction like a vinyl record.

```
User scroll/key/click → addImpulse(0.2)
                              ↓
                    energy += IMPULSE
                    energy *= FRICTION (0.985/frame)
                              ↓
              playbackRate = lerp(0.25, 1.0, energy)
              volume = smoothstep(0, 0.15, energy) * 0.7
                              ↓
                    preservesPitch = false
                    (pitch drops as momentum decays = vinyl slowdown)
```

Constants: `IMPULSE=0.2`, `FRICTION=0.985`, `MIN_RATE=0.25`, `MAX_RATE=1.0`, `MAX_VOLUME=0.7`, `DRIFT_THRESHOLD=3.0s`

## Vinyl Inertia (Scroll → Video)

Scroll does NOT directly set `video.currentTime`. Instead:

1. Scroll sets `scrollTargetRef` (the desired video time)
2. A rAF loop applies exponential ease (`EASE_FACTOR = 0.1`) toward the target, capped at `MAX_SCRUB_SPEED = 3.0` video-seconds per real-second
3. Seeks are clamped to the contiguous buffered range

The exponential ease means the video moves fast when far from target and slows as it approaches — settling quickly after scroll stops. The speed cap prevents jarring jumps during aggressive scrolling.

## Design Tokens (CSS Custom Properties)

```
--bg-void: #050508       --bg-surface: #0A0A10    --bg-subtle: #12121A
--text-primary: #F0EDE6  --text-secondary: #8A8A99  --text-muted: #4A4A5A
--aura-gold: #C9A84C     --crimson: #6B1520
--deep-blue: #1A2D5A     --electric-blue: #2E5BFF
```

## Video Pipeline

Source: `public/videos/flamenco-de-esfera.mp4` (1280x720, 4:06, 67MB)

Optimized for scroll scrubbing:
```bash
ffmpeg -i source.mp4 \
  -vf "crop=in_w:in_w/2.39,scale=960:-2" \
  -c:v libx264 -profile:v high -level 4.2 -pix_fmt yuv420p \
  -crf 30 -g 1 -bf 0 -an \
  -movflags +faststart \
  flamenco-graded.mp4
```

Key flags: `-g 1` (every frame is a keyframe = instant seeking), `-bf 0` (no B-frames), `-an` (audio stripped, separate file used), `+faststart` (moov atom first for CDN seeking).

Output: `public/videos/flamenco-graded.mp4` (960x402, 44MB, all-intra H.264)
Audio: `public/audio/flamenco.m4a` (AAC 128kbps, 3.9MB)

## Commands

```bash
npm run dev          # Dev server (webpack)
npm run build        # Production build (Turbopack)
```

## Public Assets

- `videos/flamenco-graded.mp4` — **44MB, active** (all-keyframe scroll video)
- `videos/flamenco-de-esfera.mp4` — 67MB, original source (fallback)
- `audio/flamenco.m4a` — **3.9MB, active** (momentum-driven audio)

## Conventions

- All overlay content is in Spanish
- Letterbox 2.39:1 aspect ratio to hide corporate banners
- `object-cover` on video element for fullscreen display
- Frame indices use 3fps equivalence: `frameIndex = Math.floor(videoTime * 3)`
- Story beats in ScrollStoryOverlay use these frame indices for timing
- See `docs/CONVENTIONS.md` for full technical conventions
