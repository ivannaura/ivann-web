# IVANN AURA — Parallel Mega-Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all ~235 priority findings (CRITICAL + HIGH + P0/P1) across 23 source files in one session using parallel agents with git worktrees.

**Architecture:** 3-phase execution with file-level ownership to guarantee zero merge conflicts. Phase 1 (foundation) edits shared modules sequentially. Phase 2 dispatches 6 parallel agents, each owning exclusive files. Phase 3 integrates cross-cutting concerns and runs typecheck.

**Tech Stack:** Next.js 16.2.1, React 19.2.4, TypeScript, Tailwind v4, GSAP, WebGL2, Web Audio API, Lenis

---

## Prerequisites

### Step 0: Initialize Git + Commit Baseline

```bash
cd /home/jegx/jegx/desktop/work/org/ivann-aura/ivann
git init
git add -A
git commit -m "chore: baseline commit before parallel refactor"
```

This is REQUIRED before any worktree operations.

---

## Phase 1 — Foundation (Sequential, 1 Agent)

**Files owned:** `globals.css`, `next.config.ts`, `vercel.json`, `shared-audio-context.ts`, `useUIStore.ts`

These files are imported by many downstream modules. Must be done FIRST so Phase 2 agents build on stable foundations.

---

### Task 1.1: Security Headers + Next.js Config

**Files:**
- Modify: `web/next.config.ts` (currently 7 lines, empty config)
- Modify: `web/vercel.json` (31 lines)

**Step 1: Add production config to next.config.ts**

Replace the empty config with:

```ts
import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
```

**Step 2: Add security headers to vercel.json (for public/ assets)**

Add to the existing headers array in `vercel.json`:

```json
{
  "source": "/(.*)",
  "headers": [
    { "key": "X-Content-Type-Options", "value": "nosniff" },
    { "key": "X-Frame-Options", "value": "DENY" },
    { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
  ]
}
```

**Step 3: Run typecheck**

```bash
cd web && npm run typecheck
```

**Step 4: Commit**

```bash
git add web/next.config.ts web/vercel.json
git commit -m "feat: add security headers and production Next.js config"
```

---

### Task 1.2: CSS Foundation — overscroll, text-shadow, font prep

**Files:**
- Modify: `web/src/app/globals.css` (151 lines)

**Step 1: Add overscroll-behavior to html rule (line 33-35)**

After `scroll-behavior: auto;` add:

```css
html {
  scroll-behavior: auto;
  overscroll-behavior: none;
}
```

**Step 2: Add text-shadow utility for video overlay legibility**

After the `::selection` block (line 52), add:

```css
/* Text shadow for overlay legibility on video — applied via utility class */
.text-cinema {
  text-shadow: 0 1px 3px rgba(0,0,0,0.6), 0 0 20px rgba(0,0,0,0.3);
}
```

**Step 3: Commit**

```bash
git add web/src/app/globals.css
git commit -m "fix: add overscroll-behavior:none + text-cinema shadow utility"
```

---

### Task 1.3: Shared AudioContext — iOS Audio Primer

**Files:**
- Modify: `web/src/lib/shared-audio-context.ts` (52 lines)

**Step 1: Add iOS touch/click primer**

The current code creates AudioContext but doesn't handle iOS requiring a user gesture to start audio. Add a `primerAudioContext()` export after `resumeAudioContext`:

```ts
/** Prime audio context on iOS via user gesture (touchstart/click). */
let primed = false;
export function primerAudioContext(): void {
  if (primed || typeof window === 'undefined') return;
  const handler = () => {
    resumeAudioContext();
    primed = true;
    document.removeEventListener('touchstart', handler);
    document.removeEventListener('click', handler);
  };
  document.addEventListener('touchstart', handler, { once: true, passive: true });
  document.addEventListener('click', handler, { once: true });
}
```

**Step 2: Call primer from acquireAudioContext**

Inside `acquireAudioContext()`, after creating the context (line 24), add:

```ts
primerAudioContext();
```

**Step 3: Commit**

```bash
git add web/src/lib/shared-audio-context.ts
git commit -m "fix: add iOS AudioContext primer via user gesture"
```

---

### Task 1.4: UI Store — Add soundMuted persistence

**Files:**
- Modify: `web/src/stores/useUIStore.ts` (19 lines)

**Step 1: Add soundMuted to store with localStorage persistence**

```ts
import { create } from "zustand";

type CursorVariant = "default" | "hover" | "hidden";

interface UIState {
  menuOpen: boolean;
  cursorVariant: CursorVariant;
  soundMuted: boolean;
  toggleMenu: () => void;
  setMenuOpen: (open: boolean) => void;
  setCursorVariant: (variant: CursorVariant) => void;
  setSoundMuted: (muted: boolean) => void;
  toggleSoundMuted: () => void;
}

const getInitialMuted = (): boolean => {
  if (typeof window === 'undefined') return false;
  try { return localStorage.getItem('ivann-sound-muted') === 'true'; } catch { return false; }
};

export const useUIStore = create<UIState>()((set) => ({
  menuOpen: false,
  cursorVariant: "default" as CursorVariant,
  soundMuted: getInitialMuted(),
  toggleMenu: () => set((s) => ({ menuOpen: !s.menuOpen })),
  setMenuOpen: (open) => set({ menuOpen: open }),
  setCursorVariant: (variant) => set({ cursorVariant: variant }),
  setSoundMuted: (muted) => {
    try { localStorage.setItem('ivann-sound-muted', String(muted)); } catch {}
    set({ soundMuted: muted });
  },
  toggleSoundMuted: () => set((s) => {
    const next = !s.soundMuted;
    try { localStorage.setItem('ivann-sound-muted', String(next)); } catch {}
    return { soundMuted: next };
  }),
}));
```

**NOTE:** This changes the store interface. Phase 2 agents consuming this store (page.tsx, Navigation) will use the new API.

**Step 2: Commit**

```bash
git add web/src/stores/useUIStore.ts
git commit -m "feat: persist soundMuted to localStorage via Zustand store"
```

---

## Phase 2 — Parallel Execution (6 Agents in Git Worktrees)

Each agent gets an exclusive set of files. No two agents touch the same file. Merge order matters for TypeScript compatibility.

### Worktree Setup Commands

```bash
cd /home/jegx/jegx/desktop/work/org/ivann-aura/ivann

# Create 6 worktrees
git worktree add ../ivann-wt-webgl    -b refactor/webgl-core
git worktree add ../ivann-wt-audio    -b refactor/audio-system
git worktree add ../ivann-wt-scroll   -b refactor/scroll-video
git worktree add ../ivann-wt-story    -b refactor/story-overlay
git worktree add ../ivann-wt-chrome   -b refactor/chrome-ui
git worktree add ../ivann-wt-layout   -b refactor/layout-config
```

### Merge Order (after all agents complete)

```
main ← layout ← chrome ← story ← audio ← scroll ← webgl
```

Rationale: layout/chrome are leaf changes (no downstream deps). Story is self-contained. Audio changes affect ScrollVideoPlayer's init code. Scroll changes affect page.tsx. WebGL is most isolated (single file).

---

## Agent 1: WebGL Core (`cinema-gl.ts`)

**Worktree:** `../ivann-wt-webgl`
**Files owned:** `web/src/lib/cinema-gl.ts` (1209 lines)
**Findings:** ~60

---

### Task 2.1.1: Fix Shadow Color Grading Self-Normalization (CRITICAL)

**Files:**
- Modify: `web/src/lib/cinema-gl.ts:225`

The shadow grading at line 225 self-normalizes to a no-op:

```glsl
// BEFORE (line 225) — grade.shadows / max(grade.shadows, ...) ≈ 1.0 always
graded = mix(graded, graded * (grade.shadows / max(grade.shadows, vec3(0.01))) * 1.2, shadowW * 0.4);
```

This divides shadows by itself, producing ~1.0. The 9 color palettes (lines 174-206) have no visible effect. Fix:

```glsl
// AFTER — shadows tint the dark regions (shift, not scale-then-normalize)
graded = mix(graded, grade.shadows * 1.2, shadowW * 0.4);
```

**Step 1: Apply the fix at line 225**

Change line 225 from:
```glsl
graded = mix(graded, graded * (grade.shadows / max(grade.shadows, vec3(0.01))) * 1.2, shadowW * 0.4);
```
to:
```glsl
graded = mix(graded, grade.shadows * 1.2, shadowW * 0.4);
```

**Step 2: Commit**

```bash
git add web/src/lib/cinema-gl.ts
git commit -m "fix(cinema-gl): shadow color grading no longer self-normalizes to no-op"
```

---

### Task 2.1.2: Replace Particle Vertex Texture Reads with Luminance Grid

**Files:**
- Modify: `web/src/lib/cinema-gl.ts:306-318` (particle vertex shader)

Currently each particle does 5 texture reads in the vertex shader (lines 309-317). With 1100 particles = 5500 texture reads/frame. The luminance grid (48x20, async PBO) already exists but isn't used in the vertex shader.

**Step 1: Add luminance grid uniform to particle vertex shader**

Replace the per-particle texture sampling block (lines 306-318) with a uniform-based approach:

```glsl
void main() {
  // Sample from pre-computed luminance grid (48x20, CPU-side PBO readback)
  vec2 uv = clamp(a_pos / u_res, 0.0, 1.0);
  uv.y = 1.0 - uv.y;

  // Grid-based luminance lookup (replaces 5 texture reads per particle)
  vec2 gridUV = uv;
  float lum = texture(u_lumGrid, gridUV).r;

  // Luminance gradient from grid neighbors (1 texel offset)
  vec2 texel = 1.0 / vec2(48.0, 20.0);
  float lumR = texture(u_lumGrid, clamp(gridUV + vec2(texel.x, 0.0), 0.0, 1.0)).r;
  float lumL = texture(u_lumGrid, clamp(gridUV - vec2(texel.x, 0.0), 0.0, 1.0)).r;
  float lumU = texture(u_lumGrid, clamp(gridUV - vec2(0.0, texel.y), 0.0, 1.0)).r;
  float lumD = texture(u_lumGrid, clamp(gridUV + vec2(0.0, texel.y), 0.0, 1.0)).r;
  vec2 lumGrad = vec2(lumR - lumL, lumD - lumU);
  vec2 nudge = lumGrad * u_energy * 25.0;
```

**NOTE:** This requires creating a small luminance grid texture from the PBO readback data and uploading it as `u_lumGrid`. The CPU-side PBO readback already computes this grid — wire it to a GL texture.

**Step 2: Create luminance grid texture and upload in render loop**

In `initCinemaGL()`, after PBO setup, create a small R8 texture (48x20) and upload the `lumPixels` data each PBO readback cycle.

**Step 3: Commit**

```bash
git add web/src/lib/cinema-gl.ts
git commit -m "perf(cinema-gl): replace 5500 vertex texture reads with luminance grid texture"
```

---

### Task 2.1.3: Fix Bloom Hard Knee

**Files:**
- Modify: `web/src/lib/cinema-gl.ts:377-382`

The bloom threshold (line 380) uses a hard knee which causes visible popping:

```glsl
// BEFORE (line 380-381)
float excess = max(0.0, lum - u_threshold);
fragColor = vec4(c * excess, 1.0);
```

Replace with soft knee:

```glsl
// AFTER — soft knee (2× smoother transition)
float knee = 0.1;
float softLum = lum - u_threshold + knee;
float excess = clamp(softLum * softLum / (4.0 * knee + 0.0001), 0.0, lum - u_threshold);
excess = max(0.0, excess);
fragColor = vec4(c * excess, 1.0);
```

**Step 1: Apply soft knee bloom**

Replace lines 380-381 in `BLOOM_THRESH_FRAG`.

**Step 2: Commit**

```bash
git add web/src/lib/cinema-gl.ts
git commit -m "fix(cinema-gl): soft knee bloom threshold to prevent luminance popping"
```

---

### Task 2.1.4: Fix Motion Blur Directionless Ghost

**Files:**
- Modify: `web/src/lib/cinema-gl.ts:422-427`

Current motion blur is a directionless ghost — just blends current with previous frame:

```glsl
// BEFORE (lines 422-427)
if (u_useMotionBlur == 1) {
  vec3 prev = texture(u_prevFrame, v_uv).rgb;
  float blurFactor = u_velocity * 0.3;
  c = mix(c, prev, blurFactor);
}
```

Add directional component using velocity:

```glsl
// AFTER — velocity-directed motion blur (3-tap along scroll direction)
if (u_useMotionBlur == 1) {
  float blurFactor = u_velocity * 0.3;
  vec2 blurDir = vec2(0.0, blurFactor * 0.01); // vertical scroll direction
  vec3 prev0 = texture(u_prevFrame, v_uv).rgb;
  vec3 prev1 = texture(u_prevFrame, v_uv + blurDir).rgb;
  vec3 prev2 = texture(u_prevFrame, v_uv - blurDir).rgb;
  vec3 blurred = (prev0 + prev1 + prev2) / 3.0;
  c = mix(c, blurred, blurFactor);
}
```

**Step 1: Apply directional motion blur**

**Step 2: Commit**

```bash
git add web/src/lib/cinema-gl.ts
git commit -m "fix(cinema-gl): directional motion blur using velocity vector"
```

---

### Task 2.1.5: Mood-Adaptive Bloom Threshold

**Files:**
- Modify: `web/src/lib/cinema-gl.ts` (composite pass, bloom uniform setup)

Currently bloom threshold is a fixed value. It should vary with mood: 0.75 (calm) → 0.45 (climax).

**Step 1: In the render function, compute bloom threshold from mood**

Where `u_threshold` is set (look for `bloomThreshProg` usage in render), change:

```ts
// BEFORE: fixed threshold
gl.uniform1f(btUThreshold, 0.6);

// AFTER: mood-adaptive
const mood = getMoodCPU(progress);
const bloomThresh = 0.75 - (mood - 0.5) * 0.43; // 0.75 at 0.5 mood → 0.45 at 1.2 mood
gl.uniform1f(btUThreshold, bloomThresh);
```

**Step 2: Commit**

```bash
git add web/src/lib/cinema-gl.ts
git commit -m "feat(cinema-gl): mood-adaptive bloom threshold (calm→bright, climax→soft)"
```

---

## Agent 2: Audio System

**Worktree:** `../ivann-wt-audio`
**Files owned:** `web/src/lib/audio-momentum.ts` (328 lines), `web/src/lib/micro-sounds.ts` (124 lines), `web/src/hooks/usePianoScroll.ts` (138 lines)
**Findings:** ~50

---

### Task 2.2.1: Restructure Audio Graph — Source→Analyser→Gain→Dest (CRITICAL)

**Files:**
- Modify: `web/src/lib/audio-momentum.ts:163-188` (`initAnalyser`)

**THE #1 FIX.** Currently `audio.muted = true` kills the AnalyserNode signal because muted prevents the source from emitting data. All visual reactivity dies when muted. Fix: insert a GainNode between Analyser and destination, use gain=0 for mute instead of `audio.muted`.

**Step 1: Add GainNode to class properties (after line 68)**

```ts
private gainNode: GainNode | null = null;
```

**Step 2: Restructure initAnalyser (lines 163-188)**

Replace:
```ts
this.sourceNode = this.audioCtx.createMediaElementSource(this.audio);
this.sourceNode.connect(this.analyser);
this.analyser.connect(this.audioCtx.destination);
```

With:
```ts
this.sourceNode = this.audioCtx.createMediaElementSource(this.audio);
this.gainNode = this.audioCtx.createGain();
// Source → Analyser → GainNode → Destination
// Analyser always gets signal (even when muted), GainNode controls audible output
this.sourceNode.connect(this.analyser);
this.analyser.connect(this.gainNode);
this.gainNode.connect(this.audioCtx.destination);
```

**Step 3: Change setMuted to use GainNode (line 116-120)**

Replace:
```ts
setMuted(muted: boolean): void {
  if (this.audio) {
    this.audio.muted = muted;
  }
}
```

With:
```ts
setMuted(muted: boolean): void {
  if (this.gainNode) {
    // Smooth 50ms ramp to avoid click artifacts
    const now = this.audioCtx?.currentTime ?? 0;
    this.gainNode.gain.cancelScheduledValues(now);
    this.gainNode.gain.setTargetAtTime(muted ? 0 : 1, now, 0.05);
  }
}
```

**Step 4: Update destroy() to disconnect gainNode (after line 138)**

```ts
if (this.gainNode) {
  this.gainNode.disconnect();
  this.gainNode = null;
}
```

**Step 5: Commit**

```bash
git add web/src/lib/audio-momentum.ts
git commit -m "fix(audio): restructure graph Source→Analyser→Gain→Dest, GainNode mute preserves visual reactivity"
```

---

### Task 2.2.2: Delta-Time Friction in AudioMomentum (CRITICAL)

**Files:**
- Modify: `web/src/lib/audio-momentum.ts:246-252`

Frame-rate dependent: `this.energy *= FRICTION` runs per-frame. On 120Hz monitors, friction applies 2× per 60Hz interval = double-speed decay.

**Step 1: Add lastTime tracking**

Add to class properties:
```ts
private lastTime: number = 0;
```

Initialize in `startLoop()`:
```ts
this.lastTime = performance.now();
```

**Step 2: Fix update loop (lines 247-252)**

Replace:
```ts
private update = (): void => {
  if (!this.running) return;

  // --- friction decay ---
  this.energy *= FRICTION;
  if (this.energy < 0.001) this.energy = 0;
```

With:
```ts
private update = (): void => {
  if (!this.running) return;

  // --- delta-time friction decay ---
  const now = performance.now();
  const dt = Math.min((now - this.lastTime) / 16.667, 3); // normalize to 60fps, cap at 3 frames
  this.lastTime = now;
  this.energy *= Math.pow(FRICTION, dt);
  if (this.energy < 0.001) this.energy = 0;
```

**Step 3: Commit**

```bash
git add web/src/lib/audio-momentum.ts
git commit -m "fix(audio): delta-time friction decay (fixes 120Hz double-speed)"
```

---

### Task 2.2.3: Asymmetric EMA for Piano Attack/Release

**Files:**
- Modify: `web/src/lib/audio-momentum.ts:210-213`

Symmetric EMA (BAND_ALPHA=0.35) smooths equally in both directions. Piano attacks need fast rise, slow decay.

**Step 1: Replace symmetric EMA with asymmetric**

Replace lines 210-213:
```ts
this.smoothBands.bass = lerp(this.smoothBands.bass, this.bands.bass, BAND_ALPHA);
this.smoothBands.mids = lerp(this.smoothBands.mids, this.bands.mids, BAND_ALPHA);
this.smoothBands.highs = lerp(this.smoothBands.highs, this.bands.highs, BAND_ALPHA);
```

With:
```ts
const ATTACK_ALPHA = 0.6;  // fast rise for piano attacks
const RELEASE_ALPHA = 0.15; // slow decay for natural sustain
const applyAsymmetric = (smoothed: number, raw: number) =>
  lerp(smoothed, raw, raw > smoothed ? ATTACK_ALPHA : RELEASE_ALPHA);
this.smoothBands.bass = applyAsymmetric(this.smoothBands.bass, this.bands.bass);
this.smoothBands.mids = applyAsymmetric(this.smoothBands.mids, this.bands.mids);
this.smoothBands.highs = applyAsymmetric(this.smoothBands.highs, this.bands.highs);
```

**Step 2: Remove the now-unused BAND_ALPHA constant (line 26)**

**Step 3: Commit**

```bash
git add web/src/lib/audio-momentum.ts
git commit -m "feat(audio): asymmetric EMA — fast attack, slow release for piano dynamics"
```

---

### Task 2.2.4: Delta-Time Friction in usePianoScroll (CRITICAL)

**Files:**
- Modify: `web/src/hooks/usePianoScroll.ts:62`

Same frame-rate bug: `energyRef.current *= FRICTION` at line 62.

**Step 1: Add lastTime ref and delta-time calculation**

In the `tick()` function, add timing:

```ts
const lastTimeRef = useRef(0);

const tick = () => {
  const l = lenisRef.current;
  if (!l || energyRef.current < STOP_THRESHOLD) {
    energyRef.current = 0;
    runningRef.current = false;
    return;
  }

  const now = performance.now();
  const dt = lastTimeRef.current ? Math.min((now - lastTimeRef.current) / 16.667, 3) : 1;
  lastTimeRef.current = now;

  // Apply friction (delta-time corrected)
  energyRef.current *= Math.pow(FRICTION, dt);

  // Convert energy to scroll delta (also scale by dt for consistent speed)
  const delta = energyRef.current * VELOCITY_SCALE * dt;
  l.scrollTo(l.scroll + delta);

  rafRef.current = requestAnimationFrame(tick);
};
```

**Step 2: Reset lastTimeRef when starting loop**

In `startLoop()`, add: `lastTimeRef.current = performance.now();`

**Step 3: Commit**

```bash
git add web/src/hooks/usePianoScroll.ts
git commit -m "fix(usePianoScroll): delta-time friction decay (fixes 120Hz double-speed)"
```

---

### Task 2.2.5: Flamenco-Compatible Micro-Sounds

**Files:**
- Modify: `web/src/lib/micro-sounds.ts:68`

C major pentatonic can clash with the flamenco key of the video. Replace with Phrygian-compatible notes.

**Step 1: Replace pentatonic scale (line 68)**

```ts
// BEFORE: C major pentatonic
const notes = [523, 587, 659, 784, 880, 1047];

// AFTER: E Phrygian compatible (E5, F5, A5, B5, C6, E6) — flamenco color
const notes = [659, 698, 880, 988, 1047, 1319];
```

**Step 2: Commit**

```bash
git add web/src/lib/micro-sounds.ts
git commit -m "feat(micro-sounds): switch to Phrygian scale for flamenco compatibility"
```

---

### Task 2.2.6: Pitch Artifact Guard for Low playbackRate

**Files:**
- Modify: `web/src/lib/audio-momentum.ts:83`

Below 0.5x playbackRate, `preservesPitch=false` produces metallic artifacts.

**Step 1: Change MIN_RATE from 0.25 to 0.5 (line 12)**

```ts
const MIN_RATE = 0.5; // was 0.25 — prevents pitch artifacts below 0.5x
```

**Step 2: Commit**

```bash
git add web/src/lib/audio-momentum.ts
git commit -m "fix(audio): raise MIN_RATE to 0.5 to prevent low-pitch artifacts"
```

---

## Agent 3: Scroll + Video Player

**Worktree:** `../ivann-wt-scroll`
**Files owned:** `web/src/components/ui/ScrollVideoPlayer.tsx` (533 lines), `web/src/components/ui/PianoIndicator.tsx` (87 lines)
**Findings:** ~35

---

### Task 2.3.1: Delta-Time All Decay Values in ScrollVideoPlayer (HIGH)

**Files:**
- Modify: `web/src/components/ui/ScrollVideoPlayer.tsx:274-299`

Multiple frame-rate dependent decays:
- Line 274-275: velocity smoothing `(vel - smooth) * 0.15`
- Line 277: velocity decay `*= 0.92`
- Line 280: actTransition decay `*= 0.95`
- Line 298-299: shake decay `*= 0.8`

**Step 1: Add delta-time tracking ref**

Add near other refs:
```ts
const lastRafTimeRef = useRef(0);
```

**Step 2: Compute dt at start of render callback**

At the beginning of the GSAP/rAF render callback:

```ts
const now = performance.now();
const dt = lastRafTimeRef.current ? Math.min((now - lastRafTimeRef.current) / 16.667, 3) : 1;
lastRafTimeRef.current = now;
```

**Step 3: Replace all per-frame decay constants with dt-corrected versions**

```ts
// Smooth velocity (dt-corrected)
smoothVelocityRef.current += (velocityRef.current - smoothVelocityRef.current) * (1 - Math.pow(1 - 0.15, dt));

// Velocity decay (dt-corrected)
velocityRef.current *= Math.pow(0.92, dt);

// Act transition decay (dt-corrected)
actTransitionRef.current *= Math.pow(0.95, dt);

// Shake decay (dt-corrected)
shakeRef.current.x *= Math.pow(0.8, dt);
shakeRef.current.y *= Math.pow(0.8, dt);
```

**Step 4: Commit**

```bash
git add web/src/components/ui/ScrollVideoPlayer.tsx
git commit -m "fix(scroll-video): delta-time all decay values (fixes 120Hz double-speed)"
```

---

### Task 2.3.2: Mobile Scrub Speed Improvement

**Files:**
- Modify: `web/src/components/ui/ScrollVideoPlayer.tsx` (gsap.matchMedia section)

Mobile `scrub: 2` is too slow for touch. Change to `scrub: 1`.

**Step 1: Find the matchMedia mobile section and change scrub**

```ts
// Mobile
"(max-width: 767px)": () => {
  // ... ScrollTrigger config
  scrub: 1, // was 2 — too slow for touch
```

**Step 2: Commit**

```bash
git add web/src/components/ui/ScrollVideoPlayer.tsx
git commit -m "fix(scroll-video): mobile scrub speed 2→1 for better touch response"
```

---

### Task 2.3.3: Video Error Handling

**Files:**
- Modify: `web/src/components/ui/ScrollVideoPlayer.tsx`

No video load error handling currently exists.

**Step 1: Add error event listener in the buffer tracking effect**

After the existing event listeners (around line 155), add:

```ts
const onError = () => {
  console.error("ScrollVideoPlayer: video failed to load");
  onError?.();
  setHasGL(false); // fall back to raw video display
};
video.addEventListener("error", onVideoError);
// ... in cleanup:
video.removeEventListener("error", onVideoError);
```

**Step 2: Commit**

```bash
git add web/src/components/ui/ScrollVideoPlayer.tsx
git commit -m "fix(scroll-video): add video load error handling with fallback"
```

---

## Agent 4: Story Overlay

**Worktree:** `../ivann-wt-story`
**Files owned:** `web/src/components/ui/ScrollStoryOverlay.tsx` (816 lines)
**Findings:** ~25

---

### Task 2.4.1: Move First Beat Earlier + Add Scroll Hint

**Files:**
- Modify: `web/src/components/ui/ScrollStoryOverlay.tsx:44-46`

First text (IVANN AURA hero) starts at frame 15 (~24vh scroll). Too late — user sees blank video. Also scroll hint at frame 60 is too late.

**Step 1: Move hero beat start from frame 15 to frame 3**

Change:
```ts
{
  frameStart: 15,
  frameEnd: 75,
```
To:
```ts
{
  frameStart: 3,
  frameEnd: 75,
```

**Step 2: Add scroll hint beat before the hero text (at frame 0)**

Insert as first beat:
```ts
{
  frameStart: 0,
  frameEnd: 25,
  content: (
    <div className="text-center">
      <p
        data-split="words"
        className="text-xs tracking-[0.4em] uppercase text-cinema"
        style={{ color: "var(--text-muted)" }}
      >
        Scroll para descubrir
      </p>
      <div className="mt-4 mx-auto w-px h-8 bg-gradient-to-b from-[var(--aura-gold-dim)] to-transparent animate-pulse" />
    </div>
  ),
  position: "bottom" as const,
  animation: "fade" as const,
},
```

**Step 3: Commit**

```bash
git add web/src/components/ui/ScrollStoryOverlay.tsx
git commit -m "feat(story): earlier hero text (frame 3) + scroll hint at frame 0"
```

---

### Task 2.4.2: Fix Act 8 Social Links — spans → anchors

**Files:**
- Modify: `web/src/components/ui/ScrollStoryOverlay.tsx` (Act 8 beat, near end of STORY_BEATS array)

Social links in Act 8 are `<span>` elements, not `<a>` tags. Not clickable.

**Step 1: Find Act 8 social links and convert to anchor tags**

Look for the beat containing social platform names (Instagram, Spotify, YouTube, TikTok) and replace `<span>` with:

```tsx
<a
  href="https://www.instagram.com/ivannaura"
  target="_blank"
  rel="noopener noreferrer"
  className="pointer-events-auto hover:text-[var(--aura-gold)] transition-colors"
>
  Instagram
</a>
```

Do the same for all social links in Act 8.

**Step 2: Add `pointer-events-auto` to the containing div (since parent is `pointer-events-none`)**

**Step 3: Commit**

```bash
git add web/src/components/ui/ScrollStoryOverlay.tsx
git commit -m "fix(story): Act 8 social links are now clickable <a> tags"
```

---

### Task 2.4.3: Add text-cinema Class to Overlay Text

**Files:**
- Modify: `web/src/components/ui/ScrollStoryOverlay.tsx` (multiple story beats)

Video overlay text needs text-shadow for legibility. Add the `text-cinema` class (defined in Task 1.2) to key text elements.

**Step 1: Add `text-cinema` to hero title, act labels, and body text classes**

For elements with `data-split` attributes in the hero beat and major labels:
```tsx
className="text-[clamp(3rem,8vw,8rem)] font-extralight tracking-[0.3em] leading-none text-cinema"
```

**Step 2: Commit**

```bash
git add web/src/components/ui/ScrollStoryOverlay.tsx
git commit -m "feat(story): add text-cinema shadow class for video overlay legibility"
```

---

### Task 2.4.4: Balance Act 5-8 Beat Density

**Files:**
- Modify: `web/src/components/ui/ScrollStoryOverlay.tsx`

Beat density drops ~50% in Acts 5-8. Add 3-4 new beats to fill the narrative gaps.

**Step 1: Add beats for Acts 5-8**

Add contextual beats between existing ones. Examples:

Act 5 (Fuego, frames 360-449):
```ts
{
  frameStart: 380,
  frameEnd: 420,
  content: (
    <div>
      <p data-split="chars" className="text-[clamp(1rem,2.5vw,1.5rem)] tracking-[0.2em] uppercase text-cinema" style={{ color: "var(--aura-gold)" }}>
        Donde el fuego se hace música
      </p>
    </div>
  ),
  position: "bottom-left" as const,
  animation: "slide-left" as const,
},
```

Add similar beats for Acts 6, 7.

**Step 2: Commit**

```bash
git add web/src/components/ui/ScrollStoryOverlay.tsx
git commit -m "feat(story): add 4 new beats to balance Acts 5-8 density"
```

---

## Agent 5: Chrome UI (Navigation, Contact, Footer, Preloader, CustomCursor)

**Worktree:** `../ivann-wt-chrome`
**Files owned:** `web/src/components/ui/Navigation.tsx` (461), `web/src/components/sections/Contact.tsx` (454), `web/src/components/ui/Footer.tsx` (301), `web/src/components/ui/Preloader.tsx` (193), `web/src/components/ui/CustomCursor.tsx` (147)
**Findings:** ~45

---

### Task 2.5.1: Navigation Touch Targets (P1)

**Files:**
- Modify: `web/src/components/ui/Navigation.tsx`

Sound toggle is 32px, mobile social links ~20px. WCAG requires 44px minimum.

**Step 1: Find sound toggle button and increase size**

Add `min-w-[44px] min-h-[44px]` to the sound toggle button's className.

**Step 2: Find mobile social links in the dialog and increase size**

Add `min-h-[44px] flex items-center` to mobile social link wrappers.

**Step 3: Add safe-area inset padding to the fixed nav**

```tsx
style={{ paddingTop: "env(safe-area-inset-top)" }}
```

**Step 4: Commit**

```bash
git add web/src/components/ui/Navigation.tsx
git commit -m "fix(nav): 44px touch targets + safe-area insets (WCAG 2.5.8)"
```

---

### Task 2.5.2: Contact — WhatsApp Link + Form Enhancements

**Files:**
- Modify: `web/src/components/sections/Contact.tsx`

No WhatsApp link (critical for Colombian market, 60%+ traffic). Form missing `autocomplete` and `enterkeyhint`.

**Step 1: Add WhatsApp CTA**

After the email/mailto section, add:

```tsx
<a
  href="https://wa.me/573001234567?text=Hola%20IVANN%2C%20quiero%20saber%20más%20sobre%20tu%20show"
  target="_blank"
  rel="noopener noreferrer"
  className="magnetic-btn inline-flex items-center gap-2 px-6 py-3 text-sm tracking-[0.15em] uppercase border border-[var(--aura-gold-dim)] hover:border-[var(--aura-gold)] transition-colors"
  style={{ color: "var(--aura-gold)" }}
>
  WhatsApp
</a>
```

**NOTE:** Replace `573001234567` with IVANN's actual WhatsApp number.

**Step 2: Add autocomplete + enterkeyhint to form inputs**

```tsx
<input autoComplete="name" enterKeyHint="next" ... />
<input autoComplete="email" enterKeyHint="next" ... />
<textarea autoComplete="off" enterKeyHint="send" ... />
```

**Step 3: Commit**

```bash
git add web/src/components/sections/Contact.tsx
git commit -m "feat(contact): add WhatsApp CTA + form autocomplete/enterkeyhint"
```

---

### Task 2.5.3: Footer Touch Targets

**Files:**
- Modify: `web/src/components/ui/Footer.tsx`

Social links need larger touch targets.

**Step 1: Add minimum tap size to social links**

Add `min-w-[44px] min-h-[44px] flex items-center justify-center` to each social link.

**Step 2: Commit**

```bash
git add web/src/components/ui/Footer.tsx
git commit -m "fix(footer): 44px social link touch targets"
```

---

### Task 2.5.4: Preloader — Wait for Video Ready

**Files:**
- Modify: `web/src/components/ui/Preloader.tsx`

Preloader dismisses on a 5s timeout (line 109) regardless of video readiness. Should wait for video `canplaythrough` or `loadeddata`.

**Step 1: Replace timeout with event-based dismissal**

Replace the fallback timeout (line 109) with:

```ts
// Wait for video to be ready (or fallback after 8s)
const video = document.querySelector('video');
if (video) {
  const onReady = () => {
    dismiss();
    video.removeEventListener('canplaythrough', onReady);
  };
  if (video.readyState >= 4) {
    // Already ready (cached)
    // Let timeline complete naturally, dismiss will fire from onComplete
  } else {
    video.addEventListener('canplaythrough', onReady);
  }
}
const fallback = setTimeout(dismiss, 8000); // extended from 5s
```

**Step 2: Fix subtitle font size (currently fixed 10px)**

Change line 182 from `fontSize: 10` to `fontSize: "clamp(9px, 1.5vw, 11px)"`.

**Step 3: Commit**

```bash
git add web/src/components/ui/Preloader.tsx
git commit -m "fix(preloader): wait for video canplaythrough instead of fixed 5s timeout"
```

---

### Task 2.5.5: Navigation — Use Zustand soundMuted

**Files:**
- Modify: `web/src/components/ui/Navigation.tsx`

Currently soundMuted is passed as prop from page.tsx. It should use the new Zustand store (Task 1.4).

**Step 1: Import and use useUIStore for soundMuted**

```ts
const soundMuted = useUIStore((s) => s.soundMuted);
const toggleSoundMuted = useUIStore((s) => s.toggleSoundMuted);
```

Remove `soundMuted` and `onSoundToggle` from props.

**NOTE:** This change must coordinate with Agent 6 (page.tsx) which also needs to use the Zustand store.

**Step 2: Commit**

```bash
git add web/src/components/ui/Navigation.tsx
git commit -m "refactor(nav): use Zustand store for soundMuted persistence"
```

---

## Agent 6: Layout + Config

**Worktree:** `../ivann-wt-layout`
**Files owned:** `web/src/app/page.tsx` (160), `web/src/app/layout.tsx` (157), `web/src/components/providers/SmoothScroll.tsx` (57), `web/src/components/providers/MagneticButtons.tsx` (61)
**Files to create:** `web/src/app/error.tsx`, `web/src/app/robots.ts`, `web/src/app/sitemap.ts`
**Findings:** ~20

---

### Task 2.6.1: Font Swap — Geist → Cormorant Garamond + Plus Jakarta Sans

**Files:**
- Modify: `web/src/app/layout.tsx:8-16`

Geist is generic. For an Awwwards-quality piano site, use distinctive typography.

**Step 1: Replace font imports**

```ts
import { Cormorant_Garamond, Plus_Jakarta_Sans } from "next/font/google";

const display = Cormorant_Gararand({
  variable: "--font-display",
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "600"],
  display: "swap",
});

const body = Plus_Jakarta_Sans({
  variable: "--font-body",
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});
```

**Step 2: Update html className**

```tsx
<html lang="es" className={`${display.variable} ${body.variable} antialiased`}>
```

**Step 3: Update globals.css font-family references (Task 1.2 already done, but Agent 6 can add the `@theme inline` mapping)**

In globals.css's `@theme inline` block, the font vars should map to the new fonts. Since globals.css is owned by Phase 1, this agent should NOT edit globals.css. Instead, add a font override in layout.tsx:

```tsx
<body className="min-h-dvh font-[var(--font-body)]">
```

**Step 4: Commit**

```bash
git add web/src/app/layout.tsx
git commit -m "feat(layout): swap Geist to Cormorant Garamond + Plus Jakarta Sans"
```

---

### Task 2.6.2: Extract getMoodCPU to Separate Module

**Files:**
- Modify: `web/src/app/page.tsx:13`

page.tsx imports `getMoodCPU` from `cinema-gl.ts`, pulling the entire 1209-line WebGL module into the client bundle.

**NOTE:** Since `cinema-gl.ts` is owned by Agent 1, this agent should NOT create a new shared module. Instead, duplicate the tiny `getMoodCPU` function locally in `page.tsx` (~15 lines) with a comment noting it mirrors cinema-gl.

**Step 1: Replace import with inline function**

Remove `import { getMoodCPU } from "@/lib/cinema-gl"` and add:

```ts
// Mirrors getMood() in cinema-gl.ts — duplicated here to avoid importing 1209-line WebGL module
function getMoodCPU(progress: number): number {
  const moods = [0.5, 0.5, 0.6, 0.8, 0.9, 1.1, 1.2, 0.8, 0.5];
  const t = Math.min(Math.max(progress, 0), 1) * 8;
  const i = Math.floor(t);
  const j = Math.min(i + 1, 8);
  const f = t - i;
  const s = f * f * (3 - 2 * f); // Hermite interpolation
  return moods[i] + (moods[j] - moods[i]) * s;
}
```

**Step 2: Commit**

```bash
git add web/src/app/page.tsx
git commit -m "perf(page): inline getMoodCPU to avoid importing cinema-gl bundle"
```

---

### Task 2.6.3: page.tsx — Use Zustand soundMuted

**Files:**
- Modify: `web/src/app/page.tsx`

Replace local `useState(false)` for soundMuted with Zustand store.

**Step 1: Import and use the store**

```ts
import { useUIStore } from "@/stores/useUIStore";

// Inside component:
const soundMuted = useUIStore((s) => s.soundMuted);
const toggleSoundMuted = useUIStore((s) => s.toggleSoundMuted);
```

Remove `const [soundMuted, setSoundMuted] = useState(false)` and the `handleSoundToggle` callback.

**Step 2: Update Navigation props (remove soundMuted/onSoundToggle since Nav reads from store now)**

```tsx
<Navigation audioActive={displayEnergy > 0.05} />
```

**Step 3: Commit**

```bash
git add web/src/app/page.tsx
git commit -m "refactor(page): use Zustand store for soundMuted persistence"
```

---

### Task 2.6.4: Create Error Boundary

**Files:**
- Create: `web/src/app/error.tsx`

```tsx
"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      className="min-h-dvh flex flex-col items-center justify-center gap-6"
      style={{ background: "var(--bg-void)", color: "var(--text-primary)" }}
    >
      <h2 className="text-lg tracking-[0.2em] uppercase" style={{ color: "var(--aura-gold)" }}>
        Algo salió mal
      </h2>
      <button
        onClick={reset}
        className="magnetic-btn px-6 py-3 text-sm tracking-[0.15em] uppercase border border-[var(--aura-gold-dim)] hover:border-[var(--aura-gold)] transition-colors"
        style={{ color: "var(--text-secondary)" }}
      >
        Intentar de nuevo
      </button>
    </div>
  );
}
```

**Step 1: Create the file**

**Step 2: Commit**

```bash
git add web/src/app/error.tsx
git commit -m "feat: add error.tsx boundary with retry"
```

---

### Task 2.6.5: Create robots.ts + sitemap.ts

**Files:**
- Create: `web/src/app/robots.ts`
- Create: `web/src/app/sitemap.ts`

```ts
// robots.ts
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: "https://ivannaura.vercel.app/sitemap.xml",
  };
}
```

```ts
// sitemap.ts
import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://ivannaura.vercel.app",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
```

**Step 1: Create both files**

**Step 2: Commit**

```bash
git add web/src/app/robots.ts web/src/app/sitemap.ts
git commit -m "feat: add robots.ts + sitemap.ts for SEO"
```

---

### Task 2.6.6: SmoothScroll — Add overscroll-behavior

**Files:**
- Modify: `web/src/components/providers/SmoothScroll.tsx`

**Step 1: Add overscroll-behavior to the Lenis wrapper or body**

Since globals.css already has `overscroll-behavior: none` on html (Task 1.2), verify SmoothScroll doesn't override it. If needed, add to the Lenis options:

```ts
overscroll: false,
```

**Step 2: Commit**

```bash
git add web/src/components/providers/SmoothScroll.tsx
git commit -m "fix(smooth-scroll): ensure overscroll prevention"
```

---

## Phase 3 — Integration (Sequential, 1 Agent)

After all 6 worktree branches merge into main, this agent runs on the merged result.

---

### Task 3.1: Font Variable Update in globals.css

**Files:**
- Modify: `web/src/app/globals.css`

Update the `@theme inline` font variables to match the new fonts from Task 2.6.1:

```css
--font-sans: var(--font-body);
--font-mono: var(--font-geist-mono); /* keep mono if used anywhere */
--font-display: var(--font-display);
```

And add font-family to body:

```css
body {
  font-family: var(--font-body), system-ui, sans-serif;
}
```

**Step 1: Apply changes**

**Step 2: Commit**

```bash
git add web/src/app/globals.css
git commit -m "feat: update CSS font variables for new typography"
```

---

### Task 3.2: TypeScript Full Check

**Step 1: Run typecheck**

```bash
cd web && npm run typecheck
```

**Step 2: Fix any type errors**

Likely issues:
- Navigation props changed (soundMuted/onSoundToggle removed)
- page.tsx no longer passes those props
- useUIStore has new shape
- getMoodCPU import removed from page.tsx

Fix any compilation errors.

**Step 3: Commit**

```bash
git add -A
git commit -m "fix: resolve TypeScript errors after parallel refactor merge"
```

---

### Task 3.3: Build Verification

**Step 1: Run production build**

```bash
cd web && npm run build
```

**Step 2: Fix any build errors**

**Step 3: Commit if needed**

---

### Task 3.4: Dev Server Smoke Test

**Step 1: Start dev server**

```bash
cd web && npm run dev
```

**Step 2: Verify in browser at localhost:3333**

Check:
- Preloader appears and dismisses on video ready
- Scroll-driven video plays
- Audio momentum responds to scroll
- Text overlays appear at correct times
- Navigation touch targets work on mobile viewport
- Sound mute persists across reload
- WebGL effects visible (color grading, bloom, particles)

---

## Merge Strategy

```bash
cd /home/jegx/jegx/desktop/work/org/ivann-aura/ivann

# Merge in dependency order (leaf → core)
git merge refactor/layout-config    --no-ff -m "merge: layout + config changes"
git merge refactor/chrome-ui        --no-ff -m "merge: chrome UI fixes"
git merge refactor/story-overlay    --no-ff -m "merge: story overlay improvements"
git merge refactor/audio-system     --no-ff -m "merge: audio system restructure"
git merge refactor/scroll-video     --no-ff -m "merge: scroll video delta-time fixes"
git merge refactor/webgl-core       --no-ff -m "merge: WebGL cinema pipeline fixes"

# Cleanup worktrees
git worktree remove ../ivann-wt-webgl
git worktree remove ../ivann-wt-audio
git worktree remove ../ivann-wt-scroll
git worktree remove ../ivann-wt-story
git worktree remove ../ivann-wt-chrome
git worktree remove ../ivann-wt-layout
```

---

## Summary of Priority Fixes by Impact

| # | Fix | Severity | Agent | File |
|---|-----|----------|-------|------|
| 1 | Audio graph Source→Analyser→Gain→Dest | CRITICAL | 2 | audio-momentum.ts |
| 2 | Delta-time friction (5 files) | CRITICAL | 2,3 | audio-momentum, usePianoScroll, ScrollVideoPlayer |
| 3 | Shadow grading self-normalization | CRITICAL | 1 | cinema-gl.ts:225 |
| 4 | Font swap Geist → Cormorant+Jakarta | HIGH | 6 | layout.tsx |
| 5 | overscroll-behavior: none | HIGH | 1 | globals.css |
| 6 | Security headers | HIGH | 1 | next.config.ts, vercel.json |
| 7 | Preloader waits for video | HIGH | 5 | Preloader.tsx |
| 8 | 44px touch targets | P1 | 5 | Navigation, Footer |
| 9 | Act 8 social links → `<a>` | P0 | 4 | ScrollStoryOverlay |
| 10 | WhatsApp CTA | P0 | 5 | Contact.tsx |
| 11 | Bloom soft knee | HIGH | 1 | cinema-gl.ts:377 |
| 12 | Motion blur direction | HIGH | 1 | cinema-gl.ts:422 |
| 13 | Particle luminance grid | HIGH | 1 | cinema-gl.ts:306 |
| 14 | Asymmetric EMA | P1 | 2 | audio-momentum.ts:210 |
| 15 | Flamenco micro-sounds | P2 | 2 | micro-sounds.ts:68 |
| 16 | getMoodCPU extraction | HIGH | 6 | page.tsx |
| 17 | soundMuted persistence | P1 | 1,5,6 | useUIStore, Nav, page |
| 18 | Story beat density | P1 | 4 | ScrollStoryOverlay |
| 19 | Text shadow overlay | P1 | 4 | ScrollStoryOverlay |
| 20 | Scroll hint earlier | P1 | 4 | ScrollStoryOverlay |
| 21 | error.tsx boundary | P1 | 6 | error.tsx (new) |
| 22 | robots.ts + sitemap.ts | P2 | 6 | robots.ts, sitemap.ts (new) |
| 23 | iOS audio primer | P1 | 1 | shared-audio-context.ts |
| 24 | MIN_RATE 0.25→0.5 | P1 | 2 | audio-momentum.ts:12 |
| 25 | Mood-adaptive bloom | P1 | 1 | cinema-gl.ts |
