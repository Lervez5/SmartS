import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

import { logger } from '../shared/logger';

/**
 * Request budgets.
 *
 * A small budget is too tight in practice: one admin page load fans out into a
 * dozen parallel calls, several users behind one NAT share an IP, and in
 * development all four apps plus the test suite originate from localhost.
 * The general budget is therefore 600/min, with per-role allowances on top.
 * RATE_LIMIT_SCALE multiplies everything for load or integration runs.
 */
const scale = Number(process.env.RATE_LIMIT_SCALE || 1);
const ceiling = (n: number) => Math.max(1, Math.round(n * scale));

const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: ceiling(600),
  standardHeaders: true,
  legacyHeaders: true,
  handler: (_req: Request, res: Response) => {
    logger.warn('Rate limit exceeded', { event: 'rate_limit', ip: _req.ip });
    res.status(429).json({ error: { message: 'Too many requests' } });
  },
});

/**
 * Per-role budgets. Roles are the canonical ones from @schoolos/auth, so
 * SUPER_ADMIN gets the largest allowance and anonymous the smallest.
 */
const ROLE_BUDGET: Record<string, number> = {
  SUPER_ADMIN: 120,
  DEAN: 110,
  ACCOUNTANT: 110,
  TEACHER: 100,
  STUDENT: 100,
  PARENT: 80,
  anonymous: 60,
};

const roleLimited = rateLimit({
  windowMs: 60 * 1000,
  max: (req: Request) => ceiling(ROLE_BUDGET[req.user?.role || 'anonymous'] ?? 60),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    logger.warn('Role-based rate limit exceeded', {
      event: 'rate_limit_role',
      ip: _req.ip,
      role: _req.user?.role,
    });
    res.status(429).json({ error: { message: 'Too many requests for role' } });
  },
});

export { generalLimiter, roleLimited };

export const rateLimiterMiddleware = generalLimiter;
