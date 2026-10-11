import { NextFunction, Request, Response } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import { config } from '../config';
import { prisma } from '../infrastructure/database';
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

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
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

    const sessionTokenVersion = decoded.sessionTokenVersion;
    // A token with no version predates revocation and is honoured as-is.
    if (typeof sessionTokenVersion !== 'number') {
      req.user = {
        ...decoded,
        role: canonicalRole,
        appId: ROLE_APP[canonicalRole],
      };
      next();
      return;
    }

    // Revocation is enforced here rather than left to /me and /refresh.
    //
    // Those two catch a revoked session at the next reload or renewal, but an
    // access token lives for minutes after the version moved, so a laptop that
    // was signed out could keep making authenticated calls until its token
    // expired. For "sign out everywhere" to mean anything on a device you no
    // longer hold, the check has to be on the request path.
    //
    // The cost is one indexed read per authenticated request, which for a
    // school-sized deployment is the right trade: correctness of revocation
    // over a microsecond per call. A database error fails open - the request
    // is allowed and the next /me or /refresh still enforces it - because an
    // infrastructure blip should not sign the whole school out.
    verifySessionVersion(decoded.id, sessionTokenVersion)
      .then((stillValid: boolean) => {
        if (!stillValid) {
          res.status(401).json({ error: { message: 'This session has been signed out.' } });
          return;
        }
        req.user = {
          ...decoded,
          role: canonicalRole,
          appId: ROLE_APP[canonicalRole],
          sessionTokenVersion,
        };
        next();
      })
      .catch(() => {
        // Fail open on a lookup failure, so a database blip does not lock out
        // every signed-in user at once. /me and /refresh enforce strictly.
        req.user = {
          ...decoded,
          role: canonicalRole,
          appId: ROLE_APP[canonicalRole],
          sessionTokenVersion,
        };
        next();
      });
    return;
  } catch {
    // token invalid or expired - user remains unauthenticated
  }
  next();
}

/**
 * Whether a token's session version still matches the user's current one.
 *
 * A mismatch means every session was revoked after this token was issued - by
 * "sign out everywhere", a password change, or an account deactivation - so the
 * token is stale even though it is still cryptographically sound.
 */
async function verifySessionVersion(userId: string, tokenVersion: number): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { sessionTokenVersion: true },
  });
  if (!user) return false;
  return user.sessionTokenVersion === tokenVersion;
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
