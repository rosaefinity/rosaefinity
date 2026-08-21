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
  register: (email: string, password: string, displayName?: string) => Promise<void>;
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
          }
        } catch (err: any) {
          set({ isLoading: false, error: err.message });
          throw err;
        }
      },

      register: async (email, password, displayName) => {
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
        const cached = sessionManager.getCachedSession();
        if (cached) set({ currentUser: cached.user, session: cached, user: cached.user, isAuthenticated: true });
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
