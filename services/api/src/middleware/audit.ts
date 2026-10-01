import { NextFunction, Request, Response } from 'express';
import { logger } from '../shared/logger';

export function auditMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      event: 'http_access',
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: duration,
      userId: req.user?.id || 'anonymous',
      role: req.user?.role || 'anonymous',
    });
  });

  next();
}
