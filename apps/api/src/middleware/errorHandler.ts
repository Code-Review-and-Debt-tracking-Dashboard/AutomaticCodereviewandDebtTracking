import type { NextFunction, Request, Response } from 'express';

import { logger } from '../lib/logger';

/**
 * Structured error for known failure cases. Controllers/middleware throw
 * this (or call next(new AppError(...))) to get the standard error response
 * shape defined in api_design.md section 10.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown[];

  constructor(statusCode: number, code: string, message: string, details?: unknown[]) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

/**
 * Catches any request that didn't match a route. Must be registered after
 * all routes and before errorHandler.
 */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new AppError(404, 'NOT_FOUND', `Route ${req.method} ${req.path} not found`));
}

/**
 * Final error-handling middleware (Express recognizes it by its 4 params).
 * Must be registered last, after all other app.use()/routes.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  // Unexpected error — never leak internals (stack trace, message) to the client.
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
}
