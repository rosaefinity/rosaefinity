// =============================================
// RosaeFinity — Auth Service Types
// =============================================

export type AccountType = 'guest' | 'free' | 'pro' | 'admin';

export type AuthProviderType =
  | 'email'
  | 'google'
  | 'discord'
  | 'github'
  | 'microsoft'
  | 'magiclink'
  | 'anonymous';

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  provider: string;
  accountType: AccountType;
  subscriptionStatus: string;
  licenseStatus: string;
  isAnonymous: boolean;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  isOffline: boolean;
}

export interface AuthResult {
  success: boolean;
  user?: AuthUser;
  session?: AuthSession;
  error?: string;
}

export interface AuthProvider {
  name: string;
  signInWithEmail(email: string, password: string): Promise<AuthResult>;
  signUpWithEmail(email: string, password: string, displayName?: string): Promise<AuthResult>;
  signInWithGoogle(): Promise<AuthResult>;
  signInWithDiscord(): Promise<AuthResult>;
  signInWithGitHub(): Promise<AuthResult>;
  signInWithMicrosoft(): Promise<AuthResult>;
  signInWithMagicLink(email: string): Promise<AuthResult>;
  signInAnonymously(): Promise<AuthResult>;
  signOut(): Promise<void>;
  refreshSession(): Promise<AuthSession | null>;
  getCurrentSession(): Promise<AuthSession | null>;
  resetPassword(email: string): Promise<void>;
  updatePassword(newPassword: string): Promise<void>;
  verifyEmail(token: string): Promise<AuthResult>;
  resendVerification(email: string): Promise<void>;
  updateProfile(updates: Partial<AuthUser>): Promise<AuthUser>;
  onAuthStateChange(callback: (session: AuthSession | null) => void): () => void;
  supportsOffline(): boolean;
  supportsProvider(provider: AuthProviderType): boolean;
}
