import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
export declare class LicenseController {
    activateLicense(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    deactivateLicense(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    checkLicense(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
}
export declare const licenseController: LicenseController;
//# sourceMappingURL=license.controller.d.ts.map