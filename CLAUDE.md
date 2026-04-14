# IVANN AURA — El Instrumento

@AGENTS.md

## Project

Awwwards-quality immersive website for IVANN AURA, a Colombian pianist and live show performer. The site is a multi-world "instrument" — a dark portal of interactive SVG constellations where the user's mouse, keyboard, and touch produce music and light. Each constellation node leads to a different world: the scroll-driven concert cinema, album experiences, biography, and booking.

## Stack

- **Next.js 16.2.1** (App Router, Turbopack)
- **React 19.2.4** + TypeScript
- **Tailwind CSS v4** (with `@theme inline` custom properties)
- **GSAP + ScrollTrigger + SplitText + matchMedia** for scroll-driven video + per-char text reveals + responsive/a11y
- **Lenis** for smooth scrolling (single RAF loop via GSAP ticker, `autoRaf: false`)
- **WebGL2** for unified cinema rendering (video post-processing + luminance-reactive particles)
- **Zustand** for UI state (cursor, menu, soundMuted with localStorage persistence)

## Architecture

```
layout.tsx (NO preloader, NO video preload — lightweight shell)
 ├── MagneticButtons       (global .magnetic-btn hover effect provider)
 └── SmoothScroll          (Lenis + GSAP single RAF loop)
      │
      ├── / (Portal)
      │    ├── FractalPreloader      (Julia Set WebGL2 implosion → gold explosion → reveal)
      │    ├── CustomCursor          (transform-based dot + ring, desktop only)
      │    ├── ConstellationSVG      (Fibonacci-positioned nodes + Catmull-Rom curves + 3-layer glow)
      │    ├── PortalNebula          (procedural value noise + twinkling stars, Canvas 2D, ~12fps)
      │    ├── PortalParticles       (golden cursor trail, 2D canvas, 150 particles, zero-GC)
      │    └── PortalSounds          (proximity-aware E Phrygian notes per constellation node)
      │
      ├── /concierto (Scroll Cinema — the main show)
      │    ├── Preloader             (video buffer tracking + SVG convergence + iris-close)
      │    ├── CustomCursor
      │    ├── Navigation            (fixed nav, scroll progress, mobile <dialog>, sound toggle, route-aware)
      │    ├── PianoIndicator        (frequency-reactive equalizer: bass/mids/highs)
      │    ├── ScrollVideoPlayer     (GSAP ScrollTrigger → video.currentTime + unified WebGL2 canvas)
      │    │    ├── CinemaGL         (unified renderer: video shaders + luminance-reactive particles)
      │    │    ├── AudioMomentum    (physics engine: energy cap 0.6, elastic damping, min floor 0.08)
      │    │    └── ScrollStoryOverlay (20+ frame-synced story beats over video)
      │    ├── AutoplayTimeline      (play/pause toggle + draggable scrubber + auto-scroll via Lenis)
      │    ├── Contact               (GSAP ScrollTrigger entrance, API route form, validation)
      │    └── Footer                (GSAP SplitText entrance, real social links, micro-sounds)
      │
      ├── /contratar (Booking — fast, no video, no preloader)
      │    ├── Contact
      │    └── Footer
      │
      └── /mar, /apocalypsis, /pianista (Teaser Worlds — no preloader)
           └── TeaserWorld           (name + color glow + "Próximamente")
```

### Key Components

#### Portal

| Component | File | Purpose |
|-----------|------|---------|
| `FractalPreloader` | `ui/FractalPreloader.tsx` | Julia Set fractal implosion preloader. WebGL2 fullscreen quad, GSAP-driven progress (3.5s, power2.in), gold explosion + clip-path reveal, audio primer. WebGL context destroyed after exit. Reduced-motion fallback: static "IVANN AURA" text |
| `FractalGL` | `lib/fractal-gl.ts` | WebGL2 Julia Set renderer. Gold Inigo Quilez cosine palette, smooth iteration count, vignette, fake bloom. `setProgress(0-1)` drives c parameter collapse (0.7885→~0.024). Context lost/restored handlers. DPR cap 1.5 |
| `ConstellationSVG` | `ui/ConstellationSVG.tsx` | SVG nodes (Fibonacci golden-angle positions) + Catmull-Rom curved lines + 3-layer premium glow (soft/medium/wide blur + screen blend) + feTurbulence energy filter (desktop only) + proximity glow + draw-on reveal + exit transition + pulse ripple + keyboard nav (tabIndex + Enter/Space) + 44px touch targets. preserveAspectRatio xMidYMid slice |
| `PortalNebula` | `lib/portal-nebula.ts` | Procedural background: 3-octave value noise in dark gold tones + 30-50 twinkling stars + central radial glow. Canvas 2D, ~12fps, DPR 1. Reduced-motion: single static frame |
| `PortalParticles` | `lib/portal-particles.ts` | Golden cursor trail (150 particles, pre-allocated, delta-time corrected, zero-GC). `burst(x,y,count)` for preloader handoff. Canvas 2D (avoids GL context conflicts) |
| `PortalSounds` | `lib/portal-sounds.ts` | Proximity-aware E Phrygian notes. Per-node character: concierto=clean, mar=delay reverb, apocalypsis=low octave+distortion, pianista=warm sine. 3-voice GainNode pool, shared AudioContext |
| `ConstellationData` | `lib/constellation-data.ts` | Fibonacci golden-angle node distribution + Catmull-Rom path generation + deterministic jitter. 5 nodes, 6 curved lines, 14 stars. `catmullRomToPath()` export |
| `TeaserWorld` | `ui/TeaserWorld.tsx` | Reusable placeholder for upcoming album worlds. GSAP fade-in, radial color glow, "Proximamente" label, back-to-portal link |

#### Scroll Cinema (existing)

| Component | File | Purpose |
|-----------|------|---------|
| `ScrollVideoPlayer` | `ui/ScrollVideoPlayer.tsx` | GSAP ScrollTrigger + unified WebGL2 canvas + AudioMomentum + onBandsChange |
| `CinemaGL` | `lib/cinema-gl.ts` | Unified WebGL2: video post-processing + luminance-reactive particles (bufferSubData) |
| `AudioMomentum` | `lib/audio-momentum.ts` | Physics engine: Source→Analyser→GainNode→Dest, energy/friction → playbackRate + frequency bands |
| `SharedAudioContext` | `lib/shared-audio-context.ts` | Ref-counted singleton AudioContext (iOS Safari 4-context limit) |
| `MicroSounds` | `lib/micro-sounds.ts` | Web Audio oscillators: hover/click/whoosh (shared AudioContext) |
| `ScrollStoryOverlay` | `ui/ScrollStoryOverlay.tsx` | 20+ story beats with GSAP SplitText per-char/word reveals |
| `usePianoScroll` | `hooks/usePianoScroll.ts` | Physics-based keyboard/click scroll: momentum accumulator + friction decay + rhythm detection + M key mute |
| `PianoIndicator` | `ui/PianoIndicator.tsx` | Frequency-reactive equalizer: wave cascade stagger + idle breathing animation |
| `Navigation` | `ui/Navigation.tsx` | Fixed nav (4 items: Inicio/Espectáculo/Música/Contacto), GPU scaleX progress bar, native `<dialog>` with CSS entrance/exit animations |
| `CustomCursor` | `ui/CustomCursor.tsx` | GPU-composited transform cursor + scale-based ring hover + scroll velocity stretch |
| `MagneticButtons` | `providers/MagneticButtons.tsx` | Global `.magnetic-btn` hover effect + mouseout reset (desktop, reduced-motion aware) |
| `Preloader` | `ui/Preloader.tsx` | Video buffer preloader for /concierto only: SVG convergence + iris-close exit + audio primer + MutationObserver video detection + 99% buffer threshold |
| `AutoplayTimeline` | `ui/AutoplayTimeline.tsx` | Optional autoplay for /concierto: play/pause button (40px, bottom-right) + full-width draggable timeline scrubber. Auto-scrolls Lenis at constant velocity (150s traversal). Manual scroll pauses. Does NOT bypass ScrollTrigger |
| `SmoothScroll` | `providers/SmoothScroll.tsx` | Lenis + GSAP single RAF loop (lerp 0.08, vinyl easing, autoRaf false) |
| `Contact` | `sections/Contact.tsx` | GSAP ScrollTrigger entrance + SplitText heading + API route form + loading/error/success states |
| `Footer` | `ui/Footer.tsx` | GSAP SplitText entrance (staggered AURA heading) + real social links + micro-sounds |

### Added (this refactor)

- `src/app/error.tsx` — Error boundary with retry, console.error logging, dev error details
- `src/app/not-found.tsx` — Branded 404 page with "Volver al inicio" link
- `src/app/loading.tsx` — Minimal loading state with gold gradient pulse
- `src/app/robots.ts` — Disallows `/videos/` and `/audio/` from crawling
- `src/app/sitemap.ts` — Weekly changeFrequency, dynamic lastModified
- `src/app/api/contact/route.ts` — Contact form API route (POST, server-side validation)

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

### Audio Graph
```
MediaElementSource → AnalyserNode → GainNode → Destination
```
GainNode enables muting via gain ramp (instead of `audio.muted`) to preserve AnalyserNode signal for visual reactivity even when muted.

### Physics
```
Scroll → setScrollVelocity(normVel)    Key/Click → addImpulse(normVel)
                              ↓
  energy soft-follows velocity           energy += 0.1 + normVel * 0.25
  (non-cumulative)                       (discrete, cumulative)
              └─────────── energy ───────────────────┘
                              ↓
              energy *= Math.exp(LN_FRICTION * dt)  // friction
              scrollVelocity *= Math.exp(LN_FRICTION * dt * 3)  // 3x faster
                              ↓
              playbackRate = lerp(0.5, 1.0, pow(energy, 0.7))
              volume = smoothstep(0, 0.15, energy) * 0.7
              preservesPitch = false → vinyl slowdown + drift
```

Constants: `FRICTION=0.985`, `MIN_RATE=0.5`, `MAX_RATE=1.0`, `MAX_VOLUME=0.7`, `PLAY_THRESHOLD=0.05`, `STOP_THRESHOLD=0.02`, `DRIFT_THRESHOLD=3.0s`
Two input modes:
- **Scroll** (non-cumulative): `setScrollVelocity()` — energy soft-follows via `energy += (velocity - energy) * 0.4 * dt`. Prevents "enloquece" bug where 60fps addImpulse saturated energy instantly.
- **Discrete** (cumulative): `addImpulse()` — `amount = 0.1 + normalizedVelocity * 0.25`. Used for keypress/click only.
- Scroll velocity decays 3× faster than energy → "vinyl tail" (user stops, energy lingers).

Vinyl drift: when energy lingers after scroll stops, `onScrollDrift` callback pushes Lenis scroll in last direction → visible "gradually slowing down" effect on video matching audio playbackRate slowdown.

Delta-time friction: `Math.exp(LN_FRICTION * dt)` where `dt = (now - lastTime) / 16.667` — consistent behavior across frame rates.
Sync crossfade: gain ramp to 0 before `currentTime` snap, then ramp back up (avoids audible pop).
Drift correction: exponential `drift * (1 - Math.pow(0.9, dt))` — frame-rate independent.

### Shared AudioContext

Both AudioMomentum and MicroSounds share a single AudioContext via `shared-audio-context.ts`. Ref-counted: `acquireAudioContext()` / `releaseAudioContext()`. iOS Safari limits to 4 AudioContexts — sharing ensures we never exceed. Fixed `sampleRate: 44100`. Includes `primerAudioContext()` for iOS — both `touchstart`/`click` listeners stay alive until `ctx.resume()` actually succeeds (programmatic clicks from GSAP don't count as real user gestures on iOS).

### Frequency Analysis (AnalyserNode)

AudioMomentum connects `MediaElementSource → AnalyserNode → GainNode → destination` on the shared context. `fftSize=256` → 128 bins. `getFloatFrequencyData` (full dB precision, normalized to 0-1 via `(dB - DB_MIN) * DB_RANGE_INV`). Bands averaged with unrolled loops + dt-corrected asymmetric EMA (`1 - Math.pow(1 - α, dt)`, attack=0.6, release=0.15). Analysis runs every 2nd frame via `analyseSkip` counter. Frequency analysis gated: early return when `energy <= 0 && !wasPlaying`.
- **Bass** (bins 0-3, ~0-516Hz): Piano body, low octaves
- **Mids** (bins 3-30, ~516-5160Hz): Melody, main piano
- **Highs** (bins 30-128, ~5160Hz+): Harmonics, shimmer, applause

Two-tier drift correction: soft (>1.0s, gradual adjust), hard (>3.0s, snap).

Bands available via `getFrequencyBands()` → `{ bass, mids, highs }` (all 0-1). Fed to:
- CinemaGL shader uniforms (even when muted for visual reactivity)
- PianoIndicator bars (via `onBandsChange` callback → throttled 10fps state)

## Scroll → Video Pipeline (GSAP ScrollTrigger + matchMedia)

1. Lenis smooth-scrolls the page (`lerp: 0.08`, `easing: exponential ease-out` for vinyl feel, `autoRaf: false`)
2. GSAP ticker drives Lenis (`gsap.ticker.add → lenis.raf`) — single RAF loop
3. `gsap.matchMedia()` wraps ScrollTrigger with responsive breakpoints:
   - Desktop: `scrub: 1.5` (vinyl feel)
   - Mobile: `scrub: 1` (faster touch response)
   - `prefers-reduced-motion`: `scrub: true` (instant sync, no audio impulse)
4. `onUpdate` clamps to buffered range (finds containing range or nearest preceding), sets `video.currentTime`, reports frame changes
5. Scroll velocity > 200px/s triggers `AudioMomentum.setScrollVelocity(normVel)` (non-cumulative, normVel = rawVelocity / 5000, disabled for reduced-motion). 200px/s threshold prevents drift→energy feedback loop.
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
- Exit: split beats → GSAP timeline reverse (progress > 0.8); non-split beats → CSS opacity fade (1→0 over progress 0.8-1.0)
- `data-depth` parallax on select beats (hero=1.2, stats=0.8, climax=1.3, closing=1.1) — uses CSS `translate` (not `transform`) to avoid GSAP conflicts
- `data-reactive` sound-responsive letter-spacing (continuous with `energy * bands.mids * 0.08`, no threshold gate)
- Act transition echo: `brightness()` filter dims text ~30% at peak when `actTransition > 0.3`
- CTA cursor hover: `onMouseEnter/onMouseLeave` sets cursor variant via `useUIStore.getState()`
- Stable keys: `${beat.frameStart}-${beat.frameEnd}` (not array index)

## Unified WebGL2 Cinema (5-Pass Multi-FBO Pipeline)

`cinema-gl.ts` renders video through a single WebGL2 context with a tiered multi-pass pipeline.

### Tier System
| Tier | Target | Passes | FBOs | Particles | Features |
|------|--------|--------|------|-----------|----------|
| **High** | Desktop + flagship mobile | 5 | 4 | 1100 | All effects |
| **Mid** | Mid-range mobile | 3 | 2 | 500 | Bloom + color grade + particles. No motion blur, flare, heat |
| **Low** | Weak GPU / reduced-motion | 0 | 0 | 0 | Raw `<video>` + text overlay |

Auto-detection: `prefers-reduced-motion` → Low. iOS → Mid (deviceMemory always undefined). Desktop: `gl.MAX_TEXTURE_IMAGE_UNITS >= 8 && deviceMemory >= 4` → High. Runtime downgrade: avg frame time > 20ms for 10 frames → drop one tier.

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
- **Color grading per act**: 8 palettes (shadows/midtones/highlights), Hermite interpolation between acts. Shadow grading: `mix(graded, grade.shadows * 1.2, shadowW * 0.4)` (fixed from self-normalizing no-op)
- **Prismatic chromatic aberration**: Asymmetric RGB (R radial, G tangential, B radial-opposite), quadratic falloff
- **FBM film grain**: 2-octave noise, shadow-weighted, amplitude ±0.03 (rest) → ±0.08 (climax)
- **Heat distortion**: UV displacement gated by `energy * bass > 0.3`, ~3px max
- **Bass-reactive vignette**: Edge darkening + breathing

### Composite Pass Effects
- **Kawase bloom**: 3-iteration half-res blur with soft knee (replacing hard `max(0.0, lum - threshold)`), threshold varies with mood (0.75 calm → 0.45 climax)
- **Anamorphic lens flare**: 17 horizontal samples, blue-cyan tint, intensity `0.15 * mood` (High only)
- **Directional motion blur**: 3-tap directional blur based on scroll velocity (replacing directionless ghost), via FBO_D (High only)
- **Film burn / light leak**: Triggered at act boundaries, warm orange→yellow gradient, 40% max opacity
- **Cursor spotlight**: Quadratic falloff, tinted with act highlight color

### Particle System (1100 on High, 500 on Mid)
- 1000 ambient + 100 cursor trail particles (zero-GC: pre-allocated Float32Array, `bufferSubData`, resetParticle in-place). Named constants: `PARTICLE_DAMPING`, `PARTICLE_CURSOR_RADIUS`, etc. Velocity damping hoisted outside loop: `Math.exp(LN_DAMPING_60 * dt)`. Cursor attraction uses squared-distance check before `Math.sqrt`. Shader detach after linking (6 `detachShader` calls). Context restored handler.
- CPU-side 48×20 luminance grid (async PBO readback every 10 frames, 1-interval latency) → gradient force on velocity
- Cursor trail: spawn at mouse position, shorter life (60 frames), brighter white → act highlight color
- Act burst: 50 particles at boundary, 2× size, high initial velocity, 40 frame life
- Bass size+opacity pulse (size leads opacity by 2 frames for "pop then glow")

### ScrollVideoPlayer Features
- **Bass screen shake**: ±1.5px random translate on bass > 0.7, ref-based (no re-render), gated by reduced-motion. Delta-time corrected decay.
- **Dynamic letterbox**: 2.39:1 bars animate with mood (calm → thicker, intense → thinner, ±15% range). Smooth CSS transition on bars.
- **Act transition tracking**: `actTransition` uniform spikes to 1.0 at boundary, decays with delta-time correction
- **Mobile haptic**: `navigator.vibrate([15, 30, 15])` at act boundaries (try-catch wrapped, Android progressive enhancement)
- **Velocity normalization**: 5000 px/s saturation (was 2000)
- **Canvas fallback**: `<p>` element when WebGL unavailable
- **Video poster**: poster attribute for initial frame display
- **Mobile scrub**: `scrub: 1` (was 2) for faster touch response

### Dynamic Narrative Mood
Smooth Hermite interpolation between act boundaries (no step functions):
Despertar (0.5) → Entrada (0.6) → Danza (0.8) → Espectáculo (0.9) → Fuego (1.1) → Clímax (1.2) → Resolución (0.8) → Cierre (0.5)

Exported as `getMoodCPU()` for shared use (ScrollVideoPlayer letterbox, page.tsx haze).

Falls back to raw `<video>` element if WebGL2 unavailable or Low tier. Canvas sized to viewport with DPR capping (2 desktop, 1.5 mobile).

## Keyboard Scroll Momentum (usePianoScroll)

Physics-based keyboard/click scroll with rhythm detection. Each interaction adds energy to a momentum accumulator; a lazy rAF loop converts energy into smooth scroll with friction-based deceleration.

```
Keypress/Click → energy += impulse (modulated by rhythm)
                     ↓
               energy *= Math.pow(FRICTION, dt)  // delta-time corrected (0.955)
                     ↓
          scrollDelta = energy * VELOCITY_SCALE * dt (8 px/frame)
          lenis.scrollTo(scroll + delta)
                     ↓
          ScrollTrigger detects velocity → AudioMomentum reacts
```

**Rhythm Detection** (3 gears via inter-tap interval):

| Gear | Interval | Impulse | Feel |
|------|----------|---------|------|
| Isolated tap | > 400ms | `IMPULSE_BASE` (0.12) | Gentle push, ~200px travel |
| Rhythmic tapping | 100-400ms | `× RHYTHM_BONUS` (1.6) | Momentum builds |
| Key held (repeat) | < 50ms | `× HOLD_DAMPEN` (0.3) | Sustained controlled scroll |

Constants: `MAX_ENERGY=1.0`, `STOP_THRESHOLD=0.005`, rAF loop self-terminates when idle.
Only letter keys a-z trigger (WCAG 2.1.4). No `e.preventDefault()` (preserves screen reader shortcuts).
M key = mute toggle shortcut (keyboard-only users). Click on `[data-cinema]` = same impulse system.
Respects `prefers-reduced-motion: reduce` (entire system disabled).

## Micro-Interaction Sounds

`micro-sounds.ts` — Zero-download Web Audio oscillator system (shared AudioContext):
- `playHover()`: Random non-repeating E Phrygian note `[659, 698, 880, 988, 1047, 1319]` (sine, 150ms decay, vol 0.025) — flamenco-compatible
- `playClick()`: E4+E5 (330+659) harmonic (300ms, vol 0.04), 100ms throttle
- `playWhoosh()`: Sawtooth sweep 400→80Hz through lowpass filter (150ms)
- Throttled: whoosh max 1/sec, click 100ms, hover debounced by browser event rate
- **Pre-allocated GainNode pools**: NoteVoice pool (4 voices) + WhooshVoice pool (2 voices) — only OscillatorNodes created per call (single-use by Web Audio spec). Graceful drop when all voices busy.
- Oscillator `onended` disconnect for cleanup (GainNodes persist in pool)
- Pool reset on AudioContext change; full cleanup in `destroyMicroSounds()`
- Runtime `prefers-reduced-motion` listener (responds to OS toggle without reload)
- Used in: Navigation, Contact, Footer (hover/click interactions)
- `destroyMicroSounds()` called on page unmount to release pools + shared AudioContext ref
- Respects `soundMuted` and `prefers-reduced-motion`

## Design Tokens (CSS Custom Properties)

```
--bg-void: #050508       --bg-surface: #0A0A10      --bg-subtle: #12121A
--text-primary: #F0EDE6  --text-secondary: #8A8A99  --text-muted: #78788C
--aura-gold: #C9A84C     --aura-gold-bright: #E8C85A  --aura-gold-dim: #9A8240
--crimson: #6B1520       --border-subtle: rgba(255,255,255,0.06)
```

### Typography
- **Display**: Cormorant Garamond (300, 400) — serif, elegant, for headings and hero text
- **Body**: Plus Jakarta Sans (300, 400, 500, 600) — sans-serif, modern, for UI and body text
- Both loaded via `next/font/google` with `display: "swap"`, `latin-ext` subset
- CSS: `--font-display` and `--font-body` custom properties in `@theme inline`
- Replaced Geist Sans/Mono (generic AI-slop fonts)

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
- `sitemap.xml` (weekly changeFrequency, dynamic lastModified) and `robots.txt` (disallows `/videos/` and `/audio/`) auto-generated via Next.js App Router
- `themeColor` in viewport export for Android Chrome toolbar
- `format-detection` meta tag (disables auto-linking of phone numbers)
- `color-scheme: dark` meta tag for native dark form controls
- No preload hints — `<link rel="preload" as="video">` is unreliable across browsers; `preload="auto"` on `<video>` handles progressive download
- `prefers-reduced-motion` disables all animations
- `aria-hidden="true"` on PianoIndicator (decorative)
- `aria-label="Contenido principal"` on `<main>`

## Deployment & Caching

- **Production URL**: `https://ivannaura.vercel.app` (Vercel auto-deploy from `main`)
- `SITE_URL` in `layout.tsx` = `https://ivannaura.vercel.app` (OG tags, sitemap, robots reference this)
- `ivannaura.com` is a Squarespace placeholder — NOT connected to Vercel yet
- `vercel.json`: custom cache + security headers for public assets:
  - `/videos/*` and `/audio/*`: `max-age=31536000, immutable` (1 year, fingerprinted)
  - `/og-image.jpg`: `max-age=86400` (1 day)
  - All routes: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`
- `next.config.ts`: security headers on all routes (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy, HSTS), `poweredByHeader: false`, `reactStrictMode: true`, `productionBrowserSourceMaps: false`, `images.formats: ["image/avif", "image/webp"]`
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

## Known Bugs & Performance Issues

> Full catalog with code examples: `docs/plans/2026-04-06-optimization-tricks.md` (44 tricks, 5 priority tiers)

### Bugs — FIXED (commit a337269)
- ~~**Asymmetric EMA not dt-corrected**~~ → `1 - Math.pow(1 - α, dt)` correction applied (`audio-momentum.ts`)
- ~~**`Math.pow(DAMPING, dt*60)` inside particle loop**~~ → Hoisted outside loop as `Math.exp(LN_DAMPING_60 * dt)` (`cinema-gl.ts`)

### GC Pressure — FIXED (commit a337269)
- ~~**String templates every frame**~~ → CSS `style.translate`/`style.scale` properties (CustomCursor, ScrollVideoPlayer)
- ~~**sampleLumGrad return objects**~~ → Pre-allocated `_gradResult` reusable object (`cinema-gl.ts`)
- ~~**Asymmetric EMA closure**~~ → Inlined into `updateFrequencyBands()` with local vars (`audio-momentum.ts`)

### Performance — IMPLEMENTED (commit a337269)
- `Math.pow(CONST, dt)` → `Math.exp(LN_CONST * dt)` with precomputed constants (11 call sites across 5 files)
- `getByteFrequencyData` → `getFloatFrequencyData` with dB→0-1 normalization (`audio-momentum.ts`)
- `audio.volume` per frame → `GainNode.gain.setTargetAtTime()` with JND 0.005 threshold (`audio-momentum.ts`)
- `glColorMask(true, true, true, false)` on 3 opaque passes, restored before particles (`cinema-gl.ts`)
- `texStorage2D` immutable FBO textures with delete+recreate on resize (`cinema-gl.ts`)
- Squared-distance cursor check avoids `Math.sqrt` for out-of-radius particles (`cinema-gl.ts`)
- Frequency analysis every 2nd frame via `analyseSkip` counter (`audio-momentum.ts`)
- Pre-allocated NoteVoice (4) + WhooshVoice (2) GainNode pools (`micro-sounds.ts`)

### Design Review — FIXED (commit ba34dad)
- ~~**Hero/Preloader not using font-display**~~ → `fontFamily: var(--font-display)` on Preloader h1 + all major headings in ScrollStoryOverlay
- ~~**Muted text over video no text-shadow**~~ → `.text-cinema` class added to all overlay text with `--text-muted`/`--text-secondary`
- ~~**Min font sizes 9-10px**~~ → Floor raised to 11px across all components
- ~~**Mobile overflow stats/cards/albums**~~ → `flex-wrap justify-center` with responsive gaps
- ~~**Validation errors illegible**~~ → 12px warm red (#DC4A4A) replacing 10px dark crimson
- ~~**Submit button no focus-visible**~~ → `focus-visible:ring` added
- ~~**Contact social links no touch targets**~~ → `min-h-[44px] inline-flex items-center`
- ~~**Nav only 2 items**~~ → Expanded to 4: Inicio, Espectáculo, Música, Contacto
- ~~**Preloader flat screen**~~ → Subtle fractal noise grain overlay (opacity 0.03)
- ~~**Letterbox range imperceptible**~~ → Range doubled via `1.6 - mood * 0.8` formula
- ~~**Particles invisible at rest**~~ → Ambient alpha baseline 0.3 → 0.4
- ~~**Contact/Footer no separation**~~ → Gold gradient divider line added

### Creative Enhancements — Awwwards-tier (commit 8dd0105)
Applied across 6 files (559 insertions). All CSS animations motion-gated via `@media (prefers-reduced-motion: no-preference)`.

**Preloader + Navigation:**
- Conductor's baton: gold gradient line sweeps across during name reveal (GSAP `fromTo scaleX(0→1)`, fades out after)
- Title float: gentle y oscillation (-4px, `yoyo: true, repeat: 1`) during progress bar fill
- Subtitle word-stagger: SplitText `type: "words,chars"` — words stagger 0.12s, then chars sharpen at 0.015s
- Progress bar glow: `preloader-bar-glow` class with pulsing gold box-shadow (`@keyframes preloader-bar-pulse`)
- Nav progress particle: gold dot shimmer on progress bar leading edge (`nav-progress-shimmer` animation)
- Gold diamond separator: 4px rotated-45deg replacing plain `w-px` divider
- Active side dot echo: sonar pulse animation (`@keyframes dot-echo`)

**ScrollStoryOverlay:**
- Per-letter opacity gradient: `"IVANN".split("").map()` with `opacity: 1 - i * (0.15 / (arr.length - 1))`
- Act label numbers in gold: `<span style={{ color: "var(--aura-gold)" }}>01</span>`
- Decorative quote marks: `\u201C` positioned absolutely, 6vw, gold 35% opacity
- Stats staggered offsets: `translateY(0/12/-8/16px)` per stat card
- Album rotations: `rotate(-1.5/+2/-2/+1deg)` per album card
- Gold separator between closing IVANN/AURA words
- Audio-reactive color warmth: `color-mix(in srgb, var(--text-primary) N%, var(--aura-gold))` driven by energy
- `.act-rule` gold accent lines before each act label (`@keyframes rule-draw-in`)
- `.cta-underline` hover draw-in on "VIVE LA EXPERIENCIA" (CSS `::after scaleX`)

**Contact + Footer:**
- `.contact-field::after` gold gradient glow on input focus (CSS `scaleX(0→1)` transition)
- `.contact-label` floating labels: shrink 10→9px + gold color on focus/has-value
- `.contact-submit::before` shimmer sweep on hover (`@keyframes shimmer-sweep`)
- `.gold-glow-text` pulsing text-shadow on "extraordinario" (`@keyframes gold-text-glow`)
- `.footer-brand` text-stroke engraving on hover (`-webkit-text-stroke: 1px`, color transparent)
- `.footer-social-line` extending decorative gold line (0→24px) on hover
- Oversized gold quotation marks on blockquote (6rem, opacity 0.07/0.05)
- `.footer-arrow-bounce` on back-to-top hover (`@keyframes arrow-bounce-up`)
- `.footer-bottom-bar::before` noise texture on copyright area (dual radial gold gradients)

### Performance — IMPLEMENTED (session 2)
- **CinemaGL idle gating** (`cinema-gl.ts`): After 3 frames of unchanged inputs (video frame same, energy < 0.005, velocity < 0.005, bands sum < 0.015, mouse within 2px, actTransition < 0.01), skips full 5-pass pipeline. Resumes instantly on any change.
- **Navigation scrollProgress ref-based** (`Navigation.tsx`): Replaced `useState(scrollProgress)` with `useRef` + direct DOM manipulation on `progressBarRef` and `progressDotRef`. Eliminates ~60 re-renders/sec during scroll.
- **getMoodCPU array hoisting** (`mood.ts`): `MOOD_KEYFRAMES` constant hoisted to module level instead of being recreated inside function on every call.
- **Navigation transition fix** (`Navigation.tsx`): Dialog `transitionend` now waits for `propertyName === "opacity"` with idempotency guard and fallback timeout.
- **Navigation paddingTop fix** (`Navigation.tsx`): Uses `max()` CSS function combining rem value with `env(safe-area-inset-top)`.
- **Navigation transition-property** (`Navigation.tsx`): Changed from `transition-all` to explicit `transition-[background-color,border-color,box-shadow,padding]`.
- **Navigation font-display** (`Navigation.tsx`): Logo text uses `fontFamily: var(--font-display)`.

### Awwwards Audit Fixes — IMPLEMENTED (commit 33e89a6)
- **Code splitting** (`page.tsx`): `next/dynamic({ ssr: false })` on 5 heavy client components (ScrollVideoPlayer, ScrollStoryOverlay, Contact, Footer, CustomCursor) — reduces initial bundle, enables parallel chunk loading
- **Contact API route** (`api/contact/route.ts`, `Contact.tsx`): Server-side validation POST endpoint replacing broken `mailto:`. UI has `sending`/`submitError` states, disabled button during submit. Ready for Resend/SendGrid integration.
- **Cursor contextual labels** (`useUIStore.ts`, `CustomCursor.tsx`): `cursorLabel` in Zustand store. Third floating element follows ring center (independent of ring scale). Labels: "Reservar" (CTA), "Enviar" (submit), "Arriba" (back-to-top), "Abrir" (social links), "Email" (booking).
- **Album/show card visuals** (`ScrollStoryOverlay.tsx`): Album cards now have richer gradients with glow `boxShadow` + decorative vinyl-groove concentric circles. Show cards use inline SVG icons (music note, lightning bolt, wind, orbital) replacing unreliable Unicode symbols.
- **WCAG AA contrast** (`globals.css`): `--aura-gold-dim` brightened `#8A7435` → `#9A8240` (contrast ratio 3.8:1 → 5.5:1 on `--bg-void`).
- **Font size floor** (6 files): All `text-[9px]`/`text-[10px]` instances raised to `text-[11px]` minimum. Preloader pct text `clamp(9px,...)` → `clamp(11px,...)`. Affects Navigation side dots, mobile social links; Contact section labels; Footer section headers + cite; ScrollStoryOverlay bio + closing text.
- **font-display headings** (`Contact.tsx`, `Footer.tsx`): Added `fontFamily: var(--font-display)` on Contact heading and Footer brand IVANN/AURA headings.
- **Full-video preloader** (`Preloader.tsx`): `isVideoReady()` now requires `buffer >= 0.99` (was 0.9 or `canplaythrough`). Ensures buttery-smooth scroll scrubbing. Fallback timeout 45s (was 20s).
- **Particle clustering fix** (`cinema-gl.ts`): `resize()` now scales particle positions proportionally to new canvas dimensions — fixes particles clustering in top-left when initial canvas was small.

### Math/Physics Bugs — FIXED (session 3, commits 38308d8, 985b225)
- ~~**Cursor scroll velocity accumulation**~~ → non-cumulative `= clamp(delta * scale)` (was `+=` without bound)
- ~~**Particle life/maxLife mismatch**~~ → single `Math.random()` extracted to variable (was two independent calls)
- ~~**sampleLumGrad NaN propagation** (critical)~~ → clamped grid indices with `Math.max(0, Math.min(max, idx))`
- ~~**sampleLumGrad row-wrapping**~~ → column-aware neighbor sampling (was `idx ± 1` wrapping across rows)
- ~~**Frequency band accumulated dt**~~ → EMA receives total dt across 2-frame skip (was single-frame dt)
- ~~**Audio drift correction linear**~~ → exponential `1 - Math.pow(0.9, dt)` (was linear `0.1 * dt`)

### Mobile/iOS Hardening — IMPLEMENTED (session 3, commit 38308d8)
- Lenis `syncTouch: !isIOS` (conflicts with Safari rubber-band physics)
- CinemaGL iOS tier cap → 'mid' (deviceMemory always undefined on iOS)
- DPR cap 1.5 on mobile (reduces GPU fill rate on phones)
- `dvh` letterbox bars (correct on iOS with dynamic toolbar)
- iOS touch unlock retry (keep listener until video readyState >= 1)
- `@media (hover: hover)` wrapping hover-only CSS (prevents stuck hover on touch)
- `pointerType === 'touch'` detection to skip click impulse on mobile
- PianoIndicator hint hidden on mobile, min font 11px
- `safe-area-inset-bottom` on mobile nav dialog
- Audio primer: listeners stay until `ctx.resume()` succeeds (not on first click)

### Non-cumulative Momentum — IMPLEMENTED (session 3, commit 985b225)
- `setScrollVelocity()` replacing per-frame `addImpulse()` for scroll
- Energy soft-follows velocity (non-cumulative, prevents saturation)
- Scroll velocity decays 3× faster than energy (vinyl tail)
- Vinyl drift callback: push Lenis when energy lingers after scroll stops
- 200px/s threshold prevents drift→energy→drift feedback loop
- ScrollStoryOverlay: progressRef exit guard for fast-scroll-during-entry

### CinemaGL Optimizations — IMPLEMENTED (session 3, worktree agents)
- `mediump` precision in bloom/blur/particle fragment shaders (2× throughput on mobile)
- `texSubImage2D` for subsequent video frames (skip format negotiation)
- `requestVideoFrameCallback` guard (skip redundant uploads on 120Hz+)
- Luminance gradient gated by `energy > 0.01`
- Kawase blur constant uniforms hoisted outside loop (saves 12 GL calls/frame)

### Preloader Improvements — IMPLEMENTED (session 3, commit 38308d8)
- Real buffer progress tracking with percentage display
- MutationObserver for instant video element detection (replaces setTimeout)
- 99% buffer threshold before exit (ensures smooth scroll scrubbing)
- 45s fallback timeout (allows full 44MB download on slow connections)

### Remaining (not yet implemented)
- **3 separate RAF loops**: ScrollVideoPlayer, AudioMomentum, and CustomCursor each run their own `requestAnimationFrame`. Should coalesce into GSAP ticker.
- **Contact API email delivery**: `/api/contact` currently logs submissions. Connect to Resend/SendGrid for actual email delivery.

## Conventions

- All overlay content is in Spanish
- Letterbox 2.39:1 aspect ratio to hide corporate banners
- `object-cover` on video/canvas for fullscreen display
- Frame indices use 3fps equivalence: `frameIndex = Math.floor(videoTime * 3)`
- Story beats in ScrollStoryOverlay use these frame indices for timing
- Mobile menu uses native `<dialog>` with `showModal()` for WCAG-compliant focus management
- Cursor variants: `"default" | "hover" | "hidden"` + `cursorLabel: string | null` for contextual text inside ring ("Reservar", "Enviar", "Arriba", "Abrir", "Email")
- CustomCursor uses CSS `style.translate` property (not `transform: translate()`) for GPU compositing without string allocation
- Scrollbar hidden on `html` element (not `body`) for Lenis compatibility
- Section entrance animations use GSAP ScrollTrigger + `data-reveal` attributes (not CSS `.reveal-up`)
- Contact line animation uses GSAP + `data-line` (not CSS `.line-grow`)
- Magnetic hover: add `className="magnetic-btn"` to any button for Awwwards-style cursor follow
- Film grain is shader-only (CSS grain overlay removed to avoid duplication)
- Energy state throttled: `useRef` at 60fps → `useState` at 10fps via `setInterval(100ms)`
- Social links: real URLs with `target="_blank" rel="noopener noreferrer"`
- Contact form: `POST /api/contact` with server-side validation + fetch + loading/error states + `aria-describedby` error linking
- Programmatic scroll: use `useLenis()` from `lenis/react` — **never** `window.scrollTo/scrollBy/scrollIntoView` (conflicts with Lenis smooth scroll)
- `color-scheme: dark` in `:root` for native form control colors
- CinemaGL: vertex + cinema/composite frags use `precision highp float;`; bloom/blur/particle frags use `mediump` (2× throughput on mobile). Mismatched precision between vertex/fragment causes link failure
- CinemaGL: `createProgramFromSources` detaches and deletes shaders after linking (prevents shader object leaks)
- CinemaGL: `lumPixels` Uint8Array pre-allocated once (not per readPixels call)
- CinemaGL: luminance grid uses async PBO readback (`PIXEL_PACK_BUFFER` + `getBufferSubData`) — no GPU pipeline stall
- CinemaGL: Kawase bloom result FBO dynamically selected based on `KAWASE_ITERATIONS % 2` (ping-pong correctness)
- CinemaGL: video texture upload guarded by `lastVideoTime` + `requestVideoFrameCallback` (when available) — skips redundant uploads on 120Hz+ monitors. Uses `texSubImage2D` for subsequent frames (faster, format already negotiated)
- CinemaGL: FBO textures use `texStorage2D` (immutable) — resize via delete+recreate, with no-op guard on same dimensions
- CinemaGL: `glColorMask(true,true,true,false)` on cinema/bloom/composite passes, restored `(true,true,true,true)` before additive particles
- CinemaGL: `sampleLumGrad` returns pre-allocated `_gradResult` object (zero-alloc per particle per frame)
- AudioMomentum: `play()` Promise callback guards against destroyed instance (`if (!this.running) return`)
- MicroSounds: `getCtx()` re-acquires if shared AudioContext was closed; resets voice pools on context change
- CinemaGL: `webglcontextlost` / `webglcontextrestored` events tracked — render skips when context lost
- CinemaGL: all `gl.create*()` calls null-checked (no `!` non-null assertions on losable GL objects)
- SharedAudioContext: `releaseAudioContext()` guards against negative refCount
- ScrollVideoPlayer: `audioMuted` applied to freshly created AudioMomentum via ref (React effect ordering)
- ScrollVideoPlayer: bass shake via `shakeRef` (ref-based transform on sticky div, no re-render)
- ScrollVideoPlayer: dynamic letterbox bars (4dvh `--bg-void` divs, `style.scale` varies with mood via `1.6 - mood * 0.8` — CSS scale property, not transform)
- ScrollStoryOverlay: `data-reactive` letter-spacing is continuous (`energy * bands.mids * 0.08`), no threshold gate
- ScrollStoryOverlay: exit guard simplified to `progress <= 0.8` (removed `tl.totalProgress() < 1` which caused fast-scroll glitches)
- ScrollStoryOverlay: non-split beats exit via CSS opacity fade on ref style (not GSAP)
- ScrollStoryOverlay: parallax uses CSS `translate` property (not `transform`) to avoid GSAP composition conflicts
- Page: atmospheric haze div with `--haze-color` CSS property driven by continuous mood interpolation (getMoodCPU)
- Page: `displayBands` state uses shallow equality check (0.01 threshold) to avoid re-renders
- Navigation: `aria-controls="mobile-menu"` on hamburger, `id="mobile-menu"` on dialog
- Navigation: mobile social links have `aria-label` for screen readers
- Side dot navigation buttons have `focus-visible:ring` for keyboard users
- Reduced-motion CSS: only `animation-*` properties are overridden; transitions preserved for focus/hover
- `setMicroSoundsMuted` called from ScrollVideoPlayer only (not duplicated in Navigation)
- `<video>` and `<canvas>` have `aria-hidden="true"` (decorative, content conveyed by overlay text)
- Navigation: scroll progress bar uses `transform: scaleX()` + `transformOrigin: left` (GPU composited, not `width%`)
- Navigation: logo bar height offsets are fixed values `[1.12, 1.24, 1.30, 1.18, 1.08]` (not `Math.random()` in useMemo)
- Navigation: mobile dialog entrance via CSS `@starting-style`, exit via `.dialog-closing` class (no JS animation)
- CustomCursor: ring hover uses CSS `scale: "1.5"` (not width/height change)
- CustomCursor: scroll velocity → ring directional stretch `scaleY(1 + velocity * 0.3)` capped at 1.4
- MagneticButtons: `mouseout` delegation resets button transform and clears currentBtn on leave (prevents stuck state)
- PianoIndicator: wave cascade with per-bar `transitionDelay: Math.abs(i - 2) * 20` ms (center → outward)
- PianoIndicator: idle breathing via `@keyframes piano-idle` with staggered delays when `!isActive`
- Preloader: iris-close exit via `clipPath: "circle(0% at 50% 50%)"` + content scale-down for depth
- Preloader: real buffer progress tracking with percentage display, MutationObserver for video detection
- Preloader: reduced-motion users bypass exit animation (dismiss immediately)
- Preloader: fractal noise grain overlay (`feTurbulence`, opacity 0.03) for cinematic texture during load
- Preloader: h1 uses `fontFamily: var(--font-display)` (Cormorant Garamond) — not inherited body font
- ScrollStoryOverlay: all headings use `font-display` class (Cormorant Garamond serif)
- ScrollStoryOverlay: all text over video uses `.text-cinema` for double text-shadow legibility
- ScrollStoryOverlay: minimum font size 11px across all elements (no 9px/10px)
- ScrollStoryOverlay: stats/cards/albums use `flex-wrap justify-center` with responsive gaps for mobile
- Contact: validation errors use 12px warm red (#DC4A4A) — not 10px dark crimson
- Contact: submit button has `focus-visible:ring` for keyboard users
- Contact: social links have `min-h-[44px]` touch targets (matching Footer)
- Contact: gold gradient divider at bottom for visual separation from Footer
- Contact: success checkmark is SVG (not Unicode character) for cross-platform consistency
- Contact: success state animated via GSAP (circle `back.out(1.7)` + staggered text slide-up)
- AudioMomentum: playbackRate uses exponential curve `Math.pow(energy, 0.7)` before lerp (vinyl-like slowdown)
- AudioMomentum: `setMuted()` uses GainNode gain ramp (not `audio.muted`) to preserve AnalyserNode signal for visual reactivity
- AudioMomentum: logarithmic volume `Math.pow(volume, 2)` routed through `GainNode.gain.setTargetAtTime()` with JND 0.005 threshold (not `audio.volume`)
- MicroSounds: `playHover()` tracks `lastNoteIndex` with do-while to prevent consecutive same notes
- Footer: blockquote attribution uses `<footer><cite>` for proper semantics
- Footer: AURA heading uses `querySelectorAll("[data-brand]")` with staggered SplitText entrance
- Footer: 44px min touch targets on social links, handles visible on mobile (`opacity-60 md:opacity-0`)
- SmoothScroll: custom easing `Math.min(1, 1.001 - Math.pow(2, -10 * t))` (exponential ease-out, vinyl feel)
- SmoothScroll: `gestureOrientation: "vertical"`, `gsap.ticker.lagSmoothing(500, 33)`
- ScrollVideoPlayer: mobile haptic `navigator.vibrate([15, 30, 15])` at act boundaries (try-catch, progressive enhancement)
- usePianoScroll: M key toggles mute (keyboard-only users), visual feedback on `#piano-indicator`
- usePianoScroll: delta-time friction with `lastTimeRef`
- Error boundary: `src/app/error.tsx` for Next.js App Router error handling
- Navigation: uses Zustand `toggleSoundMuted()` directly (no prop-based onSoundToggle)
- Navigation: throttled scroll handler with rAF, 44px hamburger touch target (w-11 h-11)
- Navigation: mobile dialog includes sound toggle
- Preloader: 45s timeout, waits for 99% buffer, responsive subtitle, iris-close 0.01%
- CustomCursor: pauses rAF when not visible, delta-time ring lerp, delta-time scroll velocity decay
- CustomCursor: reduced-motion → `cursor:none` gate (disabled entirely)
- MagneticButtons: cached `getBoundingClientRect` with resize invalidation
- PianoIndicator: bar heights clamped to 100%, `safe-area-inset-bottom`
- Contact: WhatsApp CTA (`wa.me/573102254687`), tel: link, form autocomplete/enterkeyhint, "Enviar otro mensaje" success reset
- Page: inlined `getMoodCPU` (avoids importing 1209-line cinema-gl), Zustand soundMuted replacing local useState
- Page: hidden `<h1>` for SEO, haze computation gated by progress delta, `tabIndex={-1}` on `<main>`
- CSS: `overscroll-behavior: none` on html, `.text-cinema` text-shadow utility, `content-visibility: auto` on Contact/Footer
- CSS: global `input:focus-visible` ring style
- **Delta-time correction pattern**: `Math.exp(LN_CONSTANT * dt)` where `LN_CONSTANT = Math.log(c)` precomputed at module level, `dt = (now - lastTime) / 16.667` — applied in audio-momentum, usePianoScroll, ScrollVideoPlayer, CustomCursor, cinema-gl particles
- **Touch targets**: all interactive elements meet 44px minimum (WCAG 2.5.5)
- **Safe area insets**: applied in Navigation, PianoIndicator (`env(safe-area-inset-*)`)
- Preloader: conductor's baton (gold gradient line, GSAP scaleX(0→1)) sweeps during name reveal, fades after
- Preloader: title float during progress bar (`y: -4, yoyo: true, repeat: 1`)
- Preloader: subtitle word-stagger via SplitText `type: "words,chars"` (words 0.12s, chars 0.015s)
- Navigation: gold diamond separator (4px rotated-45deg) between progress bar sections
- Navigation: active side dot sonar pulse (`@keyframes dot-echo`)
- Navigation: gold particle dot on progress bar leading edge (`nav-progress-shimmer`)
- ScrollStoryOverlay: per-letter opacity gradient on "IVANN" (decreasing opacity across chars)
- ScrollStoryOverlay: act label numbers colored gold, body text default
- ScrollStoryOverlay: decorative `\u201C` quote marks (positioned absolute, 6vw, gold 35% opacity)
- ScrollStoryOverlay: stats have staggered translateY offsets, albums have subtle rotate offsets
- ScrollStoryOverlay: audio-reactive color warmth via `color-mix(in srgb, var(--text-primary) N%, var(--aura-gold))`
- ScrollStoryOverlay: `.act-rule` gold accent lines drawn before act labels (CSS `scaleX(0→1)` animation)
- ScrollStoryOverlay: `.cta-underline` on "VIVE LA EXPERIENCIA" (hover `::after scaleX` draw-in)
- Contact: `.contact-field::after` gold gradient glow on focus (CSS `scaleX(0→1)`)
- Contact: `.contact-label` floating labels shrink + gold on focus/has-value
- Contact: `.contact-submit` shimmer sweep on hover (motion-gated `@keyframes shimmer-sweep`)
- Contact: `.gold-glow-text` pulsing text-shadow on key words (motion-gated `@keyframes gold-text-glow`)
- Footer: `.footer-brand` text-stroke engraving effect on hover (`-webkit-text-stroke: 1px`, `color: transparent`)
- Footer: `.footer-social-line` extending gold decorative line (0→24px) on link hover
- Footer: oversized gold quotation marks on blockquote (6rem, opacity 0.07/0.05)
- Footer: `.footer-arrow-bounce` animation on back-to-top hover
- Footer: `.footer-bottom-bar::before` noise texture on copyright area
- CSS: all new decorative animations wrapped in `@media (prefers-reduced-motion: no-preference)` block
- CinemaGL: idle gating skips full pipeline after 3 frames of unchanged inputs (energy, velocity, bands, mouse, video frame, actTransition)
- Navigation: scroll progress uses ref-based DOM manipulation (not useState) to avoid 60fps re-renders
- getMoodCPU: `MOOD_KEYFRAMES` hoisted to module level (constant array, not per-call allocation)
- Navigation: `transition-property` explicitly lists animated properties (not `transition-all`)
- Code splitting: heavy client components use `next/dynamic({ ssr: false })` in `page.tsx` (ScrollVideoPlayer, ScrollStoryOverlay, Contact, Footer, CustomCursor)
- CustomCursor: third element (`labelRef`) follows ring center for contextual text labels, uses CSS `translate` + `transform: translate(-50%,-50%)` for centering
- CustomCursor: when `cursorLabel` is set, dot hides (scale 0), ring expands (scale 2.2), label fades in
- Contact: `setCursorLabel` helper functions `hoverIn(label?)` / `hoverOut()` for concise event handlers
- Contact: form submits via `POST /api/contact` with `fetch()`, not `mailto:`
- Contact: `sending` state disables submit button with "Enviando..." text + `cursor-wait`
- CinemaGL: `resize()` scales particle positions proportionally (`particles[i].x *= sx`) to prevent clustering
- Preloader: full-video download required (`getBufferProgress() >= 0.99`) before iris-close exit
- ScrollStoryOverlay: show card icons are inline SVGs (not Unicode) for cross-platform rendering
- ScrollStoryOverlay: album cards have vinyl-groove concentric circles (3 nested `rounded-full` divs)
- AudioMomentum: `setScrollVelocity()` for non-cumulative scroll energy; `addImpulse()` for discrete keypress/click only
- AudioMomentum: scroll velocity decays 3× faster than energy via `Math.exp(LN_FRICTION * dt * 3)` — creates vinyl tail
- AudioMomentum: accumulated dt for frequency analysis across 2-frame skip (`this.accumulatedDt`)
- AudioMomentum: drift correction uses exponential `1 - Math.pow(0.9, dt)` not linear `0.1 * dt`
- CinemaGL: `sampleLumGrad` clamps grid indices with `Math.max(0, Math.min(max, idx))` — prevents NaN from out-of-bounds particles
- CinemaGL: `sampleLumGrad` uses column-aware neighbors (not `idx ± 1`) to prevent row-wrapping
- CinemaGL: `spawnParticle` extracts `Math.random()` to a variable for `life`/`maxLife` (never call `Math.random()` twice for same value)
- CinemaGL: `detectTier()` order: reduced-motion → iOS → desktop GPU capabilities
- CinemaGL: luminance gradient computation gated by `energy > 0.01` (skip when idle)
- CinemaGL: Kawase blur constant uniforms (texture unit, VAO) hoisted outside iteration loop
- ScrollVideoPlayer: `onScrollDrift` callback prop for vinyl drift (page.tsx pushes Lenis)
- ScrollVideoPlayer: `requestVideoFrameCallback` integration via `newVideoFrameRef` + `hasRVFCRef`
- ScrollVideoPlayer: DPR capped at 1.5 on mobile (`window.innerWidth < 768`)
- ScrollVideoPlayer: letterbox bars use `dvh` not `vh` (correct on iOS dynamic toolbar)
- SmoothScroll: `syncTouch: !isIOS` — iOS detected at module load via UA + `maxTouchPoints > 1`
- usePianoScroll: `pointerType === 'touch'` detection via `pointerdown` listener to skip click handler on mobile
- PianoIndicator: hint text `hidden md:inline` (no keyboard on mobile)
- Navigation: mobile dialog `paddingBottom: max(2rem, env(safe-area-inset-bottom))`
- CSS: hover-only styles wrapped in `@media (hover: hover)` — prevents stuck hover on touch devices
- CustomCursor: scroll velocity is non-cumulative (direct assignment, not `+=`)
- SharedAudioContext: primer listeners stay alive until `ctx.resume()` promise resolves (not on first event)
- Preloader: MutationObserver detects dynamically-imported `<video>` instead of `setTimeout` polling
- Preloader: `getBufferProgress() >= 0.99` required before exit (full video for smooth scroll scrubbing)
- ScrollStoryOverlay: `progressRef` tracks current progress for exit guard in entry `onComplete`
- See `docs/CONVENTIONS.md` for full technical conventions
