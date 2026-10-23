import type { AuthUser, SessionResponse } from '@bilhanah/contracts';

export type SessionState =
  | { status: 'loading' }
  | { status: 'anonymous'; reason?: 'signed-out' | 'expired' }
  | { status: 'authenticated'; accessToken: string; user: AuthUser };

/**
 * The signed-in session, kept in memory only. The access token is never written to
 * storage; after a reload the session is restored from the HttpOnly refresh cookie.
 */
export class SessionStore {
  private state: SessionState = { status: 'loading' };
  private readonly listeners = new Set<() => void>();

  getState = (): SessionState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  accessToken(): string | null {
    return this.state.status === 'authenticated' ? this.state.accessToken : null;
  }

  setSession(session: SessionResponse): void {
    this.set({ status: 'authenticated', accessToken: session.accessToken, user: session.user });
  }

  updateUser(user: AuthUser): void {
    if (this.state.status === 'authenticated') this.set({ ...this.state, user });
  }

  clear(reason: 'signed-out' | 'expired' = 'signed-out'): void {
    if (this.state.status === 'anonymous' && this.state.reason === reason) return;
    this.set({ status: 'anonymous', reason });
  }

  private set(state: SessionState): void {
    this.state = state;
    for (const listener of this.listeners) listener();
  }
}
