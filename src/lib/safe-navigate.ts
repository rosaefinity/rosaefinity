// =============================================
// RosaeFinity — Safe Navigation Utility
// In Electron, window.location.hash = '...' triggers a FULL cross-document
// navigation (did-start-loading → did-navigate → renderer remount), unlike
// browsers where it's an in-page change. This utility uses
// history.replaceState() + popstate dispatch so the URL changes in-page
// without causing a full renderer reload.
//
// In browser mode, window.location.hash works fine, so we use it there.
// =============================================

import { isElectron } from '../services/electron-service';

let _lastHash = '';

/**
 * Navigate to a hash route without triggering a full renderer reload in Electron.
 *
 * Uses history.replaceState() + popstate event dispatch instead of
 * window.location.hash assignment. React Router v7's HashRouter listens to
 * popstate events (not hashchange) to detect URL changes.
 *
 * @param hash - The hash path (e.g., '/auth', '/dashboard')
 * @param reason - Why the navigation is happening (for diagnostic logging)
 * @param replace - If true (default), replaces current history entry
 */
export function safeNavigate(hash: string, reason = 'unknown', replace = true): void {
  const targetHash = hash.startsWith('#') ? hash : '#' + hash;
  const currentHash = window.location.hash;
  const alreadyAtTarget = currentHash === targetHash;

  console.log('[SAFE-NAVIGATE]', {
    from: currentHash,
    to: targetHash,
    reason,
    alreadyAtTarget,
    skipped: alreadyAtTarget,
  });

  // Idempotent: skip if already on the target route
  if (alreadyAtTarget) {
    return;
  }

  if (isElectron()) {
    // In Electron: use history.replaceState() to change URL in-page
    // without triggering did-start-loading / did-navigate (full reload).
    try {
      if (replace) {
        window.history.replaceState(window.history.state, '', targetHash);
      } else {
        window.history.pushState(
          { usr: null, key: Math.random().toString(36).substring(2, 10), idx: (window.history.state?.idx ?? -1) + 1 },
          '',
          targetHash,
        );
      }
    } catch (err) {
      console.warn('[SAFE-NAVIGATE] replaceState/pushState failed, falling back:', err);
      // Last resort fallback — may cause full reload in Electron
      window.location.hash = hash;
      return;
    }

    // Dispatch popstate so React Router detects the URL change.
    // React Router v7's HashRouter listens to 'popstate' (not 'hashchange').
    window.dispatchEvent(new PopStateEvent('popstate', {
      state: window.history.state,
    }));
  } else {
    // Browser mode: window.location.hash works fine (in-page change)
    window.location.hash = hash;
  }

  _lastHash = targetHash;
}

/**
 * Get the last hash we navigated to (for diagnostic purposes).
 */
export function getLastNavigationTarget(): string {
  return _lastHash;
}
