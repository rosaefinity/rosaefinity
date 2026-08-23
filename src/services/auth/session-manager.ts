// =============================================
// RosaeFinity — Session Manager
// Token persistence, auto-refresh, offline cache
// =============================================

import type { AuthSession } from './types';
import { getAuthProvider, isAuthProviderInitialized } from './auth-factory';

const SESSION_KEY = 'rf-session';

/**
 * Decode a JWT payload (base64url) without external libraries.
 * Returns null if the token is malformed.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

/**
 * Check if a JWT access token is expired.
 * Returns true if expired or unparseable.
 */
function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') {
    return true;
  }
  // exp is in seconds; add 30s clock-skew buffer
  return Date.now() >= (payload.exp * 1000) - 30_000;
}

class SessionManager {
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;

  async restoreSession(): Promise<AuthSession | null> {
    console.log('[AUTH-TRACE] sessionManager.restoreSession() START');
    try {
      const cached = this.getCachedSession();
      if (!cached) {
        console.log('[AUTH-TRACE] sessionManager.restoreSession() NO CACHED SESSION');
        return null;
      }

      // Validate the access token by decoding its JWT expiry.
      // This catches the case where localStorage has a stale session
      // but the access token is actually expired.
      if (!cached.accessToken || isTokenExpired(cached.accessToken)) {
        console.log('[AUTH-TRACE] sessionManager.restoreSession() ACCESS TOKEN EXPIRED — attempting refresh');
        const refreshed = await this.refreshSession();
        if (refreshed) return refreshed;
        console.log('[AUTH-TRACE] sessionManager.restoreSession() REFRESH FAILED — clearing session');
        this.clearSession();
        return null;
      }

      // Token is valid — schedule proactive refresh before expiry
      const expiryMs = this.getAccessTokenExpiry(cached.accessToken);
      const minutesLeft = Math.round((expiryMs - Date.now()) / 60000);
      console.log('[AUTH-TRACE] sessionManager.restoreSession() SESSION VALID, expires in', minutesLeft, 'min');
      this.scheduleRefresh(cached);
      return cached;
    } catch {
      this.clearSession();
      return null;
    }
  }

  saveSession(session: AuthSession): void {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    this.scheduleRefresh(session);
  }

  clearSession(): void {
    console.log('[AUTH-TRACE] sessionManager.clearSession()', { stack: new Error().stack?.split('\n').slice(1, 5).join(' | ') });
    localStorage.removeItem(SESSION_KEY);
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  getCachedSession(): AuthSession | null {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /**
   * Get the absolute expiry time of a JWT access token.
   */
  private getAccessTokenExpiry(token: string): number {
    const payload = decodeJwtPayload(token);
    if (payload && typeof payload.exp === 'number') {
      return payload.exp * 1000;
    }
    return Date.now();
  }

  private scheduleRefresh(session: AuthSession): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    // Use JWT exp if available, otherwise fall back to session.expiresAt
    const expiryMs = session.accessToken
      ? this.getAccessTokenExpiry(session.accessToken)
      : session.expiresAt;
    const ms = expiryMs - Date.now() - 5 * 60 * 1000; // Refresh 5 min before expiry
    if (ms <= 0) return;
    this.refreshTimer = setTimeout(() => this.refreshSession(), ms);
  }

  async refreshSession(): Promise<AuthSession | null> {
    console.log('[AUTH-TRACE] sessionManager.refreshSession() START');
    if (!isAuthProviderInitialized()) {
      console.log('[AUTH-TRACE] sessionManager.refreshSession() SKIP - no provider');
      return null;
    }
    try {
      const refreshed = await getAuthProvider().refreshSession();
      if (refreshed) {
        console.log('[AUTH-TRACE] sessionManager.refreshSession() SUCCESS');
        this.saveSession(refreshed);
        return refreshed;
      }
      console.log('[AUTH-TRACE] sessionManager.refreshSession() FAILED - provider returned null');
      this.clearSession();
      return null;
    } catch (err) {
      console.log('[AUTH-TRACE] sessionManager.refreshSession() ERROR', err);
      return null;
    }
  }
}

export const sessionManager = new SessionManager();
