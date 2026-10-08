import { NextFunction, Request, Response } from 'express';
import type { AuthUser } from './auth';
import type { Permission } from '@schoolos/auth/permissions';

export function requirePermissions(
  ...allowed: Permission[]
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as AuthUser | undefined;
    if (!user) {
      res.status(401).json({ error: { message: 'Authentication required' } });
      return;
    }

    const userPermissions: Permission[] = user.permissions;
    const hasPermission = allowed.some((p) => userPermissions.includes(p));

    if (!hasPermission) {
      res.status(403).json({ error: { message: 'Forbidden: insufficient permissions' } });
      return;
    }

    next();
  };
}

export function requireRole(
  ...allowed: string[]
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !allowed.includes(req.user.role)) {
      res.status(403).json({ error: { message: 'Forbidden' } });
      return;
    }
    next();
  };
}

export function getRequiredRole(roles: string | string[]): string[] {
  return Array.isArray(roles) ? roles : [roles];
}
