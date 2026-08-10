import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
export declare class FeatureFlagController {
    getFeatures(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getAllFeatures(_req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
}
export declare const featureFlagController: FeatureFlagController;
//# sourceMappingURL=feature-flag.controller.d.ts.map