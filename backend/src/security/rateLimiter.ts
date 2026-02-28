import { NextFunction, Request, Response } from "express";
import { RateLimiterMemory } from "rate-limiter-flexible";

const generalLimiter = new RateLimiterMemory({
  points: 100,
  duration: 60,
});

const roleLimited = new RateLimiterMemory({
  points: 60,
  duration: 60,
});

export async function rateLimiterMiddleware(req: Request, res: Response, next: NextFunction) {
  const key = req.ip;
  try {
    await generalLimiter.consume(key);
  } catch {
    return res.status(429).json({ error: { message: "Too many requests" } });
  }

  const role = (req.user && req.user.role) || "anonymous";
  const roleKey = `${role}:${key}`;
  const perRoleLimit = role === "admin" ? 120 : role === "parent" ? 80 : role === "student" ? 100 : 60;
  roleLimited.points = perRoleLimit;

  try {
    await roleLimited.consume(roleKey);
  } catch {
    return res.status(429).json({ error: { message: "Too many requests for role" } });
  }

  next();
}


