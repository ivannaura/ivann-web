// ---------------------------------------------------------------------------
// Shared AudioContext — single context for all Web Audio consumers
// ---------------------------------------------------------------------------
// iOS Safari limits to 4 AudioContexts total. By sharing one context between
// AudioMomentum (frequency analysis) and MicroSounds (oscillator feedback),
// we stay well within the limit and avoid the "exceeded maximum number of
// AudioContexts" error.
// ---------------------------------------------------------------------------

let ctx: AudioContext | null = null;
let refCount = 0;

/** Acquire the shared AudioContext (creates on first call). */
export function acquireAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  // Guard: context may have been closed externally (e.g., releaseAudioContext
  // closed it, then a consumer tries to re-acquire before the module var is nulled)
  if (ctx && ctx.state === 'closed') {
    ctx = null;
    refCount = 0;
  }
  if (!ctx) {
    try {
      ctx = new AudioContext({ sampleRate: 44100 });
      primerAudioContext();
    } catch {
      return null;
    }
  }
  refCount++;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

/** Release a reference. Closes the context when last consumer releases. */
export function releaseAudioContext(): void {
  if (refCount <= 0) return; // guard: already fully released
  refCount--;
  if (refCount <= 0 && ctx) {
    ctx.close().catch(() => {});
    ctx = null;
    refCount = 0;
    primed = false; // reset so primerAudioContext() re-registers on next acquire (iOS)
  }
}

/** Resume suspended context (call after user gesture). */
export function resumeAudioContext(): void {
  if (ctx?.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}

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
  document.addEventListener('touchstart', handler, { passive: true });
  document.addEventListener('click', handler, { once: true });
}
