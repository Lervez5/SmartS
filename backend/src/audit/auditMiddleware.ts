import { NextFunction, Request, Response } from "express";
import { logger } from "../shared/logger";

export function requestAuditMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const userId = req.user?.id || "anonymous";
  const role = req.user?.role || "anonymous";

  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info({
      event: "http_access",
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: duration,
      userId,
      role,
    });
  });

  next();
}


