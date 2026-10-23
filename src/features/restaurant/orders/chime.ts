/**
 * The new-order sound, synthesized with the Web Audio API (no audio file).
 * Browsers only let a page play sound after the visitor interacted with it, so the
 * AudioContext is created and resumed from a user gesture (`unlockAudio`).
 */
export type AudioState = 'locked' | 'ready' | 'unsupported';

let context: AudioContext | null = null;
const listeners = new Set<() => void>();
const notify = () => { for (const listener of listeners) listener(); };

const supported = () => typeof window !== 'undefined' && typeof window.AudioContext === 'function';

export function getAudioState(): AudioState {
  if (!supported()) return 'unsupported';
  return context?.state === 'running' ? 'ready' : 'locked';
}

export function subscribeAudio(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Call from a click or key press. Resolves true once sound can play. */
export async function unlockAudio(): Promise<boolean> {
  if (!supported()) return false;
  try {
    if (!context) {
      context = new AudioContext();
      context.onstatechange = notify;
    }
    if (context.state !== 'running') await context.resume();
  } catch {
    // Still locked; the prompt stays.
  }
  notify();
  return context?.state === 'running';
}

/** Two short rising notes. Returns false when sound is still locked. */
export function playChime(): boolean {
  if (!context || context.state !== 'running') return false;
  const start = context.currentTime + 0.02;
  for (const [frequency, offset] of [[880, 0], [1318.5, 0.17], [1760, 0.34]] as const) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start + offset);
    gain.gain.exponentialRampToValueAtTime(0.3, start + offset + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.45);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start + offset);
    oscillator.stop(start + offset + 0.5);
  }
  return true;
}
