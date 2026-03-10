/**
 * Token storage for authentication.
 *
 * - Access token: kept in memory only (not persisted — cleared on page reload)
 * - Refresh token: stored as httpOnly cookie by the server — never accessible
 *   from JavaScript. The browser sends it automatically on /api/auth requests.
 *
 * An `onSessionExpired` callback can be registered so that the UI layer
 * (AuthContext) is notified when tokens are cleared due to an expired session,
 * as opposed to an explicit user-initiated logout.
 */

let accessToken: string | null = null;
let sessionExpiredCallback: (() => void) | null = null;

/**
 * Register a callback invoked when the session expires (i.e. clearTokens
 * is called with `{ notify: true }`).  Returns an unsubscribe function.
 */
export function onSessionExpired(cb: () => void): () => void {
  sessionExpiredCallback = cb;
  return () => {
    if (sessionExpiredCallback === cb) sessionExpiredCallback = null;
  };
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setTokens(access: string): void {
  accessToken = access;
}

export function clearTokens(options?: { notify?: boolean }): void {
  accessToken = null;
  if (options?.notify && sessionExpiredCallback) {
    sessionExpiredCallback();
  }
}
