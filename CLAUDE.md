# IVANN AURA — Scroll Cinema Website

@AGENTS.md

## Project

Awwwards-quality immersive website for IVANN AURA, a Colombian pianist and live show performer. The entire page is a single scroll-driven cinematic experience built on top of his concert video "Flamenco de Esfera".

## Stack

- **Next.js 16.2.1** (App Router, Turbopack)
- **React 19.2.4** + TypeScript
- **Tailwind CSS v4** (with `@theme inline` custom properties)
- **GSAP + ScrollTrigger** for scroll-driven video orchestration (`scrub: 1.5`)
- **Lenis** for smooth scrolling (single RAF loop via GSAP ticker, `autoRaf: false`)
- **WebGL2** for unified cinema rendering (video post-processing + luminance-reactive particles)
- **Zustand** for UI state (cursor, menu)

## Architecture

```
page.tsx
 ├── CustomCursor          (dot + ring following mouse, desktop only)
 ├── Navigation            (fixed nav, scroll progress, mobile <dialog>, sound toggle)
 ├── PianoIndicator        (energy-driven equalizer, bottom-left)
 │
 ├── ScrollVideoPlayer     (GSAP ScrollTrigger → video.currentTime + unified WebGL2 canvas)
 │    ├── CinemaGL         (unified renderer: video shaders + luminance-reactive particles)
 │    ├── AudioMomentum    (physics engine: impulse → energy → playbackRate + mute toggle)
 │    └── ScrollStoryOverlay (20+ frame-synced story beats over video)
 │
 ├── Contact               (booking form + social links)
 └── Footer                (branding, socials, quote)
```

### Key Components

| Component | File | Purpose |
|-----------|------|---------|
| `ScrollVideoPlayer` | `ui/ScrollVideoPlayer.tsx` | GSAP ScrollTrigger + unified WebGL2 canvas + AudioMomentum |
| `CinemaGL` | `lib/cinema-gl.ts` | Unified WebGL2: video post-processing + luminance-reactive particles (single context) |
| `AudioMomentum` | `lib/audio-momentum.ts` | Physics engine: energy/friction → playbackRate + volume + mute + visibility pause |
| `ScrollStoryOverlay` | `ui/ScrollStoryOverlay.tsx` | 20+ story beats with fade/slide/typewriter animations |
| `usePianoScroll` | `hooks/usePianoScroll.ts` | Letter keys (a-z) / click → smooth scroll forward |
| `PianoIndicator` | `ui/PianoIndicator.tsx` | Energy-driven equalizer (gold when energy > 0.3) |
| `Navigation` | `ui/Navigation.tsx` | Fixed nav, scroll progress, native `<dialog>` mobile menu, sound toggle |
| `CustomCursor` | `ui/CustomCursor.tsx` | Animated dot + ring cursor (desktop only) |
| `Preloader` | `ui/Preloader.tsx` | Branded loading screen (1.8s ease-out) |
| `SmoothScroll` | `providers/SmoothScroll.tsx` | Lenis + GSAP single RAF loop (lerp 0.08, autoRaf false) |

### Deleted (previously dead code)

- `ScrollFramePlayer.tsx`, `Hero.tsx`, `Experience.tsx`, `Music.tsx`, `LiveShow.tsx` — removed in audit cleanup
- `particles-gl.ts` — merged into `cinema-gl.ts` (single WebGL2 context)
- `frames/all/` — 49MB obsolete frame sequence (gitignored)

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

Constants: `IMPULSE=0.2`, `FRICTION=0.985`, `MIN_RATE=0.25`, `MAX_RATE=1.0`, `MAX_VOLUME=0.7`, `PLAY_THRESHOLD=0.05`, `STOP_THRESHOLD=0.02`, `DRIFT_THRESHOLD=3.0s`

Energy half-life: FRICTION=0.985 → ~46 frames ≈ 766ms at 60fps.

## Scroll → Video Pipeline (GSAP ScrollTrigger)

1. Lenis smooth-scrolls the page (`lerp: 0.08`, `autoRaf: false`)
2. GSAP ticker drives Lenis (`gsap.ticker.add → lenis.raf`) — single RAF loop
3. ScrollTrigger (`scrub: 1.5`) maps scroll progress (0-1) to video timeline
4. `onUpdate` clamps to buffered range, sets `video.currentTime`, reports frame changes
5. Scroll velocity > 50px/s triggers `AudioMomentum.addImpulse()`
6. A rAF render loop uploads video frames to WebGL2 canvas with post-processing + particles

## Unified WebGL2 Cinema

`cinema-gl.ts` renders video through a single WebGL2 context with two shader programs:

**Pass 1 — Video post-processing** (fullscreen quad):
- **Chromatic aberration**: RGB channel offset at edges, amplified by scroll energy and narrative mood
- **Vignette**: Edge darkening, tighter during intense acts
- **Film grain**: Animated noise for organic texture
- **Soft bloom**: Glow on highlights, lower threshold at peak acts

**Pass 2 — Luminance-reactive particles** (250 GL_POINTS, additive blending):
- Particles sample the video texture for luminance at their position
- Brighter video areas → larger, more visible particles
- Luminance gradient nudges particles toward bright areas (pianist's hands, stage lights)
- Colors shift from warm white (#FFFDE8) to gold (#E8C85A) with energy
- Speed: `0.05 + energy * 0.95` (VISION "Regla de Oro" — tied to scroll)

**Dynamic narrative mood** via `u_progress` uniform — all effects scale per act:
Despertar (0.5) → Entrada (0.6) → Danza (0.8) → Espectáculo (0.9) → Fuego (1.1) → Clímax (1.2) → Resolución (0.8) → Cierre (0.5)

Falls back to raw `<video>` element if WebGL2 unavailable. Canvas sized to viewport with DPR capping.

## Design Tokens (CSS Custom Properties)

```
--bg-void: #050508       --bg-surface: #0A0A10      --bg-subtle: #12121A
--text-primary: #F0EDE6  --text-secondary: #8A8A99  --text-muted: #4A4A5A
--aura-gold: #C9A84C     --aura-gold-bright: #E8C85A  --aura-gold-dim: #8A7435
--crimson: #6B1520       --deep-blue: #1A2D5A       --electric-blue: #2E5BFF
--particle-core: #FFFDE8 --border-subtle: rgba(255,255,255,0.06)
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

## SEO

- Complete Open Graph + Twitter Card metadata with OG image
- JSON-LD structured data (MusicEvent + Person schema)
- `sitemap.xml` and `robots.txt` auto-generated via Next.js App Router
- Video preload hint in `<head>` for faster LCP
- `prefers-reduced-motion` disables all animations

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
- `object-cover` on video/canvas for fullscreen display
- Frame indices use 3fps equivalence: `frameIndex = Math.floor(videoTime * 3)`
- Story beats in ScrollStoryOverlay use these frame indices for timing
- Mobile menu uses native `<dialog>` with `showModal()` for WCAG-compliant focus management
- See `docs/CONVENTIONS.md` for full technical conventions
