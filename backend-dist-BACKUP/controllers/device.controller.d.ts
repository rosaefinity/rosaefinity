import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
export declare class DeviceController {
    registerDevice(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    listDevices(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    removeDevice(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    validateDevice(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
}
export declare const deviceController: DeviceController;
//# sourceMappingURL=device.controller.d.ts.map