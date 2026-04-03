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
      ctx = new AudioContext();
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
  }
}

/** Resume suspended context (call after user gesture). */
export function resumeAudioContext(): void {
  if (ctx?.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}
