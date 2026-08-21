// =============================================
// RosaeFinity â€” Backend Auth Provider
// Connects to the real backend API
// =============================================

import type { AuthProvider, AuthUser, AuthSession, AuthResult, AuthProviderType } from '../types';

// VITE_API_URL must be set in .env.production for production builds
// In development, it falls back to localhost:3000/api
const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3000/api' : '');

if (!API_URL && !import.meta.env.DEV) {
  console.error('[RosaeFinity] VITE_API_URL is not set. Please configure your environment variables.');
}
const ACCESS_TOKEN_KEY = 'rf_access_token';
const REFRESH_TOKEN_KEY = 'rf_refresh_token';

interface BackendUser {
  id: string;
  email: string;
  username: string;
  role: string;
  avatar: string | null;
}

interface LoginResponse {
  success: boolean;
  data?: {
    user: BackendUser;
    accessToken: string;
    refreshToken: string;
  };
  error?: string;
}

interface MeResponse {
  success: boolean;
  data?: BackendUser;
  error?: string;
}

export class BackendAuthProvider implements AuthProvider {
  readonly name = 'email' as const;

  private refreshTokenTimer: ReturnType<typeof setTimeout> | null = null;

  async signInWithEmail(email: string, password: string): Promise<AuthResult> {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok || !data.success || !data.data) {
        // Extract error message - backend returns { error: { message: "..." } } or { error: "..." }
        let errorMessage = 'Invalid email or password';
        if (data.error) {
          if (typeof data.error === 'string') {
            errorMessage = data.error;
          } else if (typeof data.error === 'object' && data.error.message) {
            errorMessage = data.error.message;
          }
        }
        return {
          success: false,
          error: errorMessage,
        };
      }

      const { user: backendUser, accessToken, refreshToken } = data.data;
      const user = this.mapBackendUser(backendUser);
      const session = this.buildSession(user, accessToken, refreshToken);

      this.saveTokens(accessToken, refreshToken);
      this.scheduleRefresh(session);

      return { success: true, user, session };
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        return { success: false, error: 'Backend unavailable. Please try again.' };
      }
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  async signUpWithEmail(email: string, password: string, displayName?: string): Promise<AuthResult> {
    console.log("[REGISTER] ===== START =====");
    console.log("[REGISTER] email =", email);
    console.log("[REGISTER] displayName =", displayName);
    console.log("[REGISTER] typeof API_URL =", typeof API_URL);
    console.log("[REGISTER] API_URL =", API_URL);

    try {
      // Derive username from displayName or email
      const username = displayName
        ? displayName.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase()
        : email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();

      console.log("[REGISTER] username =", username);

      const url = `${API_URL}/auth/register`;
      const requestBody = { email, password, username };
      console.log("[REGISTER] url =", url);
      console.log("[REGISTER] body =", requestBody);
      console.log("[REGISTER] before fetch");

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      console.log("[REGISTER] after fetch");
      console.log("[REGISTER] response.status =", response.status);
      console.log("[REGISTER] response.ok =", response.ok);
      console.log("[REGISTER] response.headers =", [...response.headers.entries()]);

      const raw = await response.text();
      console.log("[REGISTER] response.text =", raw);

      let data: any;
      try {
        data = JSON.parse(raw);
      } catch (parseErr) {
        console.error("[REGISTER] JSON parse failed", parseErr);
        return { success: false, error: `Invalid JSON from server: ${raw.substring(0, 200)}` };
      }

      console.log("[REGISTER] parsed response =", data);

      if (!response.ok || !data.success || !data.data) {
        // Normalize error to string
        let errorMessage = 'Registration failed';
        if (data.error) {
          if (typeof data.error === 'string') {
            errorMessage = data.error;
          } else if (typeof data.error === 'object' && data.error.message) {
            errorMessage = data.error.message;
          }
        } else if (data.message) {
          errorMessage = data.message;
        }
        console.log("[REGISTER] returning error:", errorMessage);
        return {
          success: false,
          error: errorMessage,
        };
      }

      const { user: backendUser, accessToken, refreshToken } = data.data;
      const user = this.mapBackendUser(backendUser);
      const session = this.buildSession(user, accessToken, refreshToken);

      this.saveTokens(accessToken, refreshToken);
      this.scheduleRefresh(session);

      console.log("[REGISTER] returning success");
      return { success: true, user, session };
    } catch (err: any) {
      console.error("[REGISTER] CATCH =", err);
      console.error("[REGISTER] CATCH stack =", err.stack);
      if (err instanceof TypeError && err.message.includes('fetch')) {
        return { success: false, error: 'Backend unavailable. Please try again.' };
      }
      return { success: false, error: err.message || 'An unexpected error occurred' };
    }
  }

  async signInWithGoogle(): Promise<AuthResult> {
    // Google OAuth not implemented in backend yet
    return { success: false, error: 'Google sign-in not available' };
  }

  async signInWithDiscord(): Promise<AuthResult> {
    return { success: false, error: 'Discord sign-in not available' };
  }

  async signInWithGitHub(): Promise<AuthResult> {
    return { success: false, error: 'GitHub sign-in not available' };
  }

  async signInWithMicrosoft(): Promise<AuthResult> {
    return { success: false, error: 'Microsoft sign-in not available' };
  }

  async signInWithMagicLink(_email: string): Promise<AuthResult> {
    return { success: false, error: 'Magic link not available' };
  }

  async signInAnonymously(): Promise<AuthResult> {
    return { success: false, error: 'Anonymous sign-in not available' };
  }

  async signOut(): Promise<void> {
    const refreshToken = this.getRefreshToken();
    if (refreshToken) {
      try {
        await fetch(`${API_URL}/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
      } catch {
        // Ignore logout errors
      }
    }
    this.clearTokens();
    if (this.refreshTokenTimer) {
      clearTimeout(this.refreshTokenTimer);
      this.refreshTokenTimer = null;
    }
  }

  async refreshSession(): Promise<AuthSession | null> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return null;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);

      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok || !data.success || !data.data) {
        this.clearTokens();
        return null;
      }

      const { accessToken, refreshToken: newRefreshToken } = data.data;
      this.saveTokens(accessToken, newRefreshToken);

      // Get user data from /auth/me
      const controller2 = new AbortController();
      const timeoutId2 = setTimeout(() => controller2.abort(), 10_000);

      const userResponse = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: controller2.signal,
      });

      clearTimeout(timeoutId2);

      const userData: MeResponse = await userResponse.json();

      if (!userResponse.ok || !userData.success || !userData.data) {
        this.clearTokens();
        return null;
      }

      const user = this.mapBackendUser(userData.data);
      const session = this.buildSession(user, accessToken, newRefreshToken);

      this.scheduleRefresh(session);
      return session;
    } catch {
      this.clearTokens();
      return null;
    }
  }

  async getCurrentSession(): Promise<AuthSession | null> {
    const accessToken = this.getAccessToken();
    if (!accessToken) return null;

    console.log('[AUTH-FLOW] getCurrentSession START');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);

      const response = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data: MeResponse = await response.json();

      if (!response.ok || !data.success || !data.data) {
        console.log('[AUTH-FLOW] getCurrentSession UNAUTHORIZED');
        return null;
      }

      const user = this.mapBackendUser(data.data);
      const refreshToken = this.getRefreshToken() || '';
      const session = this.buildSession(user, accessToken, refreshToken);

      console.log('[AUTH-FLOW] getCurrentSession SUCCESS');
      return session;
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        console.warn('[AUTH-FLOW] getCurrentSession TIMEOUT (10s)');
      } else {
        console.warn('[AUTH-FLOW] getCurrentSession NETWORK_ERROR', err);
      }
      return null;
    }
  }

  async resetPassword(_email: string): Promise<void> {
    // Not implemented
  }

  async updatePassword(_newPassword: string): Promise<void> {
    // Not implemented
  }

  async verifyEmail(_token: string): Promise<AuthResult> {
    return { success: false, error: 'Email verification not available' };
  }

  async resendVerification(_email: string): Promise<void> {
    // Not implemented
  }

  async updateProfile(updates: Partial<AuthUser>): Promise<AuthUser> {
    const session = await this.getCurrentSession();
    if (!session) throw new Error('No active session');
    return { ...session.user, ...updates, updatedAt: new Date().toISOString() };
  }

  private _initChecked = false;

  onAuthStateChange(callback: (session: AuthSession | null) => void): () => void {
    // Skip the initial getCurrentSession() call.
    // initialize() already performs one authoritative session restoration
    // via sessionManager.restoreSession(). Calling getCurrentSession() here
    // creates a SECOND competing /me request that can hang or re-trigger
    // isLoading, causing the RouteGuard spinner to appear indefinitely.
    if (!this._initChecked) {
      this._initChecked = true;
      console.log('[AUTH-FLOW] onAuthStateChange REGISTERED (initial call skipped)');
      return () => {};
    }

    console.log('[AUTH-FLOW] onAuthStateChange â†’ getCurrentSession');
    this.getCurrentSession().then((session) => {
      console.log('[AUTH-FLOW] auth state changed:', session ? 'session found' : 'no session');
      callback(session);
    });
    return () => {};
  }

  supportsOffline(): boolean {
    return false;
  }

  supportsProvider(_provider: AuthProviderType): boolean {
    return _provider === 'email';
  }

  // â”€â”€ Internal â”€â”€

  private mapBackendUser(backendUser: BackendUser): AuthUser {
    return {
      id: backendUser.id,
      email: backendUser.email,
      username: backendUser.username,
      displayName: backendUser.username,
      avatarUrl: backendUser.avatar,
      provider: 'email',
      accountType: backendUser.role === 'admin' ? 'admin' : 'free',
      subscriptionStatus: 'none',
      licenseStatus: 'none',
      isAnonymous: false,
      emailVerified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  private buildSession(user: AuthUser, accessToken: string, refreshToken: string): AuthSession {
    return {
      user,
      accessToken,
      refreshToken,
      expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour (backend controls actual expiry)
      isOffline: false,
    };
  }

  private scheduleRefresh(session: AuthSession): void {
    if (this.refreshTokenTimer) clearTimeout(this.refreshTokenTimer);
    const ms = session.expiresAt - Date.now() - 5 * 60 * 1000; // Refresh 5 min before expiry
    if (ms > 0) {
      this.refreshTokenTimer = setTimeout(() => this.refreshSession(), ms);
    }
  }

  private saveTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }

  private clearTokens(): void {
    console.log('[AUTH-TRACE] backendProvider.clearTokens()', { stack: new Error().stack?.split('\n').slice(1, 5).join(' | ') });
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }

  private getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  private getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }
}
