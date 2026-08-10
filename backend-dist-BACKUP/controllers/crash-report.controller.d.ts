import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
export declare class CrashReportController {
    submitCrashReport(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getCrashReportHistory(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getCrashReportDetails(req: Request, res: Response, next: NextFunction): Promise<void>;
    updateCrashReportStatus(req: Request, res: Response, next: NextFunction): Promise<void>;
}
export declare const crashReportController: CrashReportController;
//# sourceMappingURL=crash-report.controller.d.ts.map