import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('[Error]', err.message);
  res.status(500).json({
    success: false,
    data: null,
    error: err.message || 'Internal Server Error',
  });
}
