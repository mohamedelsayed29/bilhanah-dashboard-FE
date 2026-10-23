import { useSyncExternalStore } from 'react';
import { SessionStore, type SessionState } from './session-store';

export { SessionStore } from './session-store';
export type { SessionState } from './session-store';

export const sessionStore = new SessionStore();

export function useSession(): SessionState {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.getState);
}
