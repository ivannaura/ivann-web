// ---------------------------------------------------------------------------
// AudioMomentum — physics-driven audio playback + real-time frequency analysis
// ---------------------------------------------------------------------------
// Vinyl-style momentum: scroll impulse → energy decay → playbackRate slowdown
// AnalyserNode: frequency data split into bass/mids/highs for shader reactivity
// ---------------------------------------------------------------------------

import { acquireAudioContext, releaseAudioContext, resumeAudioContext } from './shared-audio-context';

// Physics constants
const IMPULSE = 0.2;
const FRICTION = 0.985;
const MIN_RATE = 0.25;
const MAX_RATE = 1.0;
const MAX_VOLUME = 0.7;
const PLAY_THRESHOLD = 0.05;
const STOP_THRESHOLD = 0.02;
const DRIFT_THRESHOLD = 3.0;

// Frequency band boundaries (bin indices for fftSize=256 → 128 bins)
// Sample rate 44100Hz → each bin ≈ 172Hz
// Bass: 0–10 (~0-1720Hz fundamentals), Mids: 10–50 (~1720-8600Hz), Highs: 50–128 (~8600Hz+)
const BASS_END = 10;
const MIDS_END = 50;

// EMA alpha for frequency bands — lower = smoother (less jitter)
const BAND_ALPHA = 0.2;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface FrequencyBands {
  bass: number;   // 0-1: low frequencies (piano body, kick)
  mids: number;   // 0-1: mid frequencies (melody, voice)
  highs: number;  // 0-1: high frequencies (harmonics, shimmer)
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

  // Frequency analysis
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private freqData: Uint8Array<ArrayBuffer> | null = null;
  private bands: FrequencyBands = { bass: 0, mids: 0, highs: 0 };
  private smoothBands: FrequencyBands = { bass: 0, mids: 0, highs: 0 };

  // ---- Public API ---------------------------------------------------------

  /** Create the audio element, configure it, and start the physics loop. */
  init(audioSrc: string): void {
    this.audio = new Audio(audioSrc);
    this.audio.preload = 'auto';
    this.audio.loop = false;

    // Disable pitch correction — playbackRate changes produce vinyl slowdown.
    // preservesPitch is baseline since Dec 2023 — no vendor prefixes needed.
    (this.audio as any).preservesPitch = false;

    // Initialize Web Audio API for frequency analysis
    this.initAnalyser();

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

  /** Smoothed frequency bands from real-time audio analysis. */
  getFrequencyBands(): FrequencyBands {
    return this.smoothBands;
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

    // Disconnect Web Audio nodes before releasing audio element
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }
    if (this.audioCtx) {
      releaseAudioContext();
      this.audioCtx = null;
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
    this.freqData = null;
    this.bands = { bass: 0, mids: 0, highs: 0 };
    this.smoothBands = { bass: 0, mids: 0, highs: 0 };
  }

  // ---- Private ------------------------------------------------------------

  /** Set up AudioContext + AnalyserNode for frequency extraction. */
  private initAnalyser(): void {
    if (!this.audio) return;
    try {
      this.audioCtx = acquireAudioContext();
      if (!this.audioCtx) return;
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;

      this.sourceNode = this.audioCtx.createMediaElementSource(this.audio);
      this.sourceNode.connect(this.analyser);
      this.analyser.connect(this.audioCtx.destination);

      this.freqData = new Uint8Array(this.analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>;
    } catch {
      // Web Audio not available — frequency bands stay at 0
      // Release the acquired context ref to keep refCount balanced
      if (this.audioCtx) {
        releaseAudioContext();
      }
      this.audioCtx = null;
      this.analyser = null;
      this.sourceNode = null;
    }
  }

  /** Extract bass/mids/highs from frequency data. */
  private updateFrequencyBands(): void {
    if (!this.analyser || !this.freqData) return;

    this.analyser.getByteFrequencyData(this.freqData);
    const bins = this.freqData;
    const len = bins.length; // 128

    // Average each band, normalize to 0-1
    let bassSum = 0, midsSum = 0, highsSum = 0;
    for (let i = 0; i < len; i++) {
      if (i < BASS_END) bassSum += bins[i];
      else if (i < MIDS_END) midsSum += bins[i];
      else highsSum += bins[i];
    }

    this.bands.bass = bassSum / (BASS_END * 255);
    this.bands.mids = midsSum / ((MIDS_END - BASS_END) * 255);
    this.bands.highs = highsSum / ((len - MIDS_END) * 255);

    // EMA smoothing: smoothed = lerp(smoothed, raw, alpha)
    this.smoothBands.bass = lerp(this.smoothBands.bass, this.bands.bass, BAND_ALPHA);
    this.smoothBands.mids = lerp(this.smoothBands.mids, this.bands.mids, BAND_ALPHA);
    this.smoothBands.highs = lerp(this.smoothBands.highs, this.bands.highs, BAND_ALPHA);
  }

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

      // Resume shared AudioContext (browsers suspend on hidden tab)
      resumeAudioContext();

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

    // --- frequency analysis (runs even when muted for visual reactivity) ---
    this.updateFrequencyBands();

    // --- derived values ---
    const rate = lerp(MIN_RATE, MAX_RATE, this.energy);
    const volume = smoothstep(0, 0.15, this.energy) * MAX_VOLUME;

    if (this.audio) {
      // Resume shared AudioContext once on first user interaction (autoplay policy)
      if (this.energy > 0 && this.audioCtx?.state === 'suspended') {
        resumeAudioContext();
      }

      // --- start playing ---
      if (this.energy >= PLAY_THRESHOLD && !this.wasPlaying && !this.playPending) {
        this.syncToVideo();
        this.audio.playbackRate = rate;
        this.audio.volume = volume;
        this.playPending = true;
        this.audio.play().then(() => {
          if (!this.running) return; // destroyed while awaiting play()
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
