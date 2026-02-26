/**
 * Token storage for authentication.
 *
 * - Access token: kept in memory only (not persisted — cleared on page reload)
 * - Refresh token: persisted in localStorage so sessions survive reloads
 *
 * An `onSessionExpired` callback can be registered so that the UI layer
 * (AuthContext) is notified when tokens are cleared due to an expired session,
 * as opposed to an explicit user-initiated logout.
 */

const REFRESH_TOKEN_KEY = "muninsbok_refresh_token";

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

export function getRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setTokens(access: string, refresh: string): void {
  accessToken = access;
  try {
    localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  } catch {
    // localStorage may be unavailable (private browsing, quota exceeded)
  }
}

export function clearTokens(options?: { notify?: boolean }): void {
  accessToken = null;
  try {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    // ignore
  }
  if (options?.notify && sessionExpiredCallback) {
    sessionExpiredCallback();
  }
}
