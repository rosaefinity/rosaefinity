import { Request, Response, NextFunction } from 'express';
export declare class UpdateController {
    checkForUpdate(req: Request, res: Response, next: NextFunction): Promise<void>;
    getLatestVersion(req: Request, res: Response, next: NextFunction): Promise<void>;
    getVersionHistory(req: Request, res: Response, next: NextFunction): Promise<void>;
}
export declare const updateController: UpdateController;
//# sourceMappingURL=update.controller.d.ts.map