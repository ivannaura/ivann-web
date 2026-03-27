# IVANN AURA — Scroll Cinema Website

@AGENTS.md

## Project

Awwwards-quality immersive website for IVANN AURA, a Colombian pianist and live show performer. The entire page is a single scroll-driven cinematic experience built on top of his concert video "Flamenco de Esfera".

## Stack

- **Next.js 16.2.1** (App Router, Turbopack)
- **React 19.2.4** + TypeScript
- **Tailwind CSS v4** (with `@theme inline` custom properties)
- **GSAP + ScrollTrigger** for scroll-driven video orchestration (`scrub: 1.5`)
- **Lenis** for smooth scrolling (bridged to GSAP via `useLenis → ScrollTrigger.update`)
- **WebGL** for cinematic post-processing (vignette, chromatic aberration, film grain, bloom)
- **Zustand** for UI state (cursor, menu)

## Architecture

```
page.tsx
 ├── CustomCursor          (dot + ring following mouse, desktop only)
 ├── Navigation            (fixed nav, scroll progress, mobile menu)
 ├── PianoIndicator        (energy-driven equalizer, bottom-left)
 │
 ├── ScrollVideoPlayer     (GSAP ScrollTrigger → video.currentTime + WebGL canvas)
 │    ├── CinemaGL         (WebGL shaders: vignette, chromatic aberration, grain, bloom)
 │    ├── AudioMomentum    (physics engine: impulse → energy → playbackRate)
 │    └── ScrollStoryOverlay (20+ frame-synced story beats over video)
 │
 ├── Contact               (booking form + social links)
 └── Footer                (branding, socials, quote)
```

### Key Components

| Component | File | Purpose |
|-----------|------|---------|
| `ScrollVideoPlayer` | `ui/ScrollVideoPlayer.tsx` | GSAP ScrollTrigger + WebGL canvas + AudioMomentum |
| `CinemaGL` | `lib/cinema-gl.ts` | WebGL post-processing: vignette, chromatic aberration, grain, bloom |
| `AudioMomentum` | `lib/audio-momentum.ts` | Physics engine: energy/friction → playbackRate + volume + visibility pause |
| `ScrollStoryOverlay` | `ui/ScrollStoryOverlay.tsx` | 20+ story beats with fade/slide/typewriter animations |
| `usePianoScroll` | `hooks/usePianoScroll.ts` | Letter keys (a-z) / click → smooth scroll forward |
| `PianoIndicator` | `ui/PianoIndicator.tsx` | Energy-driven equalizer (gold when energy > 0.3) |
| `Navigation` | `ui/Navigation.tsx` | Fixed nav, scroll progress bar, mobile hamburger |
| `CustomCursor` | `ui/CustomCursor.tsx` | Animated dot + ring cursor (desktop only) |
| `Preloader` | `ui/Preloader.tsx` | Branded loading screen (1.8s ease-out) |
| `SmoothScroll` | `providers/SmoothScroll.tsx` | Lenis + GSAP bridge (lerp 0.1, duration 1.2s) |

### Deleted (previously dead code)

- `ScrollFramePlayer.tsx`, `Hero.tsx`, `Experience.tsx`, `Music.tsx`, `LiveShow.tsx` — removed in audit cleanup
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

## Scroll → Video Pipeline (GSAP ScrollTrigger)

GSAP ScrollTrigger replaces the previous manual vinyl inertia system. The entire scroll-to-video pipeline:

1. Lenis smooth-scrolls the page, fires `ScrollTrigger.update()` via bridge
2. ScrollTrigger (`scrub: 1.5`) maps scroll progress (0-1) to video timeline
3. `scrub: 1.5` = GSAP takes 1.5s to catch up → smooth vinyl feel (replaces custom rAF + ease + speed cap)
4. `onUpdate` clamps to buffered range, sets `video.currentTime`, reports frame changes
5. Scroll velocity > 50px/s triggers `AudioMomentum.addImpulse()`
6. A rAF render loop uploads video frames to WebGL canvas with post-processing shaders

## WebGL Cinema (Post-Processing)

`cinema-gl.ts` renders video through GPU fragment shaders:

- **Chromatic aberration**: RGB channel offset at edges, amplified by scroll energy
- **Vignette**: Edge darkening to focus the viewer's eye
- **Film grain**: Animated noise for organic, non-digital texture
- **Soft bloom**: Glow on highlights for dreamy quality

Falls back to raw `<video>` element if WebGL is unavailable. Canvas uses `object-fit: cover` at video resolution.

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
