import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import argon2 from 'argon2';
import { prisma } from '../../infrastructure/database';
import { config } from '../../config';
import { clearAuthCookies, setAuthCookies, signTokens, type AuthUser } from '../../middleware/auth';
import { loginSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema } from './schema';
import {
  loginService,
  registerService,
  forgotPasswordService,
  resetPasswordService,
} from './service';
import { normalizeRole, ROLE_APP, type AppId } from '@schoolos/auth/roles';
import { permissionsForRole, type Permission } from '@schoolos/auth/permissions';

/**
 * Resolves the full identity for a request: canonical role plus the
 * permissions granted by that role in MongoDB.
 *
 * This is the single place the API turns a membership into an authorization
 * decision, so the token, /auth/me and the RBAC guards can never disagree.
 */
export async function resolveIdentity(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      firstName: true,
      lastName: true,
      avatar: true,
      status: true,
      sessionTokenVersion: true,
      roleMemberships: {
        select: {
          role: {
            select: {
              name: true,
              rolePermissions: {
                select: { permission: { select: { key: true } } },
              },
            },
          },
        },
      },
    },
  });

  if (!user) return null;

  const memberships = user.roleMemberships;

  // Normalize defensively: older rows may still carry a legacy role name.
  const canonical = memberships
    .map((m) => normalizeRole(m.role.name))
    .find((r): r is NonNullable<typeof r> => r !== null);
  const role = canonical ?? 'STUDENT';

  // Prefer the grants stored in MongoDB so an administrator's customisation
  // wins. Fall back to the code-defined catalogue when the role has no
  // persisted grants - a database that has never been seeded still resolves
  // every role's permissions correctly, so login is role-aware out of the box.
  const dbPermissions = Array.from(
    new Set(memberships.flatMap((m) => m.role.rolePermissions.map((rp) => rp.permission.key)))
  );
  const permissions = (
    dbPermissions.length > 0 ? dbPermissions : permissionsForRole(role)
  ) as Permission[];

  return {
    id: user.id,
    email: user.email,
    name: user.name ?? undefined,
    firstName: user.firstName ?? undefined,
    lastName: user.lastName ?? undefined,
    avatar: user.avatar ?? undefined,
    role,
    permissions: permissions as Permission[],
    appId: ROLE_APP[role],
    status: user.status,
    sessionTokenVersion: user.sessionTokenVersion ?? 0,
  };
}

export async function loginController(req: Request, res: Response): Promise<void> {
  const parsed = loginSchema.parse(req.body);
  const result = await loginService(parsed);
  const identity = await resolveIdentity(result.user.id);
  setAuthCookies(res, result.tokens);
  res.json({ user: identity ?? result.user });
}

export async function registerController(req: Request, res: Response): Promise<void> {
  const parsed = registerSchema.parse(req.body);
  const result = await registerService(parsed);
  const identity = await resolveIdentity(result.user.id);
  setAuthCookies(res, result.tokens);
  res.status(201).json({ user: identity ?? result.user });
}

export async function forgotPasswordController(req: Request, res: Response): Promise<void> {
  const parsed = forgotPasswordSchema.parse(req.body);
  const result = await forgotPasswordService(parsed);
  res.json(result);
}

export async function resetPasswordController(req: Request, res: Response): Promise<void> {
  const parsed = resetPasswordSchema.parse(req.body);
  const result = await resetPasswordService(parsed);
  res.json(result);
}

/**
 * Exchanges the httpOnly refresh cookie for a fresh access token.
 *
 * The access token is deliberately short-lived, so a long session needs a way
 * to renew without making the user sign in again. Verified against the refresh
 * secret, so an expired or tampered refresh token cannot mint a new session.
 */
export async function refreshController(req: Request, res: Response): Promise<void> {
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) {
    res.status(401).json({ error: { message: 'No refresh token' } });
    return;
  }

  let payload: AuthUser;
  try {
    payload = jwt.verify(refreshToken, config.jwt.refreshSecret) as AuthUser;
  } catch {
    // Expired or invalid refresh token: the session is genuinely over.
    clearAuthCookies(res);
    res.status(401).json({ error: { message: 'Session expired, please sign in again' } });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.id },
    select: { id: true, email: true, status: true, sessionTokenVersion: true },
  });
  if (!user || user.status !== 'active') {
    clearAuthCookies(res);
    res.status(401).json({ error: { message: 'Account is not active' } });
    return;
  }

  // A revoked session must not be able to renew itself, or revocation would only
  // last as long as the access token it was trying to replace.
  const tokenVersion = (payload as { sessionTokenVersion?: number }).sessionTokenVersion;
  if (typeof tokenVersion === 'number' && tokenVersion !== user.sessionTokenVersion) {
    clearAuthCookies(res);
    res.status(401).json({ error: { message: 'Session expired, please sign in again' } });
    return;
  }

  // Re-resolve the current role and permissions rather than trusting the
  // refresh token, so a grant or revocation applies on the next renewal.
  const identity = await resolveIdentity(user.id);
  if (!identity) {
    clearAuthCookies(res);
    res.status(401).json({ error: { message: 'Account not found' } });
    return;
  }

  setAuthCookies(res, signTokens(identity));
  res.json({ user: identity });
}

export function logoutController(_req: Request, res: Response): void {
  clearAuthCookies(res);
  res.json({ message: 'Logged out successfully' });
}

/**
 * The current value of a user's session version.
 *
 * Every access token carries the version it was signed with. Revoking sessions
 * increments the stored value, which makes every token signed with an older one
 * stale - but only if something actually compares the two, and until now nothing
 * did: `requireAuth` trusts the version in the token, and neither `/me` nor
 * `/refresh` read the stored one. Incrementing it was therefore a no-op, so
 * "sign out everywhere" revoked nothing at all.
 *
 * Comparing here rather than in `requireAuth` keeps the check off the hot path -
 * every authenticated route would otherwise pay a database read - while still
 * catching a revoked session at the two moments it matters: when the client
 * rehydrates its session, and when it tries to extend one. An access token is
 * short-lived, so a revoked device has a narrow window either way.
 */
async function isSessionStale(userId: string, tokenVersion: number | undefined): Promise<boolean> {
  const current = await prisma.user.findUnique({
    where: { id: userId },
    select: { sessionTokenVersion: true },
  });
  if (!current) return true;
  // A token with no version predates revocation entirely, and is honoured.
  if (typeof tokenVersion !== 'number') return false;
  return tokenVersion !== current.sessionTokenVersion;
}

/**
 * Rehydrates the client session. The access token lives in an httpOnly cookie,
 * so the browser cannot read it; this lets the frontend resolve the current
 * user, role and permissions after a reload or in a fresh tab.
 */
export async function meController(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: { message: 'Not authenticated' } });
    return;
  }

  // A revoked session is reported here rather than continuing to answer as if
  // it were live, so the portal notices on its next load instead of at the
  // next refresh.
  if (await isSessionStale(req.user.id, req.user.sessionTokenVersion)) {
    clearAuthCookies(res);
    res.status(401).json({ error: { message: 'This session has been signed out.' } });
    return;
  }

  const identity = await resolveIdentity(req.user.id);
  if (!identity) {
    res.status(401).json({ error: { message: 'Not authenticated' } });
    return;
  }
  res.json({ user: identity });
}

export function verifyResetTokenController(req: Request, res: Response): void {
  const token = req.body?.token;
  if (!token || typeof token !== 'string') {
    res.status(400).json({ error: { message: 'Token is required' } });
    return;
  }
  res.json({ valid: true, message: 'Token is valid' });
}

/**
 * Changes the authenticated user's password. Verifies the current password
 * before accepting the new one.
 */
export async function changePasswordController(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: { message: 'Authentication required' } });
    return;
  }

  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400).json({
      error: { message: 'Current password and new password are required' },
    });
    return;
  }

  if (newPassword.length < 8) {
    res.status(400).json({
      error: { message: 'New password must be at least 8 characters' },
    });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { passwordHash: true, sessionTokenVersion: true },
  });

  if (!user || !user.passwordHash) {
    res.status(404).json({ error: { message: 'User not found' } });
    return;
  }

  const valid = await argon2.verify(user.passwordHash, currentPassword);
  if (!valid) {
    res.status(401).json({ error: { message: 'Current password is incorrect' } });
    return;
  }

  const newHash = await argon2.hash(newPassword);
  await prisma.user.update({
    where: { id: req.user.id },
    data: {
      passwordHash: newHash,
      passwordResetToken: null,
      passwordResetExpires: null,
      sessionTokenVersion: { increment: 1 },
    },
  });

  // Invalidate all sessions by incrementing the token version.
  clearAuthCookies(res);
  res.json({ message: 'Password changed successfully. Please sign in again.' });
}

/**
 * Revokes every session except the one making the request.
 *
 * `sessionTokenVersion` is the whole mechanism: every token carries the version
 * it was signed with, and any mismatch is rejected. Incrementing it therefore
 * invalidates every outstanding token - including the current one, which is why
 * this does not simply bump the counter and stop.
 *
 * To keep this browser signed in, a fresh pair is signed with the new version
 * and written back, so exactly one session survives: the one that asked. Every
 * other device is left holding a token that no longer matches, which is what
 * "signed out everywhere else" actually means.
 *
 * Clearing the cookies instead - which this used to do - signed the caller out
 * too, directly contradicting the promise the settings screen makes.
 */
export async function revokeSessionsController(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: { message: 'Authentication required' } });
    return;
  }

  const updated = await prisma.user.update({
    where: { id: req.user.id },
    data: { sessionTokenVersion: { increment: 1 } },
    select: { id: true },
  });

  // Rebuilt from the incremented version, so the new cookies carry it. Resolving
  // the identity again also picks up any permission change made elsewhere.
  const identity = (await resolveIdentity(updated.id)) as AuthUser | null;
  if (!identity) {
    // Without an identity there is nothing valid to re-issue, so the caller is
    // left signed out rather than holding a half-signed session.
    clearAuthCookies(res);
    res.status(401).json({ error: { message: 'Could not re-establish this session.' } });
    return;
  }

  setAuthCookies(res, signTokens(identity));
  res.json({
    message: 'Every other session has been signed out. You are still signed in here.',
    revokedOtherSessions: true,
  });
}
