// ---------------------------------------------------------------------------
// AudioMomentum — physics-driven audio playback + real-time frequency analysis
// ---------------------------------------------------------------------------
// Vinyl-style momentum: scroll impulse → energy decay → playbackRate slowdown
// AnalyserNode: frequency data split into bass/mids/highs for shader reactivity
// ---------------------------------------------------------------------------

import { acquireAudioContext, releaseAudioContext, resumeAudioContext } from './shared-audio-context';

// Physics constants
const FRICTION = 0.985;
const MIN_RATE = 0.5;
const MAX_RATE = 1.0;
const MAX_VOLUME = 0.7;
const PLAY_THRESHOLD = 0.05;
const STOP_THRESHOLD = 0.02;
const DRIFT_THRESHOLD = 3.0;

// Frequency band boundaries (bin indices for fftSize=256 → 128 bins)
// Sample rate 44100Hz → each bin ≈ 172Hz
// Bass: 0–2 (~0-516Hz piano body, low octaves), Mids: 3–29 (~516-5160Hz melody, main piano), Highs: 30–128 (~5160Hz+ harmonics, shimmer, applause)
const BASS_END = 3;
const MIDS_END = 30;

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
  private gainNode: GainNode | null = null;
  private freqData: Uint8Array<ArrayBuffer> | null = null;
  private bands: FrequencyBands = { bass: 0, mids: 0, highs: 0 };
  private smoothBands: FrequencyBands = { bass: 0, mids: 0, highs: 0 };
  private lastTime: number = 0;
  private isMuted = false;

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
  addImpulse(normalizedVelocity: number = 0.5): void {
    const amount = 0.1 + normalizedVelocity * 0.25; // 0.1 gentle → 0.35 aggressive
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

  /** Mute or unmute via GainNode — preserves AnalyserNode signal for visual reactivity. */
  setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.gainNode && this.audioCtx) {
      const now = this.audioCtx.currentTime;
      this.gainNode.gain.cancelScheduledValues(now);
      this.gainNode.gain.setTargetAtTime(muted ? 0 : 1, now, 0.05);
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
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
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
      this.analyser.smoothingTimeConstant = 0.6;

      this.sourceNode = this.audioCtx.createMediaElementSource(this.audio);
      this.gainNode = this.audioCtx.createGain();
      this.sourceNode.connect(this.analyser);
      this.analyser.connect(this.gainNode);
      this.gainNode.connect(this.audioCtx.destination);

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
    if (this.energy <= 0 && !this.wasPlaying) return;

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

    // Asymmetric EMA: fast attack (0.6), slow release (0.15) — piano dynamics
    const ATTACK_ALPHA = 0.6;
    const RELEASE_ALPHA = 0.15;
    const asymmetric = (smoothed: number, raw: number) =>
      lerp(smoothed, raw, raw > smoothed ? ATTACK_ALPHA : RELEASE_ALPHA);
    this.smoothBands.bass = asymmetric(this.smoothBands.bass, this.bands.bass);
    this.smoothBands.mids = asymmetric(this.smoothBands.mids, this.bands.mids);
    this.smoothBands.highs = asymmetric(this.smoothBands.highs, this.bands.highs);
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
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.update);
  }

  /** Per-frame physics tick. Bound as arrow so it keeps `this` context. */
  private update = (): void => {
    if (!this.running) return;

    // --- delta-time friction decay ---
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 16.667, 3);
    this.lastTime = now;
    this.energy *= Math.pow(FRICTION, dt);
    if (this.energy < 0.001) this.energy = 0;

    // --- frequency analysis (runs even when muted for visual reactivity) ---
    this.updateFrequencyBands();

    // --- derived values ---
    // Exponential curve: pitch holds longer at high energy, drops dramatically
    // near zero — mimics real turntable/vinyl slowdown behavior.
    const curved = Math.pow(Math.max(0, this.energy), 0.7);
    const rate = lerp(MIN_RATE, MAX_RATE, curved);
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
        this.audio.volume = Math.pow(volume, 2);
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
        this.audio.volume = Math.pow(volume, 2);
        this.checkDrift(dt);
      }
    }

    // schedule next frame
    this.rafId = requestAnimationFrame(this.update);
  };

  /** Snap audio.currentTime to the current video position. */
  private syncToVideo(): void {
    if (!this.audio || !this.videoTimeGetter) return;
    const t = this.videoTimeGetter();
    if (!Number.isFinite(t)) return;
    // Brief mute to avoid click on snap
    if (this.gainNode && this.audioCtx) {
      const now = this.audioCtx.currentTime;
      this.gainNode.gain.setTargetAtTime(0, now, 0.005);
      this.gainNode.gain.setTargetAtTime(this.isMuted ? 0 : 1, now + 0.015, 0.01);
    }
    this.audio.currentTime = t;
  }

  /** If audio has drifted too far from video, re-sync. */
  private checkDrift(dt: number): void {
    if (!this.audio || !this.videoTimeGetter) return;
    const videoTime = this.videoTimeGetter();
    if (!Number.isFinite(videoTime)) return;
    const drift = this.audio.currentTime - videoTime;
    const absDrift = Math.abs(drift);

    if (absDrift > DRIFT_THRESHOLD) {
      // Hard snap (safety net)
      this.syncToVideo();
    } else if (absDrift > 1.0) {
      // Soft correction — nudge 10% per frame toward sync, scaled by dt
      this.audio.currentTime -= drift * 0.1 * dt;
    }
  }
}
