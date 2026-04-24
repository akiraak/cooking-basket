import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const reqLogger = (req as Request & { log?: typeof logger }).log ?? logger;
  reqLogger.error({ err }, err.message || 'Internal Server Error');
  res.status(500).json({
    success: false,
    data: null,
    error: err.message || 'Internal Server Error',
  });
}
