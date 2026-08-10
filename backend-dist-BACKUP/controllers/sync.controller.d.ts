import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
export declare class SyncController {
    getSyncMetadata(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    pullUpdates(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    pushUpdates(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    resolveConflict(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
}
export declare const syncController: SyncController;
//# sourceMappingURL=sync.controller.d.ts.map