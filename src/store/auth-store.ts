// =============================================
// RosaeFinity — Auth Store (Zustand)
// Provider-agnostic authentication state
// =============================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser, AuthSession, AccountType } from '../services/auth/types';
import { getAuthProvider, initAuthProvider, isAuthProviderInitialized } from '../services/auth/auth-factory';
import { sessionManager } from '../services/auth/session-manager';
import { BackendAuthProvider } from '../services/auth/providers/backend-provider';
import { resetAuthRedirectLock } from '../lib/auth-fetch';

// Initialize BackendAuthProvider if no provider registered yet.
if (!isAuthProviderInitialized()) {
  initAuthProvider(new BackendAuthProvider());
}

// Module-level guard to prevent double initialization in React StrictMode.
// The async nature of initialize() means the store's `initialized` flag isn't
// set until after the await, allowing a second call to slip through.
let _initRunning = false;

const ROLE_LEVEL: Record<AccountType, number> = { guest: 0, free: 1, pro: 2, admin: 3 };

interface AuthState {
  currentUser: AuthUser | null;
  session: AuthSession | null;
  isLoading: boolean;
  initialized: boolean;

  // Legacy compatibility
  user: AuthUser | null;
  isAuthenticated: boolean;

  // Auth actions
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { email: string; password: string; name?: string } | string, password?: string, displayName?: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithDiscord: () => Promise<void>;
  loginWithGitHub: () => Promise<void>;
  loginWithMicrosoft: () => Promise<void>;
  loginAsGuest: () => Promise<void>;
  logout: () => Promise<void>;

  // Session
  refreshSession: () => Promise<void>;
  restoreSession: () => Promise<void>;

  // Profile
  updateProfile: (updates: Partial<AuthUser>) => Promise<void>;
  setAccountType: (type: AccountType) => void;

  // Role checks
  hasRole: (role: AccountType) => boolean;
  canAccess: (requiredRole: AccountType) => boolean;

  // Legacy compatibility
  clearError: () => void;
  error: string | null;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      session: null,
      isLoading: true,
      initialized: false,

      // Legacy compatibility
      user: null,
      isAuthenticated: false,
      error: null,

      initialize: async () => {
        // Guard: if already initialized or initialization is in progress, skip.
        // The App useEffect re-runs when user?.id changes after session restore,
        // which would infinitely reset isLoading to true without this guard.
        // _initRunning is a module-level flag that prevents the StrictMode double-mount
        // from running initialize() concurrently before the async set({initialized:true}).
        if (get().initialized || _initRunning) {
          console.log('[AUTH-FLOW] initialize SKIP — already initialized or in progress');
          return;
        }
        _initRunning = true;
        console.log('[AUTH-FLOW] initialize START');
        console.log('[AUTH-TRACE] initialize called', { stack: new Error().stack?.split('\n').slice(1, 4).join(' | ') });
        set({ isLoading: true });
        try {
          // Try restore cached session
          const restored = await sessionManager.restoreSession();
          console.log('[AUTH-FLOW] cached session =', restored ? 'found' : 'none');
          if (restored) {
            set({
              currentUser: restored.user,
              session: restored,
              user: restored.user,
              isAuthenticated: true,
              isLoading: false,
              initialized: true,
            });
            console.log('[AUTH-FLOW] isLoading = false (session restored)');
          } else {
            // Clear any stale user from localStorage persist — session is gone
            set({
              currentUser: null,
              session: null,
              user: null,
              isAuthenticated: false,
              isLoading: false,
              initialized: true,
            });
            console.log('[AUTH-FLOW] isLoading = false (no session, cleared stale user)');
          }

          // Listen for route changes to catch tokens that expire while the user
          // is idle on a page. When navigating, if the access token is expired,
          // clear auth state immediately so RouteGuard redirects to login.
          // This is defense-in-depth — the primary handler is authFetch's 401 handler.
          //
          // We listen to BOTH hashchange (browser) and popstate (Electron, where
          // safeNavigate uses history.replaceState + PopStateEvent dispatch).
          const checkTokenExpiry = () => {
            const hash = window.location.hash;
            // Never logout on auth or root — would create an infinite loop
            if (hash === '#/auth' || hash === '#/' || hash === '' || hash === '#') {
              return;
            }
            const { currentUser, session } = get();
            if (currentUser && session?.accessToken) {
              const cached = sessionManager.getCachedSession();
              if (!cached || !cached.accessToken) return;
              try {
                const parts = cached.accessToken.split('.');
                if (parts.length !== 3) throw new Error('malformed');
                const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
                const payload = JSON.parse(decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')));
                if (typeof payload.exp === 'number' && Date.now() >= (payload.exp * 1000) - 30_000) {
                  console.log('[AUTH-FLOW] route-change: token expired, clearing auth');
                  get().logout();
                }
              } catch {
                console.log('[AUTH-FLOW] route-change: token unparseable, clearing auth');
                get().logout();
              }
            }
          };
          window.addEventListener('hashchange', checkTokenExpiry);
          window.addEventListener('popstate', checkTokenExpiry);

          // Listen for auth state changes (post-initialization only)
          // IMPORTANT: These callbacks MUST NOT set isLoading=true.
          // isLoading is managed exclusively by initialize()/login()/register()/logout().
          // Post-init auth changes only update user/session state.
          if (isAuthProviderInitialized()) {
            getAuthProvider().onAuthStateChange((session) => {
              // GUARD: Skip if state hasn't actually changed.
              // This prevents unnecessary Zustand set() calls that create new state
              // objects and trigger re-renders, which can cause infinite reload loops
              // when the page re-mounts (e.g., in StrictMode or Electron HMR).
              const current = get();
              if (session) {
                if (current.currentUser?.id === session.user.id && current.session?.accessToken === session.accessToken) {
                  return; // State unchanged — no re-render needed
                }
                console.log('[AUTH-FLOW] post-init auth change: session found');
                set({
                  currentUser: session.user,
                  session,
                  user: session.user,
                  isAuthenticated: true,
                });
                sessionManager.saveSession(session);
              } else {
                if (!current.currentUser && !current.session) {
                  return; // Already cleared — no re-render needed
                }
                console.log('[AUTH-FLOW] post-init auth change: session cleared');
                console.log('[AUTH-TRACE] onAuthStateChange clearing auth', { stack: new Error().stack?.split('\n').slice(1, 5).join(' | ') });
                set({
                  currentUser: null,
                  session: null,
                  user: null,
                  isAuthenticated: false,
                });
                sessionManager.clearSession();
              }
            });
          }
        } catch {
          console.log('[AUTH-FLOW] initialize ERROR — finishing gracefully');
          set({ isLoading: false, initialized: true });
        }
        _initRunning = false;
        console.log('[AUTH-FLOW] initialize COMPLETE');
      },

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const result = await getAuthProvider().signInWithEmail(email, password);
          if (!result.success) throw new Error(result.error);
          if (result.session) {
            set({
              currentUser: result.user!,
              session: result.session,
              user: result.user!,
              isAuthenticated: true,
              isLoading: false,
              initialized: true,
            });
            sessionManager.saveSession(result.session);
            resetAuthRedirectLock();
          }
        } catch (err: any) {
          set({ isLoading: false, error: err.message });
          throw err;
        }
      },

      register: async (emailOrInput, passwordArg, displayNameArg) => {
        // Support both object { email, password, name } and positional (email, password, displayName) signatures
        let email: string;
        let password: string;
        let displayName: string | undefined;
        if (typeof emailOrInput === 'object' && emailOrInput !== null) {
          email = emailOrInput.email;
          password = emailOrInput.password;
          displayName = emailOrInput.name;
        } else {
          email = String(emailOrInput ?? '');
          password = String(passwordArg ?? '');
          displayName = displayNameArg;
        }
        console.log("[REGISTER] auth-store.register() called", { email, displayName });
        set({ isLoading: true, error: null });
        try {
          const provider = getAuthProvider();
          console.log("[REGISTER] provider =", provider.constructor.name);
          const result = await provider.signUpWithEmail(email, password, displayName);
          console.log("[REGISTER] result =", result);
          if (!result.success) throw new Error(result.error);
          if (result.session) {
            set({
              currentUser: result.user!,
              session: result.session,
              user: result.user!,
              isAuthenticated: true,
              isLoading: false,
              initialized: true,
            });
            sessionManager.saveSession(result.session);
            resetAuthRedirectLock();
          }
        } catch (err: any) {
          set({ isLoading: false, error: err.message });
          throw err;
        }
      },

      loginWithGoogle: async () => {
        set({ isLoading: true, error: null });
        try {
          const r = await getAuthProvider().signInWithGoogle();
          if (!r.success) throw new Error(r.error);
          if (r.session) {
            set({
              currentUser: r.user!,
              session: r.session,
              user: r.user!,
              isAuthenticated: true,
              isLoading: false,
              initialized: true,
            });
            sessionManager.saveSession(r.session);
            resetAuthRedirectLock();
          }
        } catch (err: any) {
          set({ isLoading: false, error: err.message });
          throw err;
        }
      },

      loginWithDiscord: async () => {
        set({ isLoading: true, error: null });
        try {
          const r = await getAuthProvider().signInWithDiscord();
          if (!r.success) throw new Error(r.error);
          if (r.session) {
            set({
              currentUser: r.user!,
              session: r.session,
              user: r.user!,
              isAuthenticated: true,
              isLoading: false,
              initialized: true,
            });
            sessionManager.saveSession(r.session);
            resetAuthRedirectLock();
          }
        } catch (err: any) {
          set({ isLoading: false, error: err.message });
          throw err;
        }
      },

      loginWithGitHub: async () => {
        set({ isLoading: true, error: null });
        try {
          const r = await getAuthProvider().signInWithGitHub();
          if (!r.success) throw new Error(r.error);
          if (r.session) {
            set({
              currentUser: r.user!,
              session: r.session,
              user: r.user!,
              isAuthenticated: true,
              isLoading: false,
              initialized: true,
            });
            sessionManager.saveSession(r.session);
            resetAuthRedirectLock();
          }
        } catch (err: any) {
          set({ isLoading: false, error: err.message });
          throw err;
        }
      },

      loginWithMicrosoft: async () => {
        set({ isLoading: true, error: null });
        try {
          const r = await getAuthProvider().signInWithMicrosoft();
          if (!r.success) throw new Error(r.error);
          if (r.session) {
            set({
              currentUser: r.user!,
              session: r.session,
              user: r.user!,
              isAuthenticated: true,
              isLoading: false,
              initialized: true,
            });
            sessionManager.saveSession(r.session);
            resetAuthRedirectLock();
          }
        } catch (err: any) {
          set({ isLoading: false, error: err.message });
          throw err;
        }
      },

      loginAsGuest: async () => {
        set({ isLoading: true, error: null });
        try {
          const r = await getAuthProvider().signInAnonymously();
          if (!r.success) throw new Error(r.error);
          if (r.session) {
            set({
              currentUser: r.user!,
              session: r.session,
              user: r.user!,
              isAuthenticated: true,
              isLoading: false,
              initialized: true,
            });
            sessionManager.saveSession(r.session);
            resetAuthRedirectLock();
          }
        } catch (err: any) {
          set({ isLoading: false, error: err.message });
          throw err;
        }
      },

      logout: async () => {
        console.log('[AUTH-TRACE] logout CALLED', { stack: new Error().stack?.split('\n').slice(1, 5).join(' | ') });
        try {
          await getAuthProvider().signOut();
        } catch {
          // Ignore logout errors
        } finally {
          // Stop TTS for account isolation
          try {
            const { stopTTS } = await import('../services/tts');
            stopTTS();
            console.log('[LOGOUT] TTS stopped for account isolation');
          } catch (err) {
            console.error('[LOGOUT] Failed to stop TTS:', err);
          }

          // Capture userId BEFORE clearing auth state
          const loggedOutUserId = get().currentUser?.id;

          // ── Stop SyncEngine — prevents stale account sync from running ──
          try {
            const { resetSyncEngine } = await import('../services/sync/sync-engine');
            resetSyncEngine();
            console.log('[LOGOUT] SyncEngine reset for account isolation');
          } catch (err) {
            console.error('[LOGOUT] Failed to reset SyncEngine:', err);
          }

          // ── Clear Electron overlay runtime map ──
          try {
            const electronApi = api();
            if (electronApi?.syncOverlayInstances) {
              electronApi.syncOverlayInstances([]);
              console.log('[LOGOUT] Cleared Electron overlay map for account isolation');
            }
          } catch (err) {
            console.error('[LOGOUT] Failed to clear Electron overlay map:', err);
          }

          // ── Clear account-specific overlay/goal runtime localStorage ──
          try {
            const overlayKeys = [
              'rf_overlay_test',
              'rf_overlay_test_time',
              'rf_overlay_aspectRatio',
              'rf-goal-config',
              'rf-goals-runtime',
              'rf-coin-jar',
              'rf-overlay-favorites',
              'rf-overlay-active',
            ];
            for (const key of overlayKeys) {
              localStorage.removeItem(key);
            }
            console.log('[LOGOUT] Cleared overlay/goal runtime localStorage for account isolation');
          } catch (err) {
            console.error('[LOGOUT] Failed to clear overlay localStorage:', err);
          }

          // Clear local Dexie custom sounds to prevent cross-account leakage
          // Account B must never hydrate Account A's sounds
          try {
            const { db } = await import('../lib/db');
            await db.sounds.clear();
            console.log('[LOGOUT] Cleared Dexie sounds table for account isolation');
          } catch (err) {
            console.error('[LOGOUT] FAILED to clear Dexie sounds table:', err);
            // Log but do NOT block logout — authentication state must still be cleared
          }

          // Clear Electron points-system data (points-users.json) for account isolation
          // Account B must never hydrate Account A's points
          try {
            const a = api();
            if (a?.clearAllPoints) {
              const result = await a.clearAllPoints();
              if (result?.success) {
                console.log('[LOGOUT] Cleared Electron points-users.json for account isolation');
              } else {
                console.error('[LOGOUT] FAILED to clear Electron points-users.json:', result?.error);
              }
            }
          } catch (err) {
            console.error('[LOGOUT] FAILED to clear Electron points-users.json:', err);
            // Log but do NOT block logout — authentication state must still be cleared
          }

          // Clear account-owned app state to prevent cross-account leakage
          localStorage.removeItem('rf-app-storage');
          // Clear in-memory profile state so Account B never sees Account A's profiles
          import('./app-store').then(({ useAppStore }) => {
            useAppStore.getState().resetProfiles();
          }).catch(() => {});
          // Reset legacy goal tracker flag so goals reload for next account (F-001)
          import('../goals/goal-tracker').then(({ resetGoalsLoaded }) => {
            resetGoalsLoaded();
          }).catch(() => {});
          // Reset legacy goal store state so Account B starts empty (F-001)
          import('./goal-store').then(({ useGoalStore }) => {
            useGoalStore.setState({ goals: [], runtime: {}, loaded: false });
          }).catch(() => {});
          // Stop profile sync processor (queue items preserved for when user returns)
          import('../services/profile-sync-processor').then(({ profileSyncProcessor }) => {
            profileSyncProcessor.stop();
          }).catch(() => {});
          set({
            currentUser: null,
            session: null,
            user: null,
            isAuthenticated: false,
          });
          sessionManager.clearSession();
        }
      },

      refreshSession: async () => {
        const s = await sessionManager.refreshSession();
        if (s) set({ currentUser: s.user, session: s, user: s.user, isAuthenticated: true });
        else set({ currentUser: null, session: null, user: null, isAuthenticated: false });
      },

      restoreSession: async () => {
        // Use the validated restoreSession() which checks JWT expiry and refreshes.
        // Do NOT use getCachedSession() here — it bypasses token validation.
        const restored = await sessionManager.restoreSession();
        if (restored) {
          set({ currentUser: restored.user, session: restored, user: restored.user, isAuthenticated: true });
        } else {
          set({ currentUser: null, session: null, user: null, isAuthenticated: false });
        }
      },

      updateProfile: async (updates) => {
        const user = await getAuthProvider().updateProfile(updates);
        set({ currentUser: user, user });
      },

      setAccountType: (type) => {
        const u = get().currentUser;
        if (u) set({ currentUser: { ...u, accountType: type }, user: { ...u, accountType: type } });
      },

      hasRole: (role) => {
        const user = get().currentUser;
        if (!user) return false;
        return ROLE_LEVEL[user.accountType] >= ROLE_LEVEL[role];
      },

      canAccess: (requiredRole) => {
        return get().hasRole(requiredRole);
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'rf-auth-storage',
      partialize: (state) => ({
        currentUser: state.currentUser,
        user: state.user,
      }),
    }
  )
);

// Export the store instance for non-React contexts (e.g., overlay-store)
export const authStore = useAuthStore;
