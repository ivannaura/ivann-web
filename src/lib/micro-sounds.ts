// ---------------------------------------------------------------------------
// MicroSounds — lightweight audio feedback using Web Audio API oscillators
// ---------------------------------------------------------------------------
// No audio files needed. Each sound is a parametric oscillator with envelope.
// Respects user mute preference. Uses shared AudioContext (iOS Safari limit).
// Pre-allocated GainNode pools avoid per-call node creation on hot paths.
// ---------------------------------------------------------------------------

import { acquireAudioContext, releaseAudioContext } from './shared-audio-context';

let ctx: AudioContext | null = null;
let muted = false;
let reducedMotion = false;

// Live prefers-reduced-motion listener (responds to runtime OS toggle)
if (typeof window !== 'undefined') {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  reducedMotion = mq.matches;
  mq.addEventListener('change', (e) => { reducedMotion = e.matches; });
}

// ---------------------------------------------------------------------------
// NoteVoice pool — pre-allocated GainNodes for playNote
// ---------------------------------------------------------------------------
interface NoteVoice { gain: GainNode; endTime: number; }
const NOTE_POOL_SIZE = 4;
let notePool: NoteVoice[] = [];
let notePoolReady = false;
let poolCtx: AudioContext | null = null;

function initNotePool(ac: AudioContext): void {
  if (notePoolReady && poolCtx === ac) return;
  // Clean up old pool
  notePool.forEach(v => v.gain.disconnect());
  notePool = Array.from({ length: NOTE_POOL_SIZE }, () => {
    const gain = ac.createGain();
    gain.gain.value = 0;
    gain.connect(ac.destination);
    return { gain, endTime: 0 };
  });
  notePoolReady = true;
  poolCtx = ac;
}

// ---------------------------------------------------------------------------
// WhooshVoice pool — pre-allocated filter + gain chains for playWhoosh
// ---------------------------------------------------------------------------
interface WhooshVoice { filter: BiquadFilterNode; gain: GainNode; endTime: number; }
const WHOOSH_POOL_SIZE = 2;
let whooshPool: WhooshVoice[] = [];
let whooshPoolReady = false;

function initWhooshPool(ac: AudioContext): void {
  if (whooshPoolReady && poolCtx === ac) return;
  // Clean up old pool
  whooshPool.forEach(v => { v.filter.disconnect(); v.gain.disconnect(); });
  whooshPool = Array.from({ length: WHOOSH_POOL_SIZE }, () => {
    const filter = ac.createBiquadFilter();
    const gain = ac.createGain();
    filter.type = 'lowpass';
    filter.Q.value = 1;
    gain.gain.value = 0;
    filter.connect(gain);
    gain.connect(ac.destination);
    return { filter, gain, endTime: 0 };
  });
  whooshPoolReady = true;
  // poolCtx is already set by initNotePool or will be set here
  poolCtx = ac;
}

// ---------------------------------------------------------------------------
// Shared AudioContext accessor
// ---------------------------------------------------------------------------
function getCtx(): AudioContext | null {
  if (reducedMotion || muted) return null;
  // Re-acquire if previous context was closed (shared context lifecycle)
  if (ctx && ctx.state === 'closed') {
    ctx = null;
  }
  if (!ctx) {
    ctx = acquireAudioContext();
  }
  // Reset pools if context changed
  if (ctx !== poolCtx) {
    notePoolReady = false;
    notePool = [];
    whooshPoolReady = false;
    whooshPool = [];
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Piano-like note: sine wave with fast attack, medium decay
// Uses NoteVoice pool — only OscillatorNode is created fresh (single-use by spec)
// ---------------------------------------------------------------------------
function playNote(freq: number, duration: number, volume: number = 0.04): void {
  const ac = getCtx();
  if (!ac) return;

  initNotePool(ac);

  // Find an expired voice
  const voice = notePool.find(v => ac.currentTime >= v.endTime);
  if (!voice) return; // All busy — gracefully drop

  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = freq;

  const now = ac.currentTime;
  voice.gain.gain.cancelScheduledValues(now);
  voice.gain.gain.setValueAtTime(0, now);
  voice.gain.gain.linearRampToValueAtTime(volume, now + 0.01);     // fast attack
  voice.gain.gain.exponentialRampToValueAtTime(0.001, now + duration); // natural decay

  osc.connect(voice.gain);
  osc.start(now);
  osc.stop(now + duration);
  voice.endTime = now + duration;
  osc.onended = () => { osc.disconnect(); };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Set global mute state for micro-sounds. */
export function setMicroSoundsMuted(m: boolean): void {
  muted = m;
}

// Track last hover note to prevent consecutive repeats
let lastNoteIndex = -1;

/** Soft piano-like tone on hover (random non-repeating note from pentatonic scale). */
export function playHover(): void {
  // E Phrygian compatible in octave 5-6: E5, F5, A5, B5, C6, E6
  const notes = [659, 698, 880, 988, 1047, 1319];
  let idx: number;
  do {
    idx = Math.floor(Math.random() * notes.length);
  } while (idx === lastNoteIndex && notes.length > 1);
  lastNoteIndex = idx;
  playNote(notes[idx], 0.15, 0.025);
}

/** Resonant key press on CTA click. */
let lastClickTime = 0;
export function playClick(): void {
  const now = performance.now();
  if (now - lastClickTime < 100) return;
  lastClickTime = now;
  // E4 + octave harmonic (Phrygian match)
  playNote(330, 0.3, 0.04);
  playNote(659, 0.2, 0.02);
}

/** Subtle whoosh for scroll momentum — frequency sweeps down. */
export function playWhoosh(): void {
  const ac = getCtx();
  if (!ac) return;

  initWhooshPool(ac);

  // Find an expired voice
  const voice = whooshPool.find(v => ac.currentTime >= v.endTime);
  if (!voice) return; // All busy — gracefully drop

  const osc = ac.createOscillator();
  osc.type = 'sawtooth';

  const now = ac.currentTime;
  // Frequency sweep down (wind-like)
  osc.frequency.setValueAtTime(400, now);
  osc.frequency.exponentialRampToValueAtTime(80, now + 0.15);

  // Filter follows
  voice.filter.frequency.cancelScheduledValues(now);
  voice.filter.frequency.setValueAtTime(2000, now);
  voice.filter.frequency.exponentialRampToValueAtTime(200, now + 0.15);

  // Volume envelope
  voice.gain.gain.cancelScheduledValues(now);
  voice.gain.gain.setValueAtTime(0, now);
  voice.gain.gain.linearRampToValueAtTime(0.015, now + 0.02);
  voice.gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

  osc.connect(voice.filter);
  osc.start(now);
  osc.stop(now + 0.2);
  voice.endTime = now + 0.2;
  osc.onended = () => { osc.disconnect(); };
}

/** Release shared AudioContext reference and clean up pools. */
export function destroyMicroSounds(): void {
  // Disconnect note pool
  notePool.forEach(v => v.gain.disconnect());
  notePool = [];
  notePoolReady = false;

  // Disconnect whoosh pool
  whooshPool.forEach(v => { v.filter.disconnect(); v.gain.disconnect(); });
  whooshPool = [];
  whooshPoolReady = false;

  poolCtx = null;

  if (ctx) {
    releaseAudioContext();
    ctx = null;
  }
}
