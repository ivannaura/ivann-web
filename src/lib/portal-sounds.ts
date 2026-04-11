// ---------------------------------------------------------------------------
// PortalSounds — proximity-aware keyboard notes for constellation portal
// ---------------------------------------------------------------------------
// Each keypress produces an E Phrygian note whose character changes based on
// which constellation node the cursor is nearest to. Uses the same shared
// AudioContext as MicroSounds and AudioMomentum (iOS Safari limit = 4).
// Pre-allocated GainNode pool (3 voices) — only OscillatorNodes created per
// call (single-use by Web Audio spec). Graceful drop when all voices busy.
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
// Voice pool — pre-allocated GainNodes for portal notes
// ---------------------------------------------------------------------------
interface PortalVoice { gain: GainNode; endTime: number; }
const POOL_SIZE = 3;
let voicePool: PortalVoice[] = [];
let poolReady = false;
let poolCtx: AudioContext | null = null;

function initPool(ac: AudioContext): void {
  if (poolReady && poolCtx === ac) return;
  // Clean up old pool
  voicePool.forEach(v => v.gain.disconnect());
  voicePool = Array.from({ length: POOL_SIZE }, () => {
    const gain = ac.createGain();
    gain.gain.value = 0;
    gain.connect(ac.destination);
    return { gain, endTime: 0 };
  });
  poolReady = true;
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
  // Reset pool if context changed
  if (ctx !== poolCtx) {
    poolReady = false;
    voicePool = [];
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// E Phrygian scale — one octave lower than micro-sounds
// micro-sounds: [659, 698, 880, 988, 1047, 1319]
// portal:       [329, 349, 440, 494, 523,  659]
// ---------------------------------------------------------------------------
const NOTES = [329, 349, 440, 494, 523, 659];

// Throttle & repeat prevention
let lastNoteTime = 0;
let lastNoteIndex = -1;
const THROTTLE_MS = 150;

// ---------------------------------------------------------------------------
// WaveShaper for "apocalypsis" distortion
// ---------------------------------------------------------------------------
function makeDistortionCurve(amount: number): Float32Array<ArrayBuffer> {
  const samples = 256;
  const curve = new Float32Array(samples) as Float32Array<ArrayBuffer>;
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

// ---------------------------------------------------------------------------
// Core note player with per-node character
// ---------------------------------------------------------------------------
function playNote(
  freq: number,
  duration: number,
  volume: number,
  nodeId: string,
): void {
  const ac = getCtx();
  if (!ac) return;

  initPool(ac);

  // Find an expired voice
  const voice = voicePool.find(v => ac.currentTime >= v.endTime);
  if (!voice) return; // All busy — gracefully drop

  const now = ac.currentTime;

  // Create oscillator (single-use per Web Audio spec)
  const osc = ac.createOscillator();
  osc.type = nodeId === 'pianista' ? 'sine' : 'sine';
  osc.frequency.value = freq;

  // Build per-node audio graph
  switch (nodeId) {
    case 'mar': {
      // Longer decay, delay for reverb-like wash, lower volume
      const delay = ac.createDelay(1.0);
      delay.delayTime.value = 0.3;
      const feedback = ac.createGain();
      feedback.gain.value = 0.4;

      // Route: osc → voice.gain → delay → feedback → delay (loop)
      //                         → voice.gain (dry)
      // delay output also to destination via voice.gain
      osc.connect(voice.gain);
      voice.gain.connect(delay);
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(voice.gain);

      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(0, now);
      voice.gain.gain.linearRampToValueAtTime(volume, now + 0.01);
      voice.gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.start(now);
      osc.stop(now + duration);
      voice.endTime = now + duration;
      osc.onended = () => {
        osc.disconnect();
        delay.disconnect();
        feedback.disconnect();
      };
      break;
    }

    case 'apocalypsis': {
      // Deeper frequency (half), distortion, longer sustain
      osc.frequency.value = freq * 0.5;
      const ws = ac.createWaveShaper();
      ws.curve = makeDistortionCurve(8);
      ws.oversample = '2x';

      osc.connect(ws);
      ws.connect(voice.gain);

      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(0, now);
      voice.gain.gain.linearRampToValueAtTime(volume, now + 0.015);
      voice.gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.start(now);
      osc.stop(now + duration);
      voice.endTime = now + duration;
      osc.onended = () => {
        osc.disconnect();
        ws.disconnect();
      };
      break;
    }

    case 'pianista': {
      // Warm sine wave, medium decay
      osc.type = 'sine';
      osc.connect(voice.gain);

      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(0, now);
      voice.gain.gain.linearRampToValueAtTime(volume, now + 0.01);
      voice.gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.start(now);
      osc.stop(now + duration);
      voice.endTime = now + duration;
      osc.onended = () => { osc.disconnect(); };
      break;
    }

    // "concierto", "contratar", or any other/default: clean and direct
    default: {
      osc.connect(voice.gain);

      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(0, now);
      voice.gain.gain.linearRampToValueAtTime(volume, now + 0.01);
      voice.gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.start(now);
      osc.stop(now + duration);
      voice.endTime = now + duration;
      osc.onended = () => { osc.disconnect(); };
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Play a portal note whose character depends on the nearest constellation node. */
export function playPortalNote(nearestNodeId: string): void {
  // Throttle: max 1 note per 150ms
  const now = performance.now();
  if (now - lastNoteTime < THROTTLE_MS) return;
  lastNoteTime = now;

  // Pick a random non-repeating note
  let idx: number;
  do {
    idx = Math.floor(Math.random() * NOTES.length);
  } while (idx === lastNoteIndex && NOTES.length > 1);
  lastNoteIndex = idx;

  const freq = NOTES[idx];

  // Per-node parameters
  switch (nearestNodeId) {
    case 'mar':
      playNote(freq, 0.6, 0.015, 'mar');
      break;
    case 'apocalypsis':
      playNote(freq, 0.4, 0.025, 'apocalypsis');
      break;
    case 'pianista':
      playNote(freq, 0.35, 0.02, 'pianista');
      break;
    case 'concierto':
      playNote(freq, 0.2, 0.025, 'concierto');
      break;
    default:
      // "contratar" or any unknown node — same as concierto
      playNote(freq, 0.2, 0.025, nearestNodeId);
      break;
  }
}

/** Set global mute state for portal sounds. */
export function setPortalSoundsMuted(m: boolean): void {
  muted = m;
}

/** Release shared AudioContext reference and clean up voice pool. */
export function destroyPortalSounds(): void {
  voicePool.forEach(v => v.gain.disconnect());
  voicePool = [];
  poolReady = false;
  poolCtx = null;

  if (ctx) {
    releaseAudioContext();
    ctx = null;
  }
}
