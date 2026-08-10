import { Request, Response, NextFunction } from 'express';
export declare const rateLimiter: (req: Request, _res: Response, next: NextFunction) => Promise<void>;
export declare const strictRateLimiter: (req: Request, _res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=rate-limit.middleware.d.ts.map