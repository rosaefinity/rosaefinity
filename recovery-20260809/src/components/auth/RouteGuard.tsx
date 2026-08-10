// =============================================
// RosaeFinity â€” Route Guard
// Role-based route protection
// =============================================

import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/auth-store';
import type { AccountType } from '@/services/auth/types';
import { Loader2 } from 'lucide-react';

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

  // Loading spinner
  if (isLoading || !initialized) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0a0f]">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  // Public-only (auth page) â†’ redirect if logged in
  if (publicOnly && currentUser) {
    // Admin users go to admin dashboard, regular users go to app
    if (currentUser.accountType === 'admin') {
      window.location.href = ADMIN_URL;
      return (
        <div className="flex items-center justify-center h-screen bg-[#0a0a0f]">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        </div>
      );
    }
    return <Navigate to="/" replace />;
  }

  // Auth required â†’ redirect to login
  if (!publicOnly && !currentUser) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Admin users should not access user routes - redirect to admin dashboard
  // (but skip if already on the admin page to prevent infinite redirect)
  if (currentUser && currentUser.accountType === 'admin' && !requiredRole && location.pathname !== ADMIN_URL) {
    window.location.href = ADMIN_URL;
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0a0f]">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
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
