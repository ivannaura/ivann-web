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
layout.tsx
 ├── Preloader             (cinematic SplitText entrance + decorative bar + scale exit)
 ├── MagneticButtons       (global .magnetic-btn hover effect provider)
 └── SmoothScroll          (Lenis + GSAP single RAF loop)
      └── page.tsx
           ├── CustomCursor          (transform-based dot + ring, desktop only, viewport-aware)
           ├── Navigation            (fixed nav, scroll progress, mobile <dialog>, sound toggle)
           ├── PianoIndicator        (frequency-reactive equalizer: bass/mids/highs)
           │
           ├── ScrollVideoPlayer     (GSAP ScrollTrigger → video.currentTime + unified WebGL2 canvas)
           │    ├── CinemaGL         (unified renderer: video shaders + luminance-reactive particles)
           │    ├── AudioMomentum    (physics engine + AnalyserNode: shared AudioContext)
           │    └── ScrollStoryOverlay (20+ frame-synced story beats over video)
           │
           ├── Contact               (GSAP ScrollTrigger entrance, mailto: form, validation)
           └── Footer                (GSAP SplitText entrance, real social links, micro-sounds)
```

### Key Components

| Component | File | Purpose |
|-----------|------|---------|
| `ScrollVideoPlayer` | `ui/ScrollVideoPlayer.tsx` | GSAP ScrollTrigger + unified WebGL2 canvas + AudioMomentum + onBandsChange |
| `CinemaGL` | `lib/cinema-gl.ts` | Unified WebGL2: video post-processing + luminance-reactive particles (bufferSubData) |
| `AudioMomentum` | `lib/audio-momentum.ts` | Physics engine + AnalyserNode: energy/friction → playbackRate + frequency bands |
| `SharedAudioContext` | `lib/shared-audio-context.ts` | Ref-counted singleton AudioContext (iOS Safari 4-context limit) |
| `MicroSounds` | `lib/micro-sounds.ts` | Web Audio oscillators: hover/click/whoosh (shared AudioContext) |
| `ScrollStoryOverlay` | `ui/ScrollStoryOverlay.tsx` | 20+ story beats with GSAP SplitText per-char/word reveals |
| `usePianoScroll` | `hooks/usePianoScroll.ts` | Physics-based keyboard/click scroll: momentum accumulator + friction decay + rhythm detection |
| `PianoIndicator` | `ui/PianoIndicator.tsx` | Frequency-reactive equalizer: bass→center, mids→mid, highs→outer bars |
| `Navigation` | `ui/Navigation.tsx` | Fixed nav, scroll progress, native `<dialog>`, cached querySelector |
| `CustomCursor` | `ui/CustomCursor.tsx` | GPU-composited transform cursor + viewport mouseleave/mouseenter |
| `MagneticButtons` | `providers/MagneticButtons.tsx` | Global `.magnetic-btn` hover effect (desktop, reduced-motion aware) |
| `Preloader` | `ui/Preloader.tsx` | Cinematic preloader: SplitText reveal + decorative bar + scale exit |
| `SmoothScroll` | `providers/SmoothScroll.tsx` | Lenis + GSAP single RAF loop (lerp 0.08, autoRaf false, typed LenisRef) |
| `Contact` | `sections/Contact.tsx` | GSAP ScrollTrigger entrance + SplitText heading + mailto: form + validation |
| `Footer` | `ui/Footer.tsx` | GSAP SplitText entrance + real social links + micro-sounds |

### Deleted (previously dead code)

- `ScrollFramePlayer.tsx`, `Hero.tsx`, `Experience.tsx`, `Music.tsx`, `LiveShow.tsx` — removed in audit cleanup
- `particles-gl.ts` — merged into `cinema-gl.ts` (single WebGL2 context)
- `frames/all/` — 49MB obsolete frame sequence (gitignored)
- CSS `.grain::after` overlay — removed (shader handles film grain)
- CSS `.reveal-up` animation system — removed (GSAP ScrollTrigger replaces)
- CSS `@keyframes fade-in-up` — removed (unused after reveal-up removal)
- CSS `.line-grow` animation — removed (GSAP handles Contact line animation)

## Audio Momentum System

Physics-driven audio that responds to user interaction like a vinyl record.

```
User scroll/key/click → addImpulse(normalizedVelocity)
                              ↓
                    impulse = lerp(0.1, 0.35, normalizedVelocity)
                    energy += impulse
                    energy *= FRICTION (0.985/frame)
                              ��
              playbackRate = lerp(0.25, 1.0, energy)
              volume = smoothstep(0, 0.15, energy) * 0.7
                              ↓
                    preservesPitch = false
                    (pitch drops as momentum decays = vinyl slowdown)
```

Constants: `FRICTION=0.985`, `MIN_RATE=0.25`, `MAX_RATE=1.0`, `MAX_VOLUME=0.7`, `PLAY_THRESHOLD=0.05`, `STOP_THRESHOLD=0.02`, `DRIFT_THRESHOLD=3.0s`
Proportional impulse: `amount = 0.1 + normalizedVelocity * 0.25` (gentle scroll → 0.1, fling → 0.35)

Energy half-life: FRICTION=0.985 → ~46 frames ≈ 766ms at 60fps.

### Shared AudioContext

Both AudioMomentum and MicroSounds share a single AudioContext via `shared-audio-context.ts`. Ref-counted: `acquireAudioContext()` / `releaseAudioContext()`. iOS Safari limits to 4 AudioContexts — sharing ensures we never exceed.

### Frequency Analysis (AnalyserNode)

AudioMomentum connects `MediaElementSource → AnalyserNode → destination` on the shared context. `fftSize=256` → 128 bins. Bands averaged + EMA smoothed (`BAND_ALPHA=0.35`, `smoothingTimeConstant=0.6`):
- **Bass** (bins 0-3, ~0-516Hz): Piano body, low octaves
- **Mids** (bins 3-30, ~516-5160Hz): Melody, main piano
- **Highs** (bins 30-128, ~5160Hz+): Harmonics, shimmer, applause

Two-tier drift correction: soft (>1.0s, gradual adjust), hard (>3.0s, snap).

Bands available via `getFrequencyBands()` → `{ bass, mids, highs }` (all 0-1). Fed to:
- CinemaGL shader uniforms (even when muted for visual reactivity)
- PianoIndicator bars (via `onBandsChange` callback → throttled 10fps state)

## Scroll → Video Pipeline (GSAP ScrollTrigger + matchMedia)

1. Lenis smooth-scrolls the page (`lerp: 0.08`, `autoRaf: false`)
2. GSAP ticker drives Lenis (`gsap.ticker.add → lenis.raf`) — single RAF loop
3. `gsap.matchMedia()` wraps ScrollTrigger with responsive breakpoints:
   - Desktop: `scrub: 1.5` (vinyl feel)
   - Mobile: `scrub: 2` (gentler for touch)
   - `prefers-reduced-motion`: `scrub: true` (instant sync, no audio impulse)
4. `onUpdate` clamps to buffered range (finds containing range or nearest preceding), sets `video.currentTime`, reports frame changes
5. Scroll velocity > 50px/s triggers `AudioMomentum.addImpulse(normVel)` with proportional intensity (normVel = rawVelocity / 5000, disabled for reduced-motion)
6. A rAF render loop uploads video frames to WebGL2 canvas with post-processing + particles (paused on `visibilitychange`)

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
- Exit: GSAP timeline reverse (progress > 0.8), chars slide back behind mask
- `data-depth` parallax on select beats (hero=1.2, stats=0.8, climax=1.3, closing=1.1)
- `data-reactive` sound-responsive letter-spacing on high-energy beats (energy > 0.3, mids band)
- Stable keys: `${beat.frameStart}-${beat.frameEnd}` (not array index)

## Unified WebGL2 Cinema (5-Pass Multi-FBO Pipeline)

`cinema-gl.ts` renders video through a single WebGL2 context with a tiered multi-pass pipeline.

### Tier System
| Tier | Target | Passes | FBOs | Particles | Features |
|------|--------|--------|------|-----------|----------|
| **High** | Desktop + flagship mobile | 5 | 4 | 1100 | All effects |
| **Mid** | Mid-range mobile | 3 | 2 | 500 | Bloom + color grade + particles. No motion blur, flare, heat |
| **Low** | Weak GPU / reduced-motion | 0 | 0 | 0 | Raw `<video>` + text overlay |

Auto-detection: `gl.MAX_TEXTURE_IMAGE_UNITS >= 8 && deviceMemory >= 4` → High. Runtime downgrade: avg frame time > 20ms for 10 frames → drop one tier.

### Pipeline (High Tier)
```
Video Texture → Pass 1: Cinema (CA + vignette + grain + color grade + heat distortion) → FBO_A
             → Pass 2: Bloom threshold + downsample (FBO_A → FBO_B, half-res)
             → Pass 3: Kawase blur (FBO_B ↔ FBO_B2 ping-pong, 3 iterations)
             → Pass 4: Composite (FBO_A + bloom + motion blur + flare + film burn + spotlight) → screen
             → Pass 5: Particles (additive blend over screen)
```

FBOs: FBO_A (full, cinema output), FBO_B (half, bloom downsample), FBO_B2 (half, blur ping-pong), FBO_D (full, previous frame for motion blur).

### Reactive Uniforms
| Uniform | Source | Shader Effect |
|---------|--------|---------------|
| `u_energy` | AudioMomentum scroll momentum | Base intensity for all effects |
| `u_bass` | AnalyserNode (bins 0-3) | Vignette breathing, particle size pulse, heat distortion gate |
| `u_mids` | AnalyserNode (bins 3-30) | Chromatic aberration boost |
| `u_highs` | AnalyserNode (bins 30-128) | Bloom intensity, particle glow |
| `u_mouse` | mousemove on sticky viewport | Directional CA offset, cursor spotlight, particle attraction |
| `u_velocity` | ScrollTrigger.getVelocity() / 5000 | Directional chromatic smear, motion blur intensity |
| `u_progress` | ScrollTrigger progress (0-1) | Narrative mood, color grading, bloom threshold |
| `u_actTransition` | Act boundary crossing (spike→decay) | Film burn / light leak effect |

### Cinema Pass Effects
- **Color grading per act**: 8 palettes (shadows/midtones/highlights), Hermite interpolation between acts
- **Prismatic chromatic aberration**: Asymmetric RGB (R radial, G tangential, B radial-opposite), quadratic falloff
- **FBM film grain**: 2-octave noise, shadow-weighted, amplitude ±0.03 (rest) → ±0.08 (climax)
- **Heat distortion**: UV displacement gated by `energy * bass > 0.3`, ~3px max
- **Bass-reactive vignette**: Edge darkening + breathing

### Composite Pass Effects
- **Kawase bloom**: 3-iteration half-res blur, threshold varies with mood (0.75 calm → 0.45 climax)
- **Anamorphic lens flare**: 17 horizontal samples, blue-cyan tint, intensity `0.15 * mood` (High only)
- **Temporal motion blur**: `mix(current, prev, smoothVelocity * 0.3)` via FBO_D (High only)
- **Film burn / light leak**: Triggered at act boundaries, warm orange→yellow gradient, 40% max opacity
- **Cursor spotlight**: Quadratic falloff, tinted with act highlight color

### Particle System (1100 on High, 500 on Mid)
- 1000 ambient + 100 cursor trail particles (zero-GC: pre-allocated Float32Array, `bufferSubData`, resetParticle in-place)
- CPU-side 48×20 luminance grid (FBO readback every 10 frames) → gradient force on velocity
- Cursor trail: spawn at mouse position, shorter life (60 frames), brighter white → act highlight color
- Act burst: 50 particles at boundary, 2× size, high initial velocity, 40 frame life
- Bass size+opacity pulse (size leads opacity by 2 frames for "pop then glow")

### ScrollVideoPlayer Features
- **Bass screen shake**: ±1.5px random translate on bass > 0.7, ref-based (no re-render), gated by reduced-motion
- **Dynamic letterbox**: 2.39:1 bars animate with mood (calm → thicker, intense → thinner, ±15% range)
- **Act transition tracking**: `actTransition` uniform spikes to 1.0 at boundary, decays 0.95/frame
- **Velocity normalization**: 5000 px/s saturation (was 2000)

### Dynamic Narrative Mood
Smooth Hermite interpolation between act boundaries (no step functions):
Despertar (0.5) → Entrada (0.6) → Danza (0.8) → Espectáculo (0.9) → Fuego (1.1) → Clímax (1.2) → Resolución (0.8) → Cierre (0.5)

Exported as `getMoodCPU()` for shared use (ScrollVideoPlayer letterbox, page.tsx haze).

Falls back to raw `<video>` element if WebGL2 unavailable or Low tier. Canvas sized to viewport with DPR capping.

## Micro-Interaction Sounds

`micro-sounds.ts` — Zero-download Web Audio oscillator system (shared AudioContext):
- `playHover()`: Random C major pentatonic note (sine, 150ms decay, vol 0.025)
- `playClick()`: C4 + octave harmonic (300ms, vol 0.04)
- `playWhoosh()`: Sawtooth sweep 400→80Hz through lowpass filter (150ms)
- Throttled: whoosh max 1/sec, hover debounced by browser event rate
- Used in: Navigation, Contact, Footer (hover/click interactions)
- `destroyMicroSounds()` called on page unmount to release shared AudioContext ref
- Respects `soundMuted` and `prefers-reduced-motion`

## Design Tokens (CSS Custom Properties)

```
--bg-void: #050508       --bg-surface: #0A0A10      --bg-subtle: #12121A
--text-primary: #F0EDE6  --text-secondary: #8A8A99  --text-muted: #4A4A5A
--aura-gold: #C9A84C     --aura-gold-bright: #E8C85A  --aura-gold-dim: #8A7435
--crimson: #6B1520       --border-subtle: rgba(255,255,255,0.06)
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

## SEO & Meta

- Complete Open Graph + Twitter Card metadata with OG image
- JSON-LD structured data: `@graph` with `MusicGroup` + `Person` + `WebSite` (not MusicEvent — Google requires startDate)
- `sitemap.xml` and `robots.txt` auto-generated via Next.js App Router
- `themeColor` in viewport export for Android Chrome toolbar
- No preload hints — `<link rel="preload" as="video">` is unreliable across browsers; `preload="auto"` on `<video>` handles progressive download
- `prefers-reduced-motion` disables all animations
- `aria-hidden="true"` on PianoIndicator (decorative)
- `aria-label="Contenido principal"` on `<main>`

## Deployment & Caching

- **Production URL**: `https://ivannaura.vercel.app` (Vercel auto-deploy from `main`)
- `SITE_URL` in `layout.tsx` = `https://ivannaura.vercel.app` (OG tags, sitemap, robots reference this)
- `ivannaura.com` is a Squarespace placeholder — NOT connected to Vercel yet
- `vercel.json`: custom cache headers for public assets:
  - `/videos/*` and `/audio/*`: `max-age=31536000, immutable` (1 year, fingerprinted)
  - `/og-image.jpg`: `max-age=86400` (1 day)
- Next.js `headers()` in `next.config.ts` does NOT apply to `public/` folder — must use `vercel.json`

## Commands

```bash
npm run dev          # Dev server (Turbopack)
npm run build        # Production build (Turbopack)
npm run typecheck    # TypeScript check (tsc --noEmit)
```

## Public Assets

- `videos/flamenco-graded.mp4` — **44MB, active** (all-keyframe scroll video)
- `videos/flamenco-de-esfera.mp4` — 67MB, original source (kept in public but NOT used as fallback)
- `audio/flamenco.m4a` — **3.9MB, active** (momentum-driven audio)
- `og-image.jpg` — **47KB, active** (1200x630 OG/Twitter card image)

## Conventions

- All overlay content is in Spanish
- Letterbox 2.39:1 aspect ratio to hide corporate banners
- `object-cover` on video/canvas for fullscreen display
- Frame indices use 3fps equivalence: `frameIndex = Math.floor(videoTime * 3)`
- Story beats in ScrollStoryOverlay use these frame indices for timing
- Mobile menu uses native `<dialog>` with `showModal()` for WCAG-compliant focus management
- Cursor variants: `"default" | "hover" | "hidden"` (no `"text"` — removed as unused)
- CustomCursor uses `transform: translate()` not `left`/`top` (GPU compositing)
- Scrollbar hidden on `html` element (not `body`) for Lenis compatibility
- Section entrance animations use GSAP ScrollTrigger + `data-reveal` attributes (not CSS `.reveal-up`)
- Contact line animation uses GSAP + `data-line` (not CSS `.line-grow`)
- Magnetic hover: add `className="magnetic-btn"` to any button for Awwwards-style cursor follow
- Film grain is shader-only (CSS grain overlay removed to avoid duplication)
- Energy state throttled: `useRef` at 60fps → `useState` at 10fps via `setInterval(100ms)`
- Social links: real URLs with `target="_blank" rel="noopener noreferrer"`
- Contact form: `mailto:` with pre-filled subject/body + client-side validation + `aria-describedby` error linking
- Programmatic scroll: use `useLenis()` from `lenis/react` — **never** `window.scrollTo/scrollBy/scrollIntoView` (conflicts with Lenis smooth scroll)
- `color-scheme: dark` in `:root` for native form control colors
- CinemaGL: all shaders use `precision highp float;` — mismatched precision between vertex/fragment causes link failure
- CinemaGL: `createProgramFromSources` detaches and deletes shaders after linking (prevents shader object leaks)
- CinemaGL: `lumPixels` Uint8Array pre-allocated once (not per readPixels call)
- CinemaGL: Kawase bloom result FBO dynamically selected based on `KAWASE_ITERATIONS % 2` (ping-pong correctness)
- CinemaGL: `texImage2D` guarded by `lastVideoTime` — skips upload when video frame unchanged
- AudioMomentum: `play()` Promise callback guards against destroyed instance (`if (!this.running) return`)
- MicroSounds: `getCtx()` re-acquires if shared AudioContext was closed
- CinemaGL: `webglcontextlost` / `webglcontextrestored` events tracked — render skips when context lost
- CinemaGL: all `gl.create*()` calls null-checked (no `!` non-null assertions on losable GL objects)
- SharedAudioContext: `releaseAudioContext()` guards against negative refCount
- ScrollVideoPlayer: `audioMuted` applied to freshly created AudioMomentum via ref (React effect ordering)
- ScrollVideoPlayer: bass shake via `shakeRef` (ref-based transform on sticky div, no re-render)
- ScrollVideoPlayer: dynamic letterbox bars (4vh `--bg-void` divs, scaleY varies with mood)
- ScrollStoryOverlay: `data-reactive` letter-spacing cached in `dataset.baseSpacing` (prevents unbounded growth)
- ScrollStoryOverlay: timeline exit guard `tl.totalProgress() < 1 && progress <= 0.8` (prevents fighting entry)
- Page: atmospheric haze div with `--haze-color` CSS property driven by progress
- Page: `displayBands` state uses shallow equality check (0.01 threshold) to avoid re-renders
- Navigation: `aria-controls="mobile-menu"` on hamburger, `id="mobile-menu"` on dialog
- Navigation: mobile social links have `aria-label` for screen readers
- Side dot navigation buttons have `focus-visible:ring` for keyboard users
- Reduced-motion CSS: only `animation-*` properties are overridden; transitions preserved for focus/hover
- `setMicroSoundsMuted` called from ScrollVideoPlayer only (not duplicated in Navigation)
- `<video>` and `<canvas>` have `aria-hidden="true"` (decorative, content conveyed by overlay text)
- Error boundary: `src/app/error.tsx` for Next.js App Router error handling
- See `docs/CONVENTIONS.md` for full technical conventions
