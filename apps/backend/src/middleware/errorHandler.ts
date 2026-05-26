import { Request, Response, NextFunction } from 'express';

/**
 * H6: Global Express error handler.
 * Must be registered LAST — after all routes.
 * Catches any error passed via next(err) or thrown in async handlers.
 */
export function globalErrorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  console.error('[Error]', err.stack ?? err.message);
  res.status(500).json({ error: 'Internal server error' });
}
