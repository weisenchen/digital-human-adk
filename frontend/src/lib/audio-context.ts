/**
 * Shared AudioContext singleton.
 * All components share one AudioContext, so it only needs one user gesture
 * to be created/resumed, and stays in "running" state permanently.
 */
let _ctx: AudioContext | null = null;

export function getSharedAudioContext(): AudioContext {
  if (!_ctx) {
    _ctx = new AudioContext();
  }
  return _ctx;
}

/** Ensure the shared context is running. Safe to call from async code. */
export async function resumeSharedAudioContext(): Promise<void> {
  const ctx = getSharedAudioContext();
  if (ctx.state === 'suspended') {
    try { await ctx.resume(); } catch {}
  }
}
