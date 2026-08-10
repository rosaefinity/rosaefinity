// =============================================
// RosaeFinity Server — Error Handler Middleware
// Catches all errors, sanitizes, returns structured response.
// =============================================

import type { Request, Response, NextFunction } from 'express';
import type { ApiResponse } from '../../types/index.js';

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR',
    public isOperational = true,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, code = 'BAD_REQUEST') {
    super(message, 400, code);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', code = 'UNAUTHORIZED') {
    super(message, 401, code);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', code = 'FORBIDDEN') {
    super(message, 403, code);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found', code = 'NOT_FOUND') {
    super(message, 404, code);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code = 'CONFLICT') {
    super(message, 409, code);
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429, 'RATE_LIMITED');
  }
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  const requestId = (req as any).requestId;

  if (err instanceof AppError && err.isOperational) {
    const response: ApiResponse = {
      success: false,
      error: err.message,
      code: err.code,
      requestId,
    };
    res.status(err.statusCode).json(response);
    return;
  }

  // Unknown error — log and sanitize
  console.error(`[ERROR] ${requestId} ${err.message}`, err.stack);

  const response: ApiResponse = {
    success: false,
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    requestId,
  };
  res.status(500).json(response);
}
