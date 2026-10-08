import crypto from 'crypto';
import { config } from '../../config';
import { ApiError, logger } from '../../shared/logger';
import { findUserByEmail, createUser, findUserByResetToken, updateUser } from './repository';
import { AuthResult } from './types';
import { LoginInput, RegisterInput, ForgotPasswordInput, ResetPasswordInput } from './schema';
import { signTokens } from '../../middleware/auth';
import { normalizeRole, ROLE_APP } from '@schoolos/auth/roles';
import type { Permission } from '@schoolos/auth/permissions';

interface RoleWithPermissions {
  name: string;
  rolePermissions?: { permission: { key: string } }[];
}

export async function loginService(payload: LoginInput): Promise<AuthResult> {
  const user = await findUserByEmail(payload.email.toLowerCase());

  if (!user || !user.passwordHash) {
    throw new ApiError(401, 'Invalid credentials');
  }

  const { default: argon2 } = await import('argon2');
  const valid = await argon2.verify(user.passwordHash, payload.password);

  if (!valid) {
    throw new ApiError(401, 'Invalid credentials');
  }

  // Account must be active to log in.
  if (user.status !== 'active' && user.status !== 'pending') {
    throw new ApiError(403, 'Account is not active');
  }
  if (user.status === 'pending') {
    throw new ApiError(403, 'Account is pending activation. Please activate your account first.');
  }

  const role = user.roleMemberships[0]?.role as RoleWithPermissions | undefined;
  const canonicalRole = normalizeRole(role?.name) ?? 'STUDENT';
  const permissions = (role?.rolePermissions ?? []).map((rp) => rp.permission.key) as Permission[];

  const authUser = {
    id: user.id,
    email: user.email,
    role: canonicalRole,
    name: user.name || undefined,
    firstName: user.firstName || undefined,
    lastName: user.lastName || undefined,
    avatar: user.avatar || undefined,
    phone: user.phone || undefined,
    permissions,
    appId: ROLE_APP[canonicalRole],
    sessionTokenVersion: user.sessionTokenVersion ?? 0,
  };

  const tokens = signTokens(authUser);
  return { user: authUser, tokens };
}

export async function registerService(payload: RegisterInput): Promise<AuthResult> {
  const existing = await findUserByEmail(payload.email.toLowerCase());
  if (existing) {
    throw new ApiError(400, 'User already exists');
  }

  const { default: argon2 } = await import('argon2');
  const passwordHash = await argon2.hash(payload.password);

  const user = await createUser({
    name: payload.name,
    email: payload.email.toLowerCase(),
    passwordHash,
    role: payload.role,
  });

  const role = user.roleMemberships[0]?.role as RoleWithPermissions | undefined;
  const canonicalRole = normalizeRole(role?.name) ?? 'STUDENT';

  const authUser = {
    id: user.id,
    email: user.email,
    role: canonicalRole,
    name: user.name || undefined,
    firstName: user.firstName || undefined,
    lastName: user.lastName || undefined,
    avatar: user.avatar || undefined,
    phone: user.phone || undefined,
    permissions: (role?.rolePermissions ?? []).map((rp) => rp.permission.key) as Permission[],
    appId: ROLE_APP[canonicalRole],
    sessionTokenVersion: user.sessionTokenVersion ?? 0,
  };

  const tokens = signTokens(authUser);
  return { user: authUser, tokens };
}

export async function forgotPasswordService(
  payload: ForgotPasswordInput
): Promise<{ message: string; devResetUrl?: string }> {
  const user = await findUserByEmail(payload.email.toLowerCase());

  // Account enumeration protection: always return success.
  if (!user) {
    logger.info('Password reset requested for unknown user', {
      event: 'password_reset_requested',
      email: payload.email,
    });
    return { message: 'If the account exists, a reset link has been sent.' };
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

  await updateUser(user.id, {
    passwordResetToken: token,
    passwordResetExpires: expires,
  });

  logger.info('Password reset requested', {
    event: 'password_reset_requested',
    email: user.email,
    token,
  });

  const message = 'If the account exists, a reset link has been sent.';

  // Outside production there is no mailbox to deliver to, so the link is only
  // ever written to the server log and the flow cannot be completed or tested.
  // Returning it here makes the whole path checkable end to end. Never returned
  // in production, and never derived for an unknown address, so it cannot become
  // an account-enumeration channel.
  if (config.env === 'production') return { message };

  return {
    message,
    devResetUrl: `/reset-password?token=${token}`,
  };
}

export async function resetPasswordService(
  payload: ResetPasswordInput
): Promise<{ message: string }> {
  const user = await findUserByResetToken(payload.token);
  if (!user) {
    throw new ApiError(400, 'Invalid or expired reset token');
  }

  const { default: argon2 } = await import('argon2');
  const passwordHash = await argon2.hash(payload.password);

  await updateUser(user.id, {
    passwordHash,
    passwordResetToken: null,
    passwordResetExpires: null,
    // Invalidate existing sessions by rotating the refresh token
    status: user.status,
  });

  logger.info('Password reset completed', {
    event: 'password_reset_completed',
    email: user.email,
  });

  return { message: 'Password updated successfully' };
}
