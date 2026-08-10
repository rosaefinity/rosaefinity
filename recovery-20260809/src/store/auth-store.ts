// =============================================
// RosaeFinity â€” Auth Store (Zustand)
// Provider-agnostic authentication state
// =============================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser, AuthSession, AccountType } from '@/services/auth/types';
import { getAuthProvider, initAuthProvider, isAuthProviderInitialized } from '@/services/auth/auth-factory';
import { sessionManager } from '@/services/auth/session-manager';
import { BackendAuthProvider } from '@/services/auth/providers/backend-provider';

// Initialize BackendAuthProvider if no provider registered yet.
if (!isAuthProviderInitialized()) {
  initAuthProvider(new BackendAuthProvider());
}

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
        console.log('[AUTH-FLOW] initialize START');
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
            set({ isLoading: false, initialized: true });
            console.log('[AUTH-FLOW] isLoading = false (no session)');
          }

          // Listen for auth state changes (post-initialization only)
          // IMPORTANT: These callbacks MUST NOT set isLoading=true.
          // isLoading is managed exclusively by initialize()/login()/register()/logout().
          // Post-init auth changes only update user/session state.
          if (isAuthProviderInitialized()) {
            getAuthProvider().onAuthStateChange((session) => {
              console.log('[AUTH-FLOW] post-init auth change');
              if (session) {
                set({
                  currentUser: session.user,
                  session,
                  user: session.user,
                  isAuthenticated: true,
                });
                sessionManager.saveSession(session);
                console.log('[AUTH-FLOW] isLoading remains false (session updated)');
              } else {
                set({
                  currentUser: null,
                  session: null,
                  user: null,
                  isAuthenticated: false,
                });
                sessionManager.clearSession();
                console.log('[AUTH-FLOW] isLoading remains false (session cleared)');
              }
            });
          }
        } catch {
          console.log('[AUTH-FLOW] initialize ERROR â€” finishing gracefully');
          set({ isLoading: false, initialized: true });
        }
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
