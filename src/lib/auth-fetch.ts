// =============================================
// RosaeFinity — Centralized Auth Fetch
// Handles 401 with automatic token refresh + retry.
// On failure, clears auth state and redirects to login.
// =============================================

import { getAuthProvider } from '../services/auth/auth-factory';
import { useAuthStore } from '../store/auth-store';
import { safeNavigate } from './safe-navigate';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3000/api' : '');
const ACCESS_TOKEN_KEY = 'rf_access_token';

interface AuthFetchError {
  message: string;
  status: number;
  code?: string;
}

let _isRefreshing = false;
let _refreshPromise: Promise<boolean> | null = null;

async function attemptRefresh(): Promise<boolean> {
  // Deduplicate concurrent refresh attempts
  if (_isRefreshing && _refreshPromise) {
    return _refreshPromise;
  }

  _isRefreshing = true;
  _refreshPromise = (async () => {
    try {
      const provider = getAuthProvider();
      const session = await provider.refreshSession();
      return session !== null;
    } catch {
      return false;
    } finally {
      _isRefreshing = false;
      _refreshPromise = null;
    }
  })();

  return _refreshPromise;
}

/**
 * Sentinel error thrown when auth fails (401 after refresh).
 * Callers can check `error.name === 'AuthFailureError'` to avoid showing
 * misleading UI messages like "Failed to load data" — the redirect to
 * login is already in progress.
 */
const AUTH_FAILURE_MESSAGE = 'Your session has expired. Please sign in again.';

// ── Redirect lock ──
// Prevents multiple concurrent 401 responses from each initiating a
// separate navigation. Once a redirect is in progress, subsequent
// calls are no-ops.
let _authRedirectInProgress = false;

function handleAuthFailure(): never {
  const currentHash = window.location.hash;
  const targetHash = '#/auth';

  console.log('[AUTH-REDIRECT]', {
    reason: '401 after refresh failed',
    currentHash,
    targetHash,
    redirectInProgress: _authRedirectInProgress,
  });

  // If a redirect is already in progress (another 401 fired first),
  // just throw — do NOT call logout() again or navigate again.
  if (_authRedirectInProgress) {
    console.log('[AUTH-REDIRECT] redirect already in progress — skipping duplicate');
    const err = new Error(AUTH_FAILURE_MESSAGE);
    err.name = 'AuthFailureError';
    throw err;
  }

  _authRedirectInProgress = true;

  // Clear auth state synchronously
  const { logout } = useAuthStore.getState();
  logout();

  // Redirect to login — safeNavigate() is idempotent (skips if already on #/auth)
  // and uses history.replaceState() in Electron to avoid full renderer reload.
  safeNavigate('/auth', 'handleAuthFailure:401');

  const err = new Error(AUTH_FAILURE_MESSAGE);
  err.name = 'AuthFailureError';
  throw err;
}

/**
 * Reset the redirect lock. Called after successful login so future 401s
 * can redirect again.
 */
export function resetAuthRedirectLock(): void {
  _authRedirectInProgress = false;
}

/** Check whether an error is a centralized auth failure (401 after refresh). */
export function isAuthFailureError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AuthFailureError';
}

/**
 * Centralized fetch wrapper for authenticated API calls.
 *
 * - Automatically attaches the Bearer token
 * - On 401: attempts token refresh, retries once
 * - On refresh failure: clears auth state, redirects to login
 * - Returns parsed JSON data (extracts `json.data`)
 */
export async function authFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  const url = `${API_URL}/v1${path}`;

  const doFetch = async (accessToken: string | null): Promise<Response> => {
    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...options?.headers,
      },
    });
  };

  // First attempt
  let res = await doFetch(token);

  // If 401, try to refresh the token
  if (res.status === 401) {
    const refreshSucceeded = await attemptRefresh();

    if (refreshSucceeded) {
      // Retry with the new token
      const newToken = localStorage.getItem(ACCESS_TOKEN_KEY);
      res = await doFetch(newToken);
    }

    // If still 401 after refresh attempt, or refresh failed
    if (res.status === 401) {
      handleAuthFailure();
    }
  }

  const json = await res.json();

  if (!json.success) {
    throw new Error(json.error || `HTTP ${res.status}`);
  }

  return json.data as T;
}
