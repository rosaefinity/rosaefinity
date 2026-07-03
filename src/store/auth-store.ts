import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, LoginCredentials, RegisterData } from "../types";

interface AuthStore {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

function getApi() {
  return (window as any).electronAPI;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (credentials: LoginCredentials) => {
        set({ isLoading: true, error: null });
        const a = getApi();
        try {
          // Try Electron backend first
          if (a) {
            const result = await a.authLogin({
              email: credentials.email,
              password: credentials.password,
              rememberMe: credentials.rememberMe ?? true,
            });
            if (result?.success === false) {
              // Fall back to demo check
              if (credentials.email === "demo@rosaefinity.app" && credentials.password === "demo123") {
                const user: User = {
                  id: "usr_demo", email: credentials.email, name: "Demo User",
                  provider: "email", plan: "pro",
                  createdAt: new Date().toISOString(), lastLogin: new Date().toISOString(),
                };
                set({ user, token: "rf_demo_token", isAuthenticated: true, isLoading: false });
              } else {
                set({ isLoading: false, error: result.error || "Email atau password salah" });
              }
              return;
            }
            // Backend login succeeded
            const userData = await a.authCurrentUser();
            const user: User = {
              id: userData?.id || "usr_" + Date.now(),
              email: userData?.email || credentials.email,
              name: userData?.name || credentials.email.split("@")[0],
              provider: "email",
              plan: "free",
              createdAt: userData?.createdAt || new Date().toISOString(),
              lastLogin: new Date().toISOString(),
            };
            set({ user, token: "rf_token_" + Date.now(), isAuthenticated: true, isLoading: false });
            return;
          }

          // No Electron — browser-only fallback
          await new Promise((r) => setTimeout(r, 800));
          if (credentials.email === "demo@rosaefinity.app" && credentials.password === "demo123") {
            const user: User = {
              id: "usr_demo", email: credentials.email, name: "Demo User",
              provider: "email", plan: "pro",
              createdAt: new Date().toISOString(), lastLogin: new Date().toISOString(),
            };
            set({ user, token: "rf_demo_token_" + Date.now(), isAuthenticated: true, isLoading: false });
          } else {
            const stored = localStorage.getItem("rf_users");
            const users: Record<string, { name: string; password: string }> = stored ? JSON.parse(stored) : {};
            const found = Object.entries(users).find(
              ([email, data]) => email === credentials.email && data.password === credentials.password
            );
            if (found) {
              const [email, data] = found;
              const user: User = {
                id: "usr_" + Math.random().toString(36).substring(2, 10),
                email, name: data.name, provider: "email", plan: "free",
                createdAt: new Date().toISOString(), lastLogin: new Date().toISOString(),
              };
              set({ user, token: "rf_token_" + Date.now(), isAuthenticated: true, isLoading: false });
            } else {
              set({ isLoading: false, error: "Email atau password salah" });
            }
          }
        } catch {
          set({ isLoading: false, error: "Terjadi kesalahan. Coba lagi." });
        }
      },

      loginWithGoogle: async () => {
        set({ isLoading: true, error: null });
        const a = getApi();
        try {
          if (a) {
            const result = await a.authGoogle({
              id: "google_" + Date.now(),
              email: "user.google." + Date.now() + "@gmail.com",
              name: "Google User",
              picture: "https://api.dicebear.com/9.x/avataaars/svg?seed=Google",
              accessToken: "mock_token_" + Date.now(),
            });
            if (result?.success === false) {
              set({ isLoading: false, error: "Google login gagal." });
              return;
            }
          }
          await new Promise((r) => setTimeout(r, 600));
          const user: User = {
            id: "usr_" + Math.random().toString(36).substring(2, 10),
            email: "user.google." + Date.now() + "@gmail.com",
            name: "Google User",
            avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=Google",
            provider: "google", plan: "free",
            createdAt: new Date().toISOString(), lastLogin: new Date().toISOString(),
          };
          set({ user, token: "rf_google_token_" + Date.now(), isAuthenticated: true, isLoading: false });
        } catch {
          set({ isLoading: false, error: "Google login gagal. Coba lagi." });
        }
      },

      register: async (data: RegisterData) => {
        set({ isLoading: true, error: null });
        const a = getApi();
        try {
          if (a) {
            const result = await a.authRegister({ email: data.email, password: data.password, name: data.name });
            if (result?.success === false) {
              set({ isLoading: false, error: result.error || "Registrasi gagal." });
              return;
            }
            const userData = await a.authCurrentUser();
            const user: User = {
              id: userData?.id || "usr_" + Date.now(),
              email: data.email, name: data.name, provider: "email", plan: "free",
              createdAt: new Date().toISOString(), lastLogin: new Date().toISOString(),
            };
            set({ user, token: "rf_token_" + Date.now(), isAuthenticated: true, isLoading: false });
            return;
          }

          // Browser-only fallback
          await new Promise((r) => setTimeout(r, 800));
          const stored = localStorage.getItem("rf_users");
          const users: Record<string, { name: string; password: string }> = stored ? JSON.parse(stored) : {};
          if (users[data.email]) {
            set({ isLoading: false, error: "Email sudah terdaftar" });
            return;
          }
          users[data.email] = { name: data.name, password: data.password };
          localStorage.setItem("rf_users", JSON.stringify(users));
          const user: User = {
            id: "usr_" + Math.random().toString(36).substring(2, 10),
            email: data.email, name: data.name, provider: "email", plan: "free",
            createdAt: new Date().toISOString(), lastLogin: new Date().toISOString(),
          };
          set({ user, token: "rf_token_" + Date.now(), isAuthenticated: true, isLoading: false });
        } catch {
          set({ isLoading: false, error: "Registrasi gagal. Coba lagi." });
        }
      },

      logout: () => {
        const a = getApi();
        if (a) a.authLogout().catch(() => {});
        set({ user: null, token: null, isAuthenticated: false, error: null });
      },

      clearError: () => set({ error: null }),
    }),
    { name: "rf-auth-storage" }
  )
);
