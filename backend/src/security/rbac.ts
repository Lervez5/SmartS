import { NextFunction, Request, Response } from "express";

export type Role = "super_admin" | "school_admin" | "teacher" | "parent" | "student";

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  name?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function requireRole(allowed: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !allowed.includes(req.user.role)) {
      return res.status(403).json({ error: { message: "Forbidden" } });
    }
    next();
  };
}


