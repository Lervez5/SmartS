import rateLimit from "express-rate-limit";
import { Request, Response } from "express";
import { logger } from "../shared/logger";

const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: true,
  handler: (_req: Request, res: Response) => {
    logger.warn("Rate limit exceeded", { event: "rate_limit", ip: _req.ip });
    res.status(429).json({ error: { message: "Too many requests" } });
  },
});

const roleLimited = rateLimit({
  windowMs: 60 * 1000,
  max: (req: Request) => {
    const role = req.user?.role || "anonymous";
    if (role === "super_admin" || role === "school_admin") return 120;
    if (role === "teacher") return 100;
    if (role === "parent") return 80;
    if (role === "student") return 100;
    return 60;
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    logger.warn("Role-based rate limit exceeded", { event: "rate_limit_role", ip: _req.ip, role: _req.user?.role });
    res.status(429).json({ error: { message: "Too many requests for role" } });
  },
});

export { generalLimiter, roleLimited };

export const rateLimiterMiddleware = generalLimiter;
