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
const ENERGY_CAP = 0.6;        // comfortable maximum
const ENERGY_SOFTCAP = 0.65;   // overshoot margin before elastic damping
const ENERGY_MIN_ACTIVE = 0.08; // minimum to keep audio "alive" while decaying

// Precomputed ln(FRICTION) for exp-based decay: Math.exp(LN_FRICTION * dt)
const LN_FRICTION = Math.log(FRICTION);

// Frequency band boundaries (bin indices for fftSize=256 → 128 bins)
// Sample rate 44100Hz → each bin ≈ 172Hz
// Bass: 0–2 (~0-516Hz piano body, low octaves), Mids: 3–29 (~516-5160Hz melody, main piano), Highs: 30–128 (~5160Hz+ harmonics, shimmer, applause)
const BASS_END = 3;
const MIDS_END = 30;

// Precomputed band normalization divisors (unrolled summation)
const BASS_NORM = 1 / BASS_END;
const MIDS_NORM = 1 / (MIDS_END - BASS_END);
const HIGHS_NORM = 1 / (128 - MIDS_END);

// Float frequency data dB range constants
const DB_MIN = -100;
const DB_MAX = -30;
const DB_RANGE_INV = 1 / (DB_MAX - DB_MIN);

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
  private freqData: Float32Array<ArrayBuffer> | null = null;
  private bands: FrequencyBands = { bass: 0, mids: 0, highs: 0 };
  private smoothBands: FrequencyBands = { bass: 0, mids: 0, highs: 0 };
  private isMuted = false;
  private lastTargetGain = 0;
  private analyseSkip = 0;

  // Scroll-velocity tracking (non-cumulative, replaces addImpulse for scroll)
  private scrollVelocity = 0;
  // Accumulated dt for frequency analysis (runs every 2nd frame, needs total dt)
  private accumulatedDt = 0;

  // ---- Public API ---------------------------------------------------------

  /** Create the audio element, configure it. Caller drives tick() via GSAP ticker. */
  init(audioSrc: string): void {
    this.audio = new Audio(audioSrc);
    this.audio.preload = 'auto';
    this.audio.loop = false;
    this.audio.volume = 1; // permanent — volume routed through GainNode

    // Disable pitch correction — playbackRate changes produce vinyl slowdown.
    // preservesPitch is baseline since Dec 2023 — no vendor prefixes needed.
    (this.audio as any).preservesPitch = false;

    // Initialize Web Audio API for frequency analysis
    this.initAnalyser();

    // Handle visibility changes for energy decay while hidden
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    this.running = true;
  }

  /** Provide a function that returns the current video time (seconds). */
  setVideoTimeGetter(getter: () => number): void {
    this.videoTimeGetter = getter;
  }

  /** Inject energy from a discrete interaction (key press / click). */
  addImpulse(normalizedVelocity: number = 0.5): void {
    const amount = 0.1 + normalizedVelocity * 0.25; // 0.1 gentle → 0.35 aggressive
    this.energy = Math.min(ENERGY_CAP, this.energy + amount);
  }

  /**
   * Set current scroll velocity (non-cumulative).
   * Energy tracks this value via soft-follow — it rises to match but never
   * stacks on top. This prevents the "enloquece" bug where 60fps addImpulse
   * calls would saturate energy instantly.
   */
  setScrollVelocity(normalizedVelocity: number): void {
    this.scrollVelocity = Math.min(ENERGY_CAP, normalizedVelocity);
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
      this.gainNode.gain.setTargetAtTime(muted ? 0 : this.lastTargetGain, now, 0.05);
    }
  }

  /**
   * Per-frame physics tick. Called externally from GSAP ticker.
   * @param dt - delta-time normalized to 60fps (1.0 at 60fps, 2.0 at 30fps, capped at 3)
   */
  tick(dt: number): void {
    if (!this.running) return;

    // --- scroll velocity soft-follow (non-cumulative) ---
    // Energy rises toward scroll velocity (fast attack) but never stacks.
    // This replaces the old addImpulse-per-frame which saturated instantly.
    if (this.scrollVelocity > this.energy) {
      this.energy += (this.scrollVelocity - this.energy) * Math.min(1, 0.4 * dt);
    }
    // Scroll velocity decays 3× faster than energy — when user lifts finger,
    // scrollVelocity drops quickly while energy lingers (= vinyl tail)
    this.scrollVelocity *= Math.exp(LN_FRICTION * dt * 3);
    if (this.scrollVelocity < 0.001) this.scrollVelocity = 0;

    // --- delta-time friction decay (exp-based for perf) ---
    this.energy *= Math.exp(LN_FRICTION * dt);
    if (this.energy < 0.001) this.energy = 0;

    // --- frequency analysis every 2nd frame (runs even when muted for visual reactivity) ---
    // Accumulate dt so the EMA smoothing uses the correct total time span
    this.accumulatedDt += dt;
    if (++this.analyseSkip >= 2) {
      this.analyseSkip = 0;
      this.updateFrequencyBands(this.accumulatedDt);
      this.accumulatedDt = 0;
    }

    // Elastic energy cap — prevent explosive accumulation
    if (this.energy > ENERGY_SOFTCAP) {
      // Decay overshoot exponentially back toward cap (faster than normal friction)
      this.energy = ENERGY_CAP + (this.energy - ENERGY_CAP) * Math.exp(LN_FRICTION * dt * 2);
    }

    // Minimum active floor — keep audio alive while decaying
    if (this.wasPlaying && this.energy > STOP_THRESHOLD && this.energy < ENERGY_MIN_ACTIVE) {
      this.energy = ENERGY_MIN_ACTIVE;
    }

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
        this.checkDrift(dt);
      }

      // --- route volume through GainNode (avoids per-frame audio.volume setter) ---
      if (this.gainNode && this.audioCtx && !this.isMuted) {
        const targetGain = Math.pow(volume, 2);
        if (Math.abs(this.lastTargetGain - targetGain) > 0.005) {
          this.lastTargetGain = targetGain;
          this.gainNode.gain.setTargetAtTime(targetGain, this.audioCtx.currentTime, 0.02);
        }
      }
    }
  }

  /** Tear everything down: release audio resources. */
  destroy(): void {
    this.running = false;
    document.removeEventListener('visibilitychange', this.onVisibilityChange);

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
    this.scrollVelocity = 0;
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
      this.analyser.minDecibels = DB_MIN;
      this.analyser.maxDecibels = DB_MAX;

      this.sourceNode = this.audioCtx.createMediaElementSource(this.audio);
      this.gainNode = this.audioCtx.createGain();
      this.sourceNode.connect(this.analyser);
      this.analyser.connect(this.gainNode);
      this.gainNode.connect(this.audioCtx.destination);

      this.freqData = new Float32Array(this.analyser.frequencyBinCount);
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

  /** Extract bass/mids/highs from float frequency data with dt-corrected smoothing. */
  private updateFrequencyBands(dt: number): void {
    if (!this.analyser || !this.freqData) return;
    if (this.energy <= 0 && !this.wasPlaying) return;

    this.analyser.getFloatFrequencyData(this.freqData);
    const bins = this.freqData;

    // Unrolled branchless band summation with dB→0-1 normalization
    let bassSum = 0;
    for (let i = 0; i < BASS_END; i++) {
      bassSum += Math.max(0, Math.min(1, (bins[i] - DB_MIN) * DB_RANGE_INV));
    }
    let midsSum = 0;
    for (let i = BASS_END; i < MIDS_END; i++) {
      midsSum += Math.max(0, Math.min(1, (bins[i] - DB_MIN) * DB_RANGE_INV));
    }
    let highsSum = 0;
    for (let i = MIDS_END; i < 128; i++) {
      highsSum += Math.max(0, Math.min(1, (bins[i] - DB_MIN) * DB_RANGE_INV));
    }

    this.bands.bass = bassSum * BASS_NORM;
    this.bands.mids = midsSum * MIDS_NORM;
    this.bands.highs = highsSum * HIGHS_NORM;

    // Delta-time corrected asymmetric EMA: fast attack, slow release — piano dynamics
    const attackAlpha = 1 - Math.pow(1 - 0.6, dt);
    const releaseAlpha = 1 - Math.pow(1 - 0.15, dt);
    const sb = this.smoothBands, rb = this.bands;
    sb.bass = lerp(sb.bass, rb.bass, rb.bass > sb.bass ? attackAlpha : releaseAlpha);
    sb.mids = lerp(sb.mids, rb.mids, rb.mids > sb.mids ? attackAlpha : releaseAlpha);
    sb.highs = lerp(sb.highs, rb.highs, rb.highs > sb.highs ? attackAlpha : releaseAlpha);
  }

  /** Handle tab visibility: pause audio when hidden, decay energy on return. */
  private onVisibilityChange = (): void => {
    if (document.hidden) {
      this.hiddenAt = performance.now();
      if (this.wasPlaying && this.audio) {
        this.audio.pause();
        this.wasPlaying = false;
      }
    } else {
      // Decay energy for elapsed time while hidden (exp-based for perf)
      const elapsed = (performance.now() - this.hiddenAt) / 16.67;
      this.energy *= Math.exp(LN_FRICTION * elapsed);
      if (this.energy < 0.001) this.energy = 0;

      // Resume shared AudioContext (browsers suspend on hidden tab)
      resumeAudioContext();
    }
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
      this.gainNode.gain.setTargetAtTime(this.isMuted ? 0 : this.lastTargetGain, now + 0.015, 0.01);
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
      // Soft correction — exponential approach (dt-corrected, consistent across frame rates)
      this.audio.currentTime -= drift * (1 - Math.pow(0.9, dt));
    }
  }
}
