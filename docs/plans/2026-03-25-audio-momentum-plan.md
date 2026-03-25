# Audio Momentum System — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace choppy scroll-seeking audio with a momentum-based system where interactions (scroll, key, click) inject energy that drives smooth continuous audio playback with vinyl slowdown.

**Architecture:** Separate audio element (`<audio>`) plays the soundtrack with `playbackRate` and `volume` controlled by momentum physics. Video stays muted, driven by scroll for visuals only. A new `AudioMomentum` class encapsulates the physics engine and audio element control.

**Tech Stack:** HTML5 Audio API (`playbackRate`, `preservesPitch`), requestAnimationFrame physics loop, React refs

**Design doc:** `docs/plans/2026-03-25-audio-momentum-design.md`

---

### Task 1: Extract audio from video

**Files:**
- Create: `public/audio/flamenco.m4a`

**Step 1: Create audio directory**

```bash
mkdir -p public/audio
```

**Step 2: Extract audio with ffmpeg**

Since ffmpeg is not installed on this machine, extract on a machine with ffmpeg:

```bash
ffmpeg -i public/videos/flamenco-graded.mp4 -vn -acodec aac -b:a 128k public/audio/flamenco.m4a
```

Expected: ~2MB AAC file, 4:06 duration.

**Alternative if ffmpeg unavailable:** Use the video itself as audio source — load a second hidden `<video>` element with just audio. This adds 26MB but works without ffmpeg. The implementation below supports both approaches via a simple `audioSrc` prop.

**Step 3: Commit**

```bash
git add public/audio/
git commit -m "feat: extract audio track for momentum system"
```

---

### Task 2: Create AudioMomentum class

**Files:**
- Create: `src/lib/audio-momentum.ts`

**Step 1: Write the AudioMomentum class**

This is the physics engine + audio controller. No React dependencies — pure class.

```typescript
/**
 * AudioMomentum — momentum-based audio playback.
 *
 * Each interaction adds energy. Energy decays per frame (friction).
 * Energy drives playbackRate (0.25–1.0) and volume (0–MAX_VOLUME).
 * preservesPitch=false creates a vinyl slowdown effect.
 */

// Physics constants
const IMPULSE = 0.2;
const FRICTION = 0.985;
const MIN_RATE = 0.25;
const MAX_RATE = 1.0;
const MAX_VOLUME = 0.7;
const PLAY_THRESHOLD = 0.05;
const STOP_THRESHOLD = 0.02;
const DRIFT_THRESHOLD = 3.0;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export class AudioMomentum {
  private audio: HTMLAudioElement | null = null;
  private energy = 0;
  private rafId = 0;
  private running = false;
  private wasPlaying = false;
  private videoTimeGetter: (() => number) | null = null;

  /** Create the audio element and start the physics loop */
  init(audioSrc: string) {
    if (this.audio) return;

    this.audio = new Audio(audioSrc);
    this.audio.preload = "auto";
    this.audio.loop = false;
    (this.audio as any).preservesPitch = false;
    (this.audio as any).mozPreservesPitch = false;
    (this.audio as any).webkitPreservesPitch = false;

    this.startLoop();
  }

  /** Set a function that returns the current video time (for sync) */
  setVideoTimeGetter(getter: () => number) {
    this.videoTimeGetter = getter;
  }

  /** Inject energy from an interaction (scroll, keypress, click) */
  addImpulse(amount: number = IMPULSE) {
    this.energy = Math.min(1.0, this.energy + amount);
  }

  /** Get current energy level (0–1) for UI indicators */
  getEnergy(): number {
    return this.energy;
  }

  /** Physics loop — runs every animation frame */
  private startLoop() {
    if (this.running) return;
    this.running = true;

    const tick = () => {
      if (!this.running) return;

      this.update();
      this.rafId = requestAnimationFrame(tick);
    };

    this.rafId = requestAnimationFrame(tick);
  }

  private update() {
    const audio = this.audio;
    if (!audio) return;

    // Apply friction
    this.energy *= FRICTION;

    // Clamp near-zero
    if (this.energy < 0.001) this.energy = 0;

    // Derive audio parameters
    const rate = lerp(MIN_RATE, MAX_RATE, this.energy);
    const volume = smoothstep(0, 0.15, this.energy) * MAX_VOLUME;

    if (this.energy >= PLAY_THRESHOLD && !this.wasPlaying) {
      // Start playing — sync to video position first
      this.syncToVideo();
      audio.playbackRate = rate;
      audio.volume = volume;
      audio.play().catch(() => {});
      this.wasPlaying = true;
    } else if (this.energy < STOP_THRESHOLD && this.wasPlaying) {
      // Stop playing
      audio.pause();
      this.wasPlaying = false;
    } else if (this.wasPlaying) {
      // Update rate and volume while playing
      audio.playbackRate = rate;
      audio.volume = volume;

      // Check drift
      this.checkDrift();
    }
  }

  /** Sync audio position to video position */
  private syncToVideo() {
    if (!this.audio || !this.videoTimeGetter) return;
    const videoTime = this.videoTimeGetter();
    if (isFinite(videoTime) && videoTime >= 0) {
      this.audio.currentTime = videoTime;
    }
  }

  /** Correct drift if audio wandered too far from video */
  private checkDrift() {
    if (!this.audio || !this.videoTimeGetter) return;
    const videoTime = this.videoTimeGetter();
    const drift = Math.abs(this.audio.currentTime - videoTime);
    if (drift > DRIFT_THRESHOLD) {
      this.audio.currentTime = videoTime;
    }
  }

  /** Cleanup */
  destroy() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    if (this.audio) {
      this.audio.pause();
      this.audio.src = "";
      this.audio = null;
    }
    this.energy = 0;
    this.wasPlaying = false;
  }
}
```

**Step 2: Verify file compiles**

```bash
npx tsc --noEmit src/lib/audio-momentum.ts
```

**Step 3: Commit**

```bash
git add src/lib/audio-momentum.ts
git commit -m "feat: add AudioMomentum class with physics engine"
```

---

### Task 3: Integrate AudioMomentum into ScrollVideoPlayer

**Files:**
- Modify: `src/components/ui/ScrollVideoPlayer.tsx`

**Step 1: Replace the old audio system**

The old audio code in ScrollVideoPlayer (startAudio, stopAudio, audio fade, sync loop) gets replaced by AudioMomentum integration. The key changes:

1. Add `audioSrc` prop (path to extracted audio file)
2. Create AudioMomentum instance in a ref
3. On forward scroll → `momentum.addImpulse()`
4. Remove: `startAudio`, `stopAudio`, `audioFadingRef`, `audioFadeRafRef`, `isScrollingRef`, `scrollTimeoutRef`, `userInteractedRef`, the sync useEffect, and the user-interaction tracking useEffect
5. Video element stays muted forever (no more unmuting)
6. Add `onEnergyChange` callback prop so parent can read energy for UI

New props interface:

```typescript
interface ScrollVideoPlayerProps {
  videoSrc: string;
  audioSrc: string;                                    // NEW
  scrollHeight?: number;
  onFrameChange?: (frameIndex: number, direction: "forward" | "backward") => void;
  onLoad?: (totalFrames: number) => void;
  onEnergyChange?: (energy: number) => void;           // NEW (replaces audioEnabled)
  onError?: () => void;
  children?: React.ReactNode;
}
```

The scroll handler becomes:

```typescript
const onScroll = () => {
  // ... existing scroll position + seekTo logic unchanged ...

  // Forward scroll → add impulse to audio momentum
  if (scrollingForward) {
    momentumRef.current?.addImpulse();
  }
};
```

Initialization in useEffect:

```typescript
useEffect(() => {
  if (!ready || !audioSrc) return;

  const momentum = new AudioMomentum();
  momentum.init(audioSrc);
  momentum.setVideoTimeGetter(() => currentTimeRef.current);
  momentumRef.current = momentum;

  return () => momentum.destroy();
}, [ready, audioSrc]);
```

Energy reporting (in the existing rAF sync loop, or replace it):

```typescript
useEffect(() => {
  if (!ready) return;

  let lastEnergy = -1;
  const tick = () => {
    const e = momentumRef.current?.getEnergy() ?? 0;
    // Only fire callback when energy changes meaningfully
    if (Math.abs(e - lastEnergy) > 0.01) {
      lastEnergy = e;
      onEnergyChange?.(e);
    }
    rafRef.current = requestAnimationFrame(tick);
  };

  rafRef.current = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(rafRef.current);
}, [ready, onEnergyChange]);
```

**Step 2: Verify build**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/components/ui/ScrollVideoPlayer.tsx
git commit -m "feat: integrate AudioMomentum into ScrollVideoPlayer"
```

---

### Task 4: Update usePianoScroll to use AudioMomentum

**Files:**
- Modify: `src/hooks/usePianoScroll.ts`

**Step 1: Rewrite the hook**

The hook no longer manages the old PianoSystem. Instead it:
1. Removes all imports/usage of `getPiano()` / `piano.ts`
2. Accepts a `momentumRef` (passed down from page.tsx → ScrollVideoPlayer) or uses a callback
3. On keypress → calls `window.scrollBy()` (scrolling triggers momentum impulse via ScrollVideoPlayer's scroll handler)
4. On click in cinema area → calls `window.scrollBy()`
5. Returns `{ isActive }` — `isActive` is true when energy > 0

Simplified version — the hook just handles keyboard/click → scroll. The momentum impulse happens automatically because scrolling triggers ScrollVideoPlayer's onScroll which calls `addImpulse()`.

```typescript
interface UsePianoScrollOptions {
  enabled?: boolean;
  scrollThreshold?: number;
}

export function usePianoScroll(options: UsePianoScrollOptions = {}) {
  const { enabled = true, scrollThreshold = 80 } = options;

  // Keyboard handler — scroll page forward
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.length !== 1) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      window.scrollBy({ top: scrollThreshold, behavior: "smooth" });
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, scrollThreshold]);

  // Click handler — scroll if in cinema area
  useEffect(() => {
    if (!enabled) return;

    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("a, button, input, textarea, select, [role='button']")) return;
      if (!target.closest("[data-cinema]")) return;

      window.scrollBy({ top: scrollThreshold, behavior: "smooth" });
    };

    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, [enabled, scrollThreshold]);
}
```

Note: `noteCount` and `isActive` are removed from this hook. The `PianoIndicator` will be updated to receive `energy` directly from page.tsx.

**Step 2: Verify build**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/hooks/usePianoScroll.ts
git commit -m "refactor: simplify usePianoScroll to just keyboard/click → scroll"
```

---

### Task 5: Update PianoIndicator to show momentum energy

**Files:**
- Modify: `src/components/ui/PianoIndicator.tsx`

**Step 1: Replace props and animation**

Instead of `noteCount`/`isActive` (discrete pulses), the indicator now shows continuous energy level. The equalizer bars animate proportionally to `energy` (0–1).

```typescript
interface PianoIndicatorProps {
  energy: number;  // 0–1, from AudioMomentum
}

export default function PianoIndicator({ energy }: PianoIndicatorProps) {
  const [showHint, setShowHint] = useState(true);
  const isActive = energy > 0.02;
  const barHeights = [0.3, 0.6, 1, 0.7, 0.4];

  useEffect(() => {
    const t = setTimeout(() => setShowHint(false), 8000);
    return () => clearTimeout(t);
  }, []);

  // Hide hint on first interaction
  useEffect(() => {
    if (isActive) setShowHint(false);
  }, [isActive]);

  return (
    <div
      className="fixed bottom-8 left-8 z-[997] flex items-end gap-3 transition-opacity duration-700"
      style={{ opacity: isActive ? 1 : 0.4 }}
    >
      <div className="flex items-end gap-[2px] h-5">
        {barHeights.map((baseH, i) => (
          <div
            key={i}
            className="w-[2px] rounded-[1px] transition-all"
            style={{
              height: `${baseH * (20 + energy * 80)}%`,
              background: energy > 0.3
                ? "var(--aura-gold)"
                : "var(--text-muted)",
              transitionDuration: "100ms",
            }}
          />
        ))}
      </div>

      {showHint && !isActive && (
        <span
          className="text-[9px] tracking-[0.2em] uppercase animate-pulse"
          style={{ color: "var(--text-muted)" }}
        >
          Scroll o presiona teclas ♪
        </span>
      )}
    </div>
  );
}
```

**Step 2: Verify build**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/components/ui/PianoIndicator.tsx
git commit -m "feat: update PianoIndicator to show continuous momentum energy"
```

---

### Task 6: Update page.tsx to wire everything together

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Update the page**

Key changes:
1. `usePianoScroll` no longer returns `noteCount`/`isActive` — just call it
2. Add `energy` state, pass to `PianoIndicator`
3. Pass `audioSrc` and `onEnergyChange` to `ScrollVideoPlayer`

```typescript
const AUDIO_SRC = "/audio/flamenco.m4a";
const AUDIO_FALLBACK = "/videos/flamenco-graded.mp4"; // use video as audio fallback

export default function Home() {
  usePianoScroll({ enabled: true, scrollThreshold: 80 });

  const [currentFrame, setCurrentFrame] = useState(0);
  const [energy, setEnergy] = useState(0);
  const [videoSrc, setVideoSrc] = useState(VIDEO_SRC);

  const handleFrameChange = useCallback(
    (frameIndex: number, _direction: "forward" | "backward") => {
      setCurrentFrame(frameIndex);
    },
    []
  );

  const handleVideoError = useCallback(() => {
    if (videoSrc === VIDEO_SRC) setVideoSrc(VIDEO_FALLBACK);
  }, [videoSrc]);

  return (
    <>
      <CustomCursor />
      <Navigation />
      <PianoIndicator energy={energy} />

      <main>
        <ScrollVideoPlayer
          videoSrc={videoSrc}
          audioSrc={AUDIO_SRC}
          scrollHeight={800}
          onFrameChange={handleFrameChange}
          onEnergyChange={setEnergy}
          onError={handleVideoError}
        >
          <ScrollStoryOverlay currentFrame={currentFrame} />
        </ScrollVideoPlayer>

        <Contact />
      </main>

      <Footer />
    </>
  );
}
```

**Step 2: Verify build**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: wire AudioMomentum through page.tsx"
```

---

### Task 7: Delete dead code

**Files:**
- Delete: `src/lib/piano.ts`
- Delete: `src/stores/useAudioStore.ts`

**Step 1: Delete files**

```bash
rm src/lib/piano.ts
rm src/stores/useAudioStore.ts
```

**Step 2: Verify no remaining imports**

```bash
grep -r "piano" src/ --include="*.ts" --include="*.tsx" -l
grep -r "useAudioStore" src/ --include="*.ts" --include="*.tsx" -l
```

Expected: no results (usePianoScroll.ts no longer imports piano.ts).

**Step 3: Verify build**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add -u
git commit -m "chore: delete dead code (piano.ts, useAudioStore)"
```

---

### Task 8: Manual testing & tuning

**No code changes — just test and tune constants.**

**Step 1: Start dev server**

```bash
npm run dev
```

**Step 2: Test matrix**

| Test | Expected |
|------|----------|
| Scroll forward slowly | Music plays slowly, pitch slightly lower than normal |
| Scroll forward fast | Music plays at normal tempo |
| Stop scrolling | Music decelerates ~1.5s, pitch drops (vinyl), fades to silence |
| Press any key | Page scrolls + music impulse |
| Rapid keypresses | Music sustains at full tempo |
| Scroll backward | Video scrubs back, music fades (no energy added) |
| Click in cinema area | Page scrolls + music impulse |
| Click on Contact form | No scroll, no music |
| Equalizer indicator | Bars animate with energy level |
| Page load | No audio until first interaction (autoplay policy) |

**Step 3: Tune constants if needed**

In `src/lib/audio-momentum.ts`, adjust:
- `IMPULSE` (0.2) — increase for more responsive feel, decrease for subtler
- `FRICTION` (0.985) — increase for longer sustain, decrease for faster decay
- `MAX_VOLUME` (0.7) — adjust to taste
- `DRIFT_THRESHOLD` (3.0) — decrease if sync feels loose

**Step 4: Commit tuning changes**

```bash
git add src/lib/audio-momentum.ts
git commit -m "tune: adjust momentum constants for optimal feel"
```
