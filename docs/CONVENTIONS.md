# IVANN AURA — Technical Conventions

## Scroll-Driven Video

### Why not normal video playback?

The video is not "played" — it is **scrubbed** by scroll position. This creates a cinematic experience where the user controls the pacing. The page is the timeline.

### The scroll → video pipeline

```
User scrolls
    ↓
Lenis smooth scroll (lerp 0.08, autoRaf: false)
    ↓
GSAP ticker drives lenis.raf(time * 1000)  (single RAF loop)
    ↓
gsap.matchMedia() → ScrollTrigger (scrub: 1.5 desktop / 2 mobile / true reduced-motion)
  progress = scroll position 0-1
    ↓
targetTime = progress * videoDuration
safeTime = clampToBuffered(targetTime)
video.currentTime = safeTime
    ↓
frameIndex = Math.floor(safeTime * 3) → ScrollStoryOverlay
    ↓
onEnergyChange → energyRef (60fps) → displayEnergy (10fps via setInterval)
onBandsChange → bandsRef (60fps) → displayBands (10fps)
    ↓
Cinema rAF loop:
  cinema.render({ video, time, energy, progress, bands, mouseX, mouseY, velocity })
  → WebGL post-processing + luminance-reactive particles
```

### Why GSAP ScrollTrigger instead of manual inertia?

The previous system used a custom rAF loop with exponential easing and speed capping (`scrollTargetRef`, `EASE_FACTOR=0.1`, `MAX_SCRUB_SPEED=3.0`). GSAP's `scrub: 1.5` replaces ~150 lines with one config value and provides:

- Battle-tested smooth interpolation (1.5s catch-up = vinyl feel)
- Built-in velocity tracking (`self.getVelocity()`)
- Automatic cleanup and SSR safety
- No manual `requestAnimationFrame` management for scroll sync

### Video encoding for scroll scrubbing

Normal video encoding uses keyframes every 2-10 seconds. When the browser seeks to `video.currentTime = 45.3`, it must:
1. Find the nearest keyframe (e.g. at second 44)
2. Decode ALL intermediate frames to reach 45.3
3. Display the result

With 30fps and keyframes every 2 seconds, that is up to **60 frames of decoding per seek**. At 60 scroll events per second, the browser melts.

**Solution: all-intra encoding** (`-g 1`). Every frame is a keyframe. Seeking is instant — the browser decodes exactly one frame.

```bash
ffmpeg -i source.mp4 \
  -vf "crop=in_w:in_w/2.39,scale=960:-2" \
  -c:v libx264 -profile:v high -level 4.2 -pix_fmt yuv420p \
  -crf 30 \
  -g 1 \     # EVERY frame is a keyframe
  -bf 0 \    # no B-frames (simplifies seeking)
  -an \      # strip audio (separate file)
  -movflags +faststart \   # moov atom first (critical for CDN)
  output.mp4
```

### Trade-off: file size vs seek performance

| `-g` value | Decode per seek | File size multiplier | Use case |
|------------|-----------------|---------------------|----------|
| 1 | 0 (instant) | 1.7x | Scroll scrubbing (our choice) |
| 3 | max 2 | 1.3x | Good middle ground |
| 15 (~0.5s) | max 14 | 1.0x | Normal video |
| 250 (default) | max 249 | 0.9x | Never for scrubbing |

### The `+faststart` flag

The MP4 "moov atom" is the table of contents (codec info, frame byte offsets, timestamps). By default it's written at the END of the file.

Without `+faststart`: browser downloads the entire file before it can seek.
With `+faststart`: moov atom is at the start, browser can seek immediately via HTTP range requests.

**Always use `+faststart` for web video.**

### Strip audio from video

Since we use a separate audio file driven by AudioMomentum, the embedded video audio is wasted bandwidth. Use `-an` to remove it.

---

## Audio Momentum

### The physics model

```
addImpulse(0.2)  ←── user interaction (scroll, key, click)
      ↓
energy = min(1.0, energy + IMPULSE)
      ↓
Per frame:
  energy *= FRICTION (0.985)     ←── exponential decay
  rate = lerp(0.25, 1.0, energy)
  volume = smoothstep(0, 0.15, energy) * 0.7
      ↓
audio.playbackRate = rate
audio.volume = volume
audio.preservesPitch = false     ←── pitch drops with rate = vinyl effect
```

### Why `preservesPitch = false`?

Normally browsers correct pitch when changing playbackRate (so audio at 0.5x sounds the same pitch, just slower). Disabling this makes the pitch drop with the rate — exactly like a vinyl record slowing down. This is the core of the "vinyl feel."

### Audio ↔ Video sync

The audio and video are separate elements. They drift apart because audio plays continuously while video is scrub-seeked. A drift check runs every frame:

```
if abs(audio.currentTime - videoTime) > 3.0 seconds:
  audio.currentTime = videoTime   // hard re-sync
```

3 seconds is generous because the audio is atmospheric (concert footage) — perfect sync is not critical, and frequent re-syncs cause audible glitches.

### Energy thresholds

- `PLAY_THRESHOLD = 0.05` — start audio playback
- `STOP_THRESHOLD = 0.02` — pause audio (with natural fade from smoothstep)
- Hysteresis (play > stop) prevents rapid play/pause toggling near threshold

### Energy half-life

`FRICTION = 0.985` per frame. At 60fps: half-life ≈ 46 frames ≈ 766ms. This means energy drops to 50% about 0.77 seconds after the last impulse. The decay is fast enough to feel responsive but slow enough for the audio to fade naturally rather than cutting.

### Shared AudioContext

AudioMomentum and MicroSounds share one `AudioContext` via `shared-audio-context.ts`. This is critical because iOS Safari limits pages to 4 AudioContexts total. The module uses ref counting: `acquireAudioContext()` increments, `releaseAudioContext()` decrements. The context only closes when the last consumer releases.

### Frequency Analysis

`AnalyserNode` with `fftSize=256` → 128 frequency bins. Bands:
- Bass (bins 0-10): drives vignette breathing, particle size pulse
- Mids (bins 10-50): drives chromatic aberration boost
- Highs (bins 50-128): drives bloom intensity, particle glow

EMA smoothing with `BAND_ALPHA=0.2`: `smooth = lerp(smooth, raw, 0.2)`. Convention: `lerp(old, new, alpha)`.

### Visibility API integration

When the tab goes hidden (`document.hidden`), AudioMomentum:
1. Pauses audio playback
2. Stops the rAF loop (saves CPU)
3. On return: decays energy by `Math.pow(FRICTION, elapsedFrames)` — the audio doesn't slam back in after a long tab switch

---

## WebGL Post-Processing (CinemaGL)

### Dynamic Narrative Mood

The cinema shader uses a `u_progress` uniform (0-1 from scroll position) to vary effect intensity across 8 narrative acts via smooth Hermite interpolation:

| Act | Name | Mood | Effect |
|-----|------|------|--------|
| 1 | Despertar | 0.5 | Gentle — minimal effects |
| 2 | Entrada | 0.6 | Warming up |
| 3 | Danza | 0.8 | Building — stronger aberration |
| 4 | Espectáculo | 0.9 | Strong vignette |
| 5 | Fuego | 1.1 | Peak — maximum effects |
| 6 | Clímax | 1.2 | Maximum glow + aberration |
| 7 | Resolución | 0.8 | Calming back down |
| 8 | Cierre | 0.5 | Peaceful — back to gentle |

All effects scale with `mood`:
- **Chromatic aberration**: `d * 0.002 * (1 + energy * 3 + mids * 2) * mood` + directional from cursor + velocity smear
- **Vignette**: tighter edges during intense acts, with bass-reactive breathing
- **Film grain**: `0.04 + mood * 0.025` — the only grain on the page (CSS overlay removed)
- **Bloom**: lower threshold at peak = more glow, boosted by highs

### Particle Buffer Strategy

Particles use pre-allocated `DYNAMIC_DRAW` buffer. Updated per frame with `bufferSubData` (avoids reallocation overhead of `bufferData` every frame). 250 particles × 4 floats (x, y, alpha, size) = 4KB per frame.

### Graceful degradation

`initCinemaGL()` returns `null` if WebGL is unavailable. `ScrollVideoPlayer` tracks `hasGL` state — when false, the raw `<video>` element is shown directly with `opacity: 1`.

---

## Particle System

250 GL_POINTS with additive blending (`gl.blendFunc(SRC_ALPHA, ONE)`) creating glowing light motes.

### Energy response (VISION "Regla de Oro")

Speed multiplier: `0.05 + energy * 0.95` — particles nearly freeze when scroll stops (5% drift), full speed at peak energy. This ensures everything on screen is tied to user interaction.

### Colors

- Idle: `--particle-core` (#FFFDE8) — warm white dust
- Active: `--aura-gold-bright` (#E8C85A) — energized gold
- Interpolated by `u_energy` in the fragment shader

### Lifecycle

Each particle has `life` / `maxLife` counters. Alpha fades in over first 20% and out over last 30% of life. Gentle upward drift simulates dust in a sunbeam. Particles wrap at screen edges.

---

## Frame Indexing

All story beat timing uses **3fps frame indices**:

```typescript
frameIndex = Math.floor(videoTime * 3)
```

This means:
- Second 0.0 = frame 0
- Second 10.0 = frame 30
- Second 245.3 (end) = frame 735

Story beats in `ScrollStoryOverlay` reference these frame indices:
```typescript
{ frameStart: 0, frameEnd: 30, content: "...", ... }  // seconds 0-10
```

### Why 3fps?

The original frame-based approach extracted 3 frames per second as images. When we switched to video, we kept the same indexing for compatibility with the storyboard data.

---

## Buffered Seek Clamping

On CDN (Vercel), the video downloads progressively. Seeking past the buffered range causes the browser to stall while it fetches the data.

```typescript
function clampToBuffered(video, time) {
  // Find contiguous buffer starting from 0
  for (let i = 0; i < video.buffered.length; i++) {
    if (video.buffered.start(i) <= 0.5) {
      return Math.min(time, video.buffered.end(i) - 0.1);
    }
  }
  return 0;
}
```

With all-intra encoding, any buffered position is instantly seekable. We start the experience at 15% buffered (about 37 seconds of video).

---

## CSS & Design

### Tailwind v4 with `@theme inline`

Design tokens are CSS custom properties defined in `globals.css`:

```css
@theme inline {
  --color-aura-gold: #C9A84C;
  /* ... */
}
```

Use them in components with `var(--aura-gold)` or Tailwind classes.

### Film Grain

Grain is **shader-only** — the `cinema-gl.ts` fragment shader renders animated noise. The old CSS `.grain::after` pseudo-element was removed to avoid duplicate grain effects. No `grain` class on `<body>`.

### Scrollbar

Scrollbar is hidden on `html` (not `body`) for Lenis compatibility:
```css
html::-webkit-scrollbar { width: 0; }
html { scrollbar-width: none; }
```

### Section Animations

All section entrance animations use GSAP ScrollTrigger with `data-reveal` attributes:
```tsx
<div data-reveal>...</div>  // GSAP targets these
```
The old CSS `.reveal-up` / `.reveal-up.active` IntersectionObserver system was removed.

### Magnetic Buttons

Add `className="magnetic-btn"` to any button element for Awwwards-style hover where the button subtly follows the cursor. CSS `transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)` provides the spring-back. Handled globally by `MagneticButtons` provider. Desktop only, respects `prefers-reduced-motion`.

### Letterbox (2.39:1)

The video is cropped to 2.39:1 anamorphic aspect ratio to:
1. Hide corporate banners from the source video
2. Create a cinematic widescreen feel
3. The `object-cover` CSS property fills the viewport, cropping top/bottom letterbox bars

---

## Contact Form

Uses `mailto:` with pre-filled subject and body (zero-backend approach):
```typescript
window.open(`mailto:booking@ivannaura.com?subject=${subject}&body=${body}`, "_self");
```

Client-side validation: name required, email format check, message required. Error messages in Spanish using `--crimson` color.

Input styling: Tailwind `focus:border-[var(--aura-gold-dim)]` classes (no inline `onFocus`/`onBlur` style mutations).

---

## State Management

Zustand store (`useUIStore`) manages ephemeral UI state:

| State | Purpose | Used by |
|-------|---------|---------|
| `menuOpen` | Mobile menu toggle | Navigation |
| `cursorVariant` | Cursor style: `"default" | "hover" | "hidden"` | CustomCursor, all components |

### Energy + Frequency Bands Flow

Energy and frequency bands flow from `ScrollVideoPlayer` to display components via a throttled pattern:

```
ScrollVideoPlayer render loop (60fps)
  → onEnergyChange(e) → energyRef.current = e  (zero-cost ref write)
  → onBandsChange(b)  → bandsRef.current = b
      ↓
setInterval(100ms) reads refs → setDisplayEnergy(), setDisplayBands()
      ↓
PianoIndicator receives { energy, bands } as props (10fps re-renders)
Navigation receives { audioActive: energy > 0.05 } (10fps)
```

This reduces React re-renders from 60/s to 10/s — a 6x improvement.

---

## Performance Patterns

### rAF loops with cleanup

Every `requestAnimationFrame` loop must store its ID and cancel on cleanup:

```typescript
useEffect(() => {
  let frameId = 0;
  const tick = () => {
    // ... work ...
    frameId = requestAnimationFrame(tick);
  };
  frameId = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frameId);
}, [deps]);
```

### Passive scroll listeners

All scroll event listeners use `{ passive: true }` since we never call `preventDefault()`.

### Avoid React state in hot paths

The rAF loops and scroll handlers use refs (`useRef`) instead of state (`useState`) to avoid triggering React re-renders on every frame. State is only used for values that need to trigger UI updates, and even then throttled to ~10fps via `setInterval`.

### CustomCursor: transform compositing

The cursor uses `transform: translate()` instead of `left`/`top` for GPU-composited positioning. Combined with `will-change: transform` in CSS, the cursor elements get their own compositor layers, making 60fps animation essentially free (no layout recalculation).

### querySelector caching

Navigation caches `document.querySelector()` results on first scroll event instead of querying the DOM every frame. The cached elements array is reset only when the effect re-runs.

### WebGL buffer strategy

Particle buffer uses `bufferData` once (pre-allocation) + `bufferSubData` per frame (update). This avoids WebGL reallocation overhead compared to calling `bufferData` with new data every frame.

---

## File Organization

```
src/
  app/
    layout.tsx         Root layout (fonts, preloader, magnetic buttons, smooth scroll)
    page.tsx           Home page (orchestrates all components, energy throttle)
    globals.css        Design tokens, cursor styles, magnetic-btn, reduced-motion
  components/
    providers/
      SmoothScroll.tsx    Lenis wrapper (typed LenisRef)
      MagneticButtons.tsx Global magnetic button hover effect
    ui/
      ScrollVideoPlayer.tsx   Core scroll-video engine + onBandsChange
      ScrollStoryOverlay.tsx  Frame-synced narrative beats (stable keys)
      Navigation.tsx          Fixed nav + progress bar (cached querySelector)
      CustomCursor.tsx        GPU-composited transform cursor + viewport events
      PianoIndicator.tsx      Frequency-reactive equalizer (bass/mids/highs)
      Preloader.tsx           Cinematic loading screen
      Footer.tsx              GSAP SplitText entrance + real social links
    sections/
      Contact.tsx             GSAP ScrollTrigger entrance + mailto: form + validation
  hooks/
    usePianoScroll.ts  Keyboard/click → scroll (a-z keys, reduced-motion aware)
  lib/
    audio-momentum.ts      Physics-driven audio + AnalyserNode (shared AudioContext)
    cinema-gl.ts           WebGL post-processing + particles (bufferSubData)
    micro-sounds.ts        Web Audio oscillators (shared AudioContext)
    shared-audio-context.ts Ref-counted singleton AudioContext
  stores/
    useUIStore.ts      Global UI state: cursor variant + menu (Zustand)
vercel.json            Cache headers for videos/audio (immutable, 1 year)
```
