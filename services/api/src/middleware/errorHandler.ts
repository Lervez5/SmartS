import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { ApiError, logger } from "../shared/logger";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  void _next;
  let status = 500;
  let message = "Internal server error";
  let details: unknown;

  if (err instanceof ApiError) {
    status = err.statusCode;
    message = err.message;
    details = err.details;
  } else if (err instanceof ZodError) {
    status = 400;
    message = "Validation error";
    details = err.flatten();
  } else if (err instanceof Error) {
    message = err.message || message;
  }

  logger.error({ event: "api_error", status, message, details });

  res.status(status).json({
    error: {
      message,
      details,
    },
  });
}
