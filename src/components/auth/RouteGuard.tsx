// =============================================
// RosaeFinity — Route Guard
// Role-based route protection
// =============================================

import { useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/auth-store';
import type { AccountType } from '../../services/auth/types';

// Admin users stay in same app, go to admin users page
const ADMIN_URL = '/admin/users';

interface RouteGuardProps {
  children: React.ReactNode;
  requiredRole?: AccountType;
  publicOnly?: boolean;
}

const ROLE_LEVEL: Record<AccountType, number> = { guest: 0, free: 1, pro: 2, admin: 3 };

export function RouteGuard({ children, requiredRole, publicOnly }: RouteGuardProps): JSX.Element {
  const { currentUser, isLoading, initialized } = useAuthStore();
  const location = useLocation();
  const prevRouteRef = useRef(window.location.hash);

  const currentHash = window.location.hash;
  const prevRoute = prevRouteRef.current;
  prevRouteRef.current = currentHash;

  // Determine what this guard will do (for diagnostics)
  let action = 'allow';
  let target: string | null = null;
  let reason = '';

  if (isLoading || !initialized) {
    action = 'spinner';
    reason = `isLoading=${isLoading} initialized=${initialized}`;
  } else if (publicOnly && currentUser) {
    action = 'redirect';
    target = currentUser.accountType === 'admin' ? ADMIN_URL : '/';
    reason = `publicOnly=true, user logged in, accountType=${currentUser.accountType}`;
  } else if (!publicOnly && !currentUser) {
    if (currentHash === '#/auth') {
      action = 'skip-redirect';
      reason = 'already on #/auth, returning null to break loop';
    } else {
      action = 'redirect';
      target = '/auth';
      reason = `protected route, no user (publicOnly=${!!publicOnly})`;
    }
  } else if (currentUser && currentUser.accountType === 'admin' && !requiredRole && location.pathname !== ADMIN_URL) {
    action = 'redirect';
    target = ADMIN_URL;
    reason = 'admin on non-admin route';
  } else if (requiredRole && currentUser) {
    const userLevel = ROLE_LEVEL[currentUser.accountType] ?? 0;
    const requiredLevel = ROLE_LEVEL[requiredRole] ?? 0;
    if (userLevel < requiredLevel) {
      action = 'redirect';
      target = '/';
      reason = `role gate: user=${currentUser.accountType}(${userLevel}) < required=${requiredRole}(${requiredLevel})`;
    }
  }

  console.log('[ROUTE-AUTH]', {
    from: prevRoute,
    to: currentHash,
    pathname: location.pathname,
    hasUser: !!currentUser,
    isLoading,
    initialized,
    publicOnly: !!publicOnly,
    action,
    target,
    reason,
  });

  // Loading spinner
  if (isLoading || !initialized) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0a0f]">
        <div className="w-6 h-6 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  // Public-only (auth page) — redirect if logged in
  if (publicOnly && currentUser) {
    // Admin users go to admin dashboard, regular users go to app
    if (currentUser.accountType === 'admin') {
      return <Navigate to={ADMIN_URL} replace />;
    }
    return <Navigate to="/" replace />;
  }

  // Auth required — redirect to login
  // In Electron, Navigate triggers an in-page history.replaceState (NOT a full
  // renderer reload). The old approach of setting window.location.hash directly
  // caused full cross-document navigations (did-start-loading → renderer
  // remount). React Router v7's HashRouter uses history.replaceState, which is
  // safe. We also guard against navigating to the same hash to prevent any
  // possibility of a loop.
  if (!publicOnly && !currentUser) {
    if (currentHash === '#/auth') {
      // Already on auth page — return null to prevent any re-render loop
      console.log('[ROUTE-AUTH] SKIP redirect — already on #/auth');
      return null;
    }
    console.log('[ROUTE-AUTH] redirect → /auth');
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Admin users should not access user routes - redirect to admin dashboard
  // (but skip if already on the admin page to prevent infinite redirect)
  if (currentUser && currentUser.accountType === 'admin' && !requiredRole && location.pathname !== ADMIN_URL) {
    return <Navigate to={ADMIN_URL} replace />;
  }

  // Role gate
  if (requiredRole && currentUser) {
    const userLevel = ROLE_LEVEL[currentUser.accountType] ?? 0;
    const requiredLevel = ROLE_LEVEL[requiredRole] ?? 0;
    if (userLevel < requiredLevel) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}
