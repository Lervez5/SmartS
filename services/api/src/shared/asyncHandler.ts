import { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Forwards rejected promises from async handlers to the error middleware.
 *
 * Express 4 does not catch async rejections: a bare `async (req, res)` route
 * that throws produces an unhandled rejection and takes the process down. Every
 * async route in this service must be wrapped in this.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
