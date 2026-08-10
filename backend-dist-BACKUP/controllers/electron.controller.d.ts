import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
export declare class ElectronController {
    login(req: Request, res: Response, next: NextFunction): Promise<void>;
    refreshToken(req: Request, res: Response, next: NextFunction): Promise<void>;
    validateToken(req: Request, res: Response, next: NextFunction): Promise<void>;
    logout(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
}
export declare const electronController: ElectronController;
//# sourceMappingURL=electron.controller.d.ts.map