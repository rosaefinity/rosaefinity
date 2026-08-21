// =============================================
// RosaeFinity — Route Guard
// Role-based route protection
// =============================================

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

  console.log('[ROUTE-AUTH]', {
    pathname: location.pathname,
    hasUser: !!currentUser,
    isLoading,
    initialized,
    publicOnly: !!publicOnly,
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
  if (!publicOnly && !currentUser) {
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
