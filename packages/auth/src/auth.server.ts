/**
 * Auth type surface.
 *
 * Permission and role constants are intentionally NOT redeclared here: they
 * live in ./roles and ./permissions and are re-exported from the package root,
 * so the codebase has exactly one definition of each.
 */

import type { Permission } from './permissions';
import type { UserRole } from './roles';
import type { AppId } from './roles';

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
  /** The application this user is permitted to enter. */
  appId: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: AuthUser;
  tokens: AuthTokens;
}
