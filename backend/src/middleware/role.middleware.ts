import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { ApiError } from '../utils/api-error';

type Role = 'super_admin' | 'admin' | 'support' | 'moderator' | 'user';

export const requireRole = (...roles: Role[]) => {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(ApiError.unauthorized('Authentication required'));
      return;
    }

    const user = req.user;
    // Normalize both user role and required roles to lowercase for comparison.
    // Database stores roles as lowercase ('admin', 'user').
    // JWT payload contains the database role directly.
    const userRole = user.role ? user.role.toLowerCase() : null;
    const normalizedRoles = roles.map(r => r.toLowerCase());

    if (!userRole || !normalizedRoles.includes(userRole as Role)) {
      next(ApiError.forbidden('Insufficient permissions'));
      return;
    }

    next();
  };
};

export const requireAdmin = requireRole('admin', 'super_admin');
export const requireSupport = requireRole('support', 'admin', 'super_admin');
export const requireModerator = requireRole('moderator', 'support', 'admin', 'super_admin');
export const requireAuthenticated = requireRole('user', 'moderator', 'support', 'admin', 'super_admin');
