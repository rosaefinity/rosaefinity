import { Request, Response } from 'express';
export declare class HealthController {
    health(_req: Request, res: Response): Promise<void>;
    version(_req: Request, res: Response): Promise<void>;
    status(_req: Request, res: Response): Promise<void>;
}
export declare const healthController: HealthController;
//# sourceMappingURL=health.controller.d.ts.map