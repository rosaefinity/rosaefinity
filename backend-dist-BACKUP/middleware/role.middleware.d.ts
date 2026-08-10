import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
type Role = 'SUPER_ADMIN' | 'ADMIN' | 'SUPPORT' | 'MODERATOR' | 'USER';
export declare const requireRole: (...roles: Role[]) => (req: AuthRequest, _res: Response, next: NextFunction) => void;
export declare const requireAdmin: (req: AuthRequest, _res: Response, next: NextFunction) => void;
export declare const requireSupport: (req: AuthRequest, _res: Response, next: NextFunction) => void;
export declare const requireModerator: (req: AuthRequest, _res: Response, next: NextFunction) => void;
export declare const requireAuthenticated: (req: AuthRequest, _res: Response, next: NextFunction) => void;
export {};
//# sourceMappingURL=role.middleware.d.ts.map