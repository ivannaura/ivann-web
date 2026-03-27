// ---------------------------------------------------------------------------
// AudioMomentum — physics-driven audio playback tied to user interactions
// ---------------------------------------------------------------------------

// Physics constants
const IMPULSE = 0.2;
const FRICTION = 0.985;
const MIN_RATE = 0.25;
const MAX_RATE = 1.0;
const MAX_VOLUME = 0.7;
const PLAY_THRESHOLD = 0.05;
const STOP_THRESHOLD = 0.02;
const DRIFT_THRESHOLD = 3.0;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Standard smoothstep — Hermite interpolation clamped to [0, 1]. */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Linear interpolation from a to b by factor t. */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ---------------------------------------------------------------------------
// Class
// ---------------------------------------------------------------------------

export class AudioMomentum {
  private audio: HTMLAudioElement | null = null;
  private energy: number = 0;
  private rafId: number = 0;
  private running: boolean = false;
  private wasPlaying: boolean = false;
  private playPending: boolean = false;
  private videoTimeGetter: (() => number) | null = null;
  private hiddenAt: number = 0;

  // ---- Public API ---------------------------------------------------------

  /** Create the audio element, configure it, and start the physics loop. */
  init(audioSrc: string): void {
    this.audio = new Audio(audioSrc);
    this.audio.preload = 'auto';
    this.audio.loop = false;

    // Disable pitch correction so playbackRate changes sound natural.
    // preservesPitch is baseline since Dec 2023 — no vendor prefixes needed.
    (this.audio as any).preservesPitch = false;

    // Pause physics when tab is hidden, resume on return
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    this.startLoop();
  }

  /** Provide a function that returns the current video time (seconds). */
  setVideoTimeGetter(getter: () => number): void {
    this.videoTimeGetter = getter;
  }

  /** Inject energy from a user interaction (scroll / key / click). */
  addImpulse(amount: number = IMPULSE): void {
    this.energy = Math.min(1.0, this.energy + amount);
  }

  /** Current energy level (0 – 1). */
  getEnergy(): number {
    return this.energy;
  }

  /** Mute or unmute the audio element without stopping physics. */
  setMuted(muted: boolean): void {
    if (this.audio) {
      this.audio.muted = muted;
    }
  }

  /** Tear everything down: stop loop, release audio resources. */
  destroy(): void {
    this.running = false;
    document.removeEventListener('visibilitychange', this.onVisibilityChange);

    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }

    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
      this.audio = null;
    }

    this.energy = 0;
    this.wasPlaying = false;
    this.playPending = false;
    this.videoTimeGetter = null;
  }

  // ---- Private ------------------------------------------------------------

  /** Pause loop and audio when tab goes to background. */
  private onVisibilityChange = (): void => {
    if (document.hidden) {
      this.hiddenAt = performance.now();
      if (this.wasPlaying && this.audio) {
        this.audio.pause();
        this.wasPlaying = false;
      }
      this.running = false;
      cancelAnimationFrame(this.rafId);
    } else {
      // Decay energy for elapsed time while hidden
      const elapsed = (performance.now() - this.hiddenAt) / 16.67;
      this.energy *= Math.pow(FRICTION, elapsed);
      if (this.energy < 0.001) this.energy = 0;
      this.startLoop();
    }
  };

  /** Start the requestAnimationFrame loop (guards against double-start). */
  private startLoop(): void {
    if (this.running) return;
    this.running = true;
    this.rafId = requestAnimationFrame(this.update);
  }

  /** Per-frame physics tick. Bound as arrow so it keeps `this` context. */
  private update = (): void => {
    if (!this.running) return;

    // --- friction decay ---
    this.energy *= FRICTION;
    if (this.energy < 0.001) this.energy = 0;

    // --- derived values ---
    const rate = lerp(MIN_RATE, MAX_RATE, this.energy);
    const volume = smoothstep(0, 0.15, this.energy) * MAX_VOLUME;

    if (this.audio) {
      // --- start playing ---
      if (this.energy >= PLAY_THRESHOLD && !this.wasPlaying && !this.playPending) {
        this.syncToVideo();
        this.audio.playbackRate = rate;
        this.audio.volume = volume;
        this.playPending = true;
        this.audio.play().then(() => {
          this.wasPlaying = true;
          this.playPending = false;
        }).catch(() => {
          this.playPending = false;
        });
      }

      // --- stop playing ---
      if (this.energy < STOP_THRESHOLD && this.wasPlaying) {
        this.audio.pause();
        this.wasPlaying = false;
      }

      // --- update while playing ---
      if (this.wasPlaying) {
        this.audio.playbackRate = rate;
        this.audio.volume = volume;
        this.checkDrift();
      }
    }

    // schedule next frame
    this.rafId = requestAnimationFrame(this.update);
  };

  /** Snap audio.currentTime to the current video position. */
  private syncToVideo(): void {
    if (!this.audio || !this.videoTimeGetter) return;
    const t = this.videoTimeGetter();
    if (Number.isFinite(t)) {
      this.audio.currentTime = t;
    }
  }

  /** If audio has drifted too far from video, re-sync. */
  private checkDrift(): void {
    if (!this.audio || !this.videoTimeGetter) return;
    const videoTime = this.videoTimeGetter();
    if (!Number.isFinite(videoTime)) return;
    if (Math.abs(this.audio.currentTime - videoTime) > DRIFT_THRESHOLD) {
      this.syncToVideo();
    }
  }
}
