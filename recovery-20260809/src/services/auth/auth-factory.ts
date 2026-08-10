// =============================================
// RosaeFinity â€” Auth Provider Factory
// Allows swapping providers without changing app code
// =============================================

import type { AuthProvider } from './types';

let currentProvider: AuthProvider | null = null;

export function initAuthProvider(provider: AuthProvider): AuthProvider {
  currentProvider = provider;
  return currentProvider;
}

export function getAuthProvider(): AuthProvider {
  console.log("[AUTH-FACTORY] getAuthProvider() called, currentProvider =", currentProvider?.constructor.name ?? "null");
  if (!currentProvider) {
    throw new Error('AuthProvider not initialized. Call initAuthProvider() first.');
  }
  return currentProvider;
}

export function isAuthProviderInitialized(): boolean {
  return currentProvider !== null;
}
