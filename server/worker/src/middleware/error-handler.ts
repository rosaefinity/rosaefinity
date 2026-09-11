// =============================================
// RosaeFinity Worker — Error Handler
// Structured JSON errors matching Express backend
// =============================================

import type { Context } from 'hono';
import { ZodError } from 'zod';
import type { ApiResponse } from '../types.js';

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

/**
 * Global error handler for Hono.
 * Returns structured JSON errors matching the Express backend format.
 */
export function errorHandler(err: Error, c: Context) {
  const requestId = c.get('requestId') as string | undefined;

  // Zod validation errors → 400
  if (err instanceof ZodError) {
    const messages = err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    const response: ApiResponse = {
      success: false,
      error: messages || 'Validation error',
      code: 'VALIDATION_ERROR',
      requestId,
    };
    return c.json(response, 400);
  }

  if (err instanceof AppError && err.isOperational) {
    const response: ApiResponse = {
      success: false,
      error: err.message,
      code: err.code,
      requestId,
    };
    return c.json(response, err.statusCode as 400);
  }

  // Unknown error — log and sanitize
  console.error(`[ERROR] ${requestId} ${err.message}`, err.stack);

  const response: ApiResponse = {
    success: false,
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    requestId,
  };
  return c.json(response, 500);
}
