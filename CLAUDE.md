# IVANN AURA — Scroll Cinema Website

@AGENTS.md

## Project

Awwwards-quality immersive website for IVANN AURA, a Colombian pianist and live show performer. The entire page is a single scroll-driven cinematic experience built on top of his concert video "Flamenco de Esfera".

## Stack

- **Next.js 16.2.1** (App Router, Turbopack)
- **React 19.2.4** + TypeScript
- **Tailwind CSS v4** (with `@theme inline` custom properties)
- **GSAP + ScrollTrigger + SplitText + matchMedia** for scroll-driven video + per-char text reveals + responsive/a11y
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
| `AudioMomentum` | `lib/audio-momentum.ts` | Physics engine + AnalyserNode: energy/friction → playbackRate + frequency bands (bass/mids/highs) |
| `ScrollStoryOverlay` | `ui/ScrollStoryOverlay.tsx` | 20+ story beats with GSAP SplitText per-char/word reveals |
| `usePianoScroll` | `hooks/usePianoScroll.ts` | Letter keys (a-z) / click → smooth scroll forward |
| `PianoIndicator` | `ui/PianoIndicator.tsx` | Energy-driven equalizer (gold when energy > 0.3) |
| `Navigation` | `ui/Navigation.tsx` | Fixed nav, scroll progress, native `<dialog>` mobile menu, sound toggle |
| `CustomCursor` | `ui/CustomCursor.tsx` | Animated dot + ring cursor (desktop only) |
| `MicroSounds` | `lib/micro-sounds.ts` | Web Audio oscillator system: hover notes, click keys, scroll whoosh |
| `Preloader` | `ui/Preloader.tsx` | Cinematic preloader: SplitText reveal + animated progress + scale exit |
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

### Frequency Analysis (AnalyserNode)

AudioMomentum creates `AudioContext → MediaElementSource → AnalyserNode → destination`. `fftSize=256` → 128 bins. Bands averaged + smoothed (EMA 0.8):
- **Bass** (bins 0-10, ~0-1720Hz): Piano body, low notes
- **Mids** (bins 10-50, ~1720-8600Hz): Melody, main frequencies
- **Highs** (bins 50-128, ~8600Hz+): Harmonics, shimmer, applause

Bands available via `getFrequencyBands()` → `{ bass, mids, highs }` (all 0-1). Fed to cinema-gl uniforms even when muted (visual reactivity independent of audibility).

## Scroll → Video Pipeline (GSAP ScrollTrigger + matchMedia)

1. Lenis smooth-scrolls the page (`lerp: 0.08`, `autoRaf: false`)
2. GSAP ticker drives Lenis (`gsap.ticker.add → lenis.raf`) — single RAF loop
3. `gsap.matchMedia()` wraps ScrollTrigger with responsive breakpoints:
   - Desktop: `scrub: 1.5` (vinyl feel)
   - Mobile: `scrub: 2` (gentler for touch)
   - `prefers-reduced-motion`: `scrub: true` (instant sync, no audio impulse)
4. `onUpdate` clamps to buffered range, sets `video.currentTime`, reports frame changes
5. Scroll velocity > 50px/s triggers `AudioMomentum.addImpulse()` (disabled for reduced-motion)
6. A rAF render loop uploads video frames to WebGL2 canvas with post-processing + particles

## Story Beat Text Animations (GSAP SplitText)

`ScrollStoryOverlay.tsx` uses three animation tiers driven by `data-split` attributes:

| Tier | Attribute | Effect | Used on |
|------|-----------|--------|---------|
| **Masked reveal** | `data-split="chars" data-split-mask="words"` | Chars slide up from behind word overflow | Hero titles, climax text |
| **Char fade+blur** | `data-split="chars"` | Opacity + y + blur(4px) per character | Section labels, medium text |
| **Word fade** | `data-split="words"` | Opacity + y per word | Quotes, body text |
| **Stagger** | `data-stagger` | Compound element children stagger in | Stats, cards, albums |

`AnimatedBeat` component (`useLayoutEffect` for flicker-free init):
- `gsap.matchMedia("(prefers-reduced-motion: no-preference)")` — no animations for reduced-motion
- `SplitText.create()` within GSAP context — auto-reverted on cleanup
- Timeline with `">-0.3"` overlap for cascading multi-target reveals
- Desktop: blur filter + longer durations; Mobile: no blur + snappier timing
- Exit: CSS opacity fade (progress > 0.85), works regardless of motion preference

## Unified WebGL2 Cinema

`cinema-gl.ts` renders video through a single WebGL2 context with two shader programs:

**Reactive uniforms** fed to shaders each frame:
| Uniform | Source | Shader Effect |
|---------|--------|---------------|
| `u_energy` | AudioMomentum scroll momentum | Base intensity for all effects |
| `u_bass` | AnalyserNode (bins 0-10) | Vignette breathing, particle size pulse |
| `u_mids` | AnalyserNode (bins 10-50) | Chromatic aberration boost |
| `u_highs` | AnalyserNode (bins 50-128) | Bloom intensity, particle glow |
| `u_mouse` | mousemove on sticky viewport | Directional CA offset, cursor spotlight, particle attraction |
| `u_velocity` | ScrollTrigger.getVelocity() normalized | Directional chromatic smear on fast scroll |
| `u_progress` | ScrollTrigger progress (0-1) | Narrative mood (smooth interpolation between acts) |

**Pass 1 — Video post-processing** (fullscreen quad):
- **Chromatic aberration**: Radial from center + directional from cursor + velocity boost
- **Vignette**: Edge darkening with bass-reactive breathing
- **Cursor spotlight**: Subtle brightening near mouse position
- **Film grain**: Animated noise for organic texture
- **Soft bloom**: Glow on highlights, boosted by highs frequency band

**Pass 2 — Luminance-reactive particles** (250 GL_POINTS, additive blending):
- Particles sample video texture for luminance at their position
- Luminance gradient nudges toward bright areas + cursor attraction with distance falloff
- Size pulses with bass, glow intensifies with highs
- Colors shift from warm white (#FFFDE8) to gold (#E8C85A) with energy

**Dynamic narrative mood** — smooth Hermite interpolation between act boundaries (no step functions):
Despertar (0.5) → Entrada (0.6) → Danza (0.8) → Espectáculo (0.9) → Fuego (1.1) → Clímax (1.2) → Resolución (0.8) → Cierre (0.5)

Falls back to raw `<video>` element if WebGL2 unavailable. Canvas sized to viewport with DPR capping.

## Micro-Interaction Sounds

`micro-sounds.ts` — Zero-download Web Audio oscillator system:
- `playHover()`: Random C major pentatonic note (sine, 150ms decay, vol 0.025)
- `playClick()`: C4 + octave harmonic (300ms, vol 0.04)
- `playWhoosh()`: Sawtooth sweep 400→80Hz through lowpass filter (150ms)
- Throttled: whoosh max 1/sec, hover debounced by browser event rate
- Respects `soundMuted` (wired from Navigation + ScrollVideoPlayer) and `prefers-reduced-motion`

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
