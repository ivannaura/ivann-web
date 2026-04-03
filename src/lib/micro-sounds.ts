// ---------------------------------------------------------------------------
// MicroSounds — lightweight audio feedback using Web Audio API oscillators
// ---------------------------------------------------------------------------
// No audio files needed. Each sound is a parametric oscillator with envelope.
// Respects user mute preference. Uses shared AudioContext (iOS Safari limit).
// ---------------------------------------------------------------------------

import { acquireAudioContext, releaseAudioContext } from './shared-audio-context';

let ctx: AudioContext | null = null;
let muted = false;
let reducedMotion = false;

// Check prefers-reduced-motion at module load
if (typeof window !== 'undefined') {
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function getCtx(): AudioContext | null {
  if (reducedMotion || muted) return null;
  // Re-acquire if previous context was closed (shared context lifecycle)
  if (ctx && ctx.state === 'closed') {
    ctx = null;
  }
  if (!ctx) {
    ctx = acquireAudioContext();
  }
  return ctx;
}

// Piano-like note: sine wave with fast attack, medium decay
function playNote(freq: number, duration: number, volume: number = 0.04): void {
  const ac = getCtx();
  if (!ac) return;

  const osc = ac.createOscillator();
  const gain = ac.createGain();

  osc.type = 'sine';
  osc.frequency.value = freq;

  const now = ac.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.01);     // fast attack
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration); // natural decay

  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(now);
  osc.stop(now + duration);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Set global mute state for micro-sounds. */
export function setMicroSoundsMuted(m: boolean): void {
  muted = m;
}

/** Soft piano-like tone on hover (random note from pentatonic scale). */
export function playHover(): void {
  // C major pentatonic in octave 5-6: C5, D5, E5, G5, A5, C6
  const notes = [523, 587, 659, 784, 880, 1047];
  const freq = notes[Math.floor(Math.random() * notes.length)];
  playNote(freq, 0.15, 0.025);
}

/** Resonant key press on CTA click. */
export function playClick(): void {
  // C4 + octave harmonic
  playNote(262, 0.3, 0.04);
  playNote(524, 0.2, 0.02);
}

/** Subtle whoosh for scroll momentum — frequency sweeps down. */
export function playWhoosh(): void {
  const ac = getCtx();
  if (!ac) return;

  const osc = ac.createOscillator();
  const gain = ac.createGain();
  const filter = ac.createBiquadFilter();

  osc.type = 'sawtooth';
  filter.type = 'lowpass';

  const now = ac.currentTime;
  // Frequency sweep down (wind-like)
  osc.frequency.setValueAtTime(400, now);
  osc.frequency.exponentialRampToValueAtTime(80, now + 0.15);

  // Filter follows
  filter.frequency.setValueAtTime(2000, now);
  filter.frequency.exponentialRampToValueAtTime(200, now + 0.15);
  filter.Q.value = 1;

  // Volume envelope
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.015, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.2);
}

/** Release shared AudioContext reference. */
export function destroyMicroSounds(): void {
  if (ctx) {
    releaseAudioContext();
    ctx = null;
  }
}
