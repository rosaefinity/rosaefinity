// =============================================
// RosaeFinity â€” Session Manager
// Token persistence, auto-refresh, offline cache
// =============================================

import type { AuthSession } from './types';
import { getAuthProvider, isAuthProviderInitialized } from './auth-factory';

const SESSION_KEY = 'rf-session';
const REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 min before expiry

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

      // Still valid?
      if (Date.now() < cached.expiresAt - REFRESH_BUFFER_MS) {
        console.log('[AUTH-TRACE] sessionManager.restoreSession() SESSION VALID, expires in', Math.round((cached.expiresAt - Date.now()) / 60000), 'min');
        this.scheduleRefresh(cached);
        return cached;
      }

      // Expired â€” try refresh
      const refreshed = await this.refreshSession();
      if (refreshed) return refreshed;

      this.clearSession();
      return null;
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

  private scheduleRefresh(session: AuthSession): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    const ms = session.expiresAt - Date.now() - REFRESH_BUFFER_MS;
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
