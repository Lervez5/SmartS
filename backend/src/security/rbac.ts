import { NextFunction, Request, Response } from "express";

export type Role = "admin" | "parent" | "student" | "staff";

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUser;
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


