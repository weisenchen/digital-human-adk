/**
 * Shared AudioContext singleton.
 * All components share one AudioContext, so it only needs one user gesture
 * to be created/resumed, and stays in "running" state permanently.
 *
 * Resilience: if an external component closes the context (e.g. on unmount),
 * getSharedAudioContext() automatically creates a fresh one on next access.
 */
let _ctx: AudioContext | null = null;

export function getSharedAudioContext(): AudioContext {
  if (!_ctx || _ctx.state === 'closed') {
    // Close the old one if it's just closed so pending work resolves
    if (_ctx) {
      try { _ctx = null; } catch {}
    }
    _ctx = new AudioContext();
  }
  return _ctx;
}

/** Close the shared context AND null the reference so it auto-recreates next time. */
export function closeSharedAudioContext(): void {
  if (_ctx) {
    try { _ctx.close(); } catch {}
    _ctx = null;
  }
}

/** Ensure the shared context is running. Safe to call from async code. */
export async function resumeSharedAudioContext(): Promise<void> {
  const ctx = getSharedAudioContext();
  if (ctx.state === 'suspended') {
    try { await ctx.resume(); } catch {}
  }
}
