/**
 * Auth type surface.
 *
 * Permission and role constants are intentionally NOT redeclared here: they
 * live in ./roles and ./permissions and are re-exported from the package root,
 * so the codebase has exactly one definition of each.
 */

export type { AuthUser, AuthTokens, AuthResult } from './auth.server';
export type { AppId, UserRole } from './roles';
export type { Permission, PermissionDomain } from './permissions';
