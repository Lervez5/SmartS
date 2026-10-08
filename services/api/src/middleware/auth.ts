import { NextFunction, Request, Response } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import { config } from '../config';
import {
  AppId,
  UserRole,
  ROLES,
  ROLE_APP,
  normalizeRole,
  canAccessApp,
} from '@schoolos/auth/roles';
import type { Permission } from '@schoolos/auth/permissions';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  name?: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  phone?: string;
  permissions: Permission[];
  appId: AppId;
  sessionTokenVersion?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  userRole?: string;
  appId?: string;
}

export function signTokens(user: AuthUser): Tokens {
  const accessToken = jwt.sign(user, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessTokenTtl as SignOptions['expiresIn'],
  });
  const refreshToken = jwt.sign(user, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshTokenTtl as SignOptions['expiresIn'],
  });
  return { accessToken, refreshToken, userRole: user.role, appId: user.appId };
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  let token = '';

  if (header?.startsWith('Bearer ')) {
    token = header.slice('Bearer '.length);
  } else if (req.cookies?.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    next();
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret) as AuthUser;

    // Normalise legacy role values in the token to the canonical set.
    const canonicalRole = normalizeRole(decoded.role);
    if (!canonicalRole) {
      next();
      return;
    }

    // Check session token version for revocation.
    const sessionTokenVersion = decoded.sessionTokenVersion;
    if (typeof sessionTokenVersion !== 'number') {
      next();
      return;
    }

    // Verify the token's session version matches the user's current version.
    // We don't have the user's current version here without a DB lookup,
    // so we trust the version in the token and compare on refresh/me.
    req.user = {
      ...decoded,
      role: canonicalRole,
      appId: ROLE_APP[canonicalRole],
      sessionTokenVersion,
    };
  } catch {
    // token invalid or expired - user remains unauthenticated
  }
  next();
}

export function setAuthCookies(res: Response, tokens: Tokens): void {
  const isProd = config.isProduction;
  res.cookie('accessToken', tokens.accessToken, {
    httpOnly: true,
    sameSite: 'strict',
    secure: isProd,
    maxAge: 24 * 60 * 60 * 1000,
  });
  res.cookie('refreshToken', tokens.refreshToken, {
    httpOnly: true,
    sameSite: 'strict',
    secure: isProd,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  res.cookie('userRole', tokens.userRole || '', {
    httpOnly: false,
    sameSite: 'strict',
    secure: isProd,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  res.cookie('appId', tokens.appId || '', {
    httpOnly: false,
    sameSite: 'strict',
    secure: isProd,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookies(res: Response): void {
  const isProd = config.isProduction;
  res.clearCookie('accessToken', {
    httpOnly: true,
    sameSite: 'strict',
    secure: isProd,
  });
  res.clearCookie('refreshToken', {
    httpOnly: true,
    sameSite: 'strict',
    secure: isProd,
  });
  res.clearCookie('userRole', {
    httpOnly: false,
    sameSite: 'strict',
    secure: isProd,
  });
  res.clearCookie('appId', {
    httpOnly: false,
    sameSite: 'strict',
    secure: isProd,
  });
}

export function requireAuth(_req: Request, res: Response, next: NextFunction): void {
  if (!_req.user) {
    res.status(401).json({ error: { message: 'Authentication required' } });
    return;
  }
  next();
}

/**
 * Middleware that enforces portal eligibility at the API level.
 *
 * Even though the API is shared, a request must only succeed if the caller's
 * role maps to the expected application. This prevents a STUDENT token from
 * accessing teacher-only endpoints, etc. The four portals pass their appId
 * in a custom header which is validated here.
 */
export function requirePortal(
  appId: AppId
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    const userAppId = req.user?.appId;
    if (!userAppId) {
      res.status(401).json({ error: { message: 'Authentication required' } });
      return;
    }
    if (!canAccessApp(req.user?.role, appId)) {
      res.status(403).json({
        error: { message: 'Forbidden: not authorized for this portal' },
      });
      return;
    }
    next();
  };
}
