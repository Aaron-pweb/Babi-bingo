import { Request, Response, NextFunction } from 'express';
import { logger } from '../logger'; // M5

/**
 * H6: Global Express error handler.
 * Must be registered LAST — after all routes.
 */
export function globalErrorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  logger.error({ err }, '[Error] Unhandled route error');
  res.status(500).json({ error: 'Internal server error' });
}
