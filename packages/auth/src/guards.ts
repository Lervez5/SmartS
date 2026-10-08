/**
 * Centralized guards.
 *
 * Pure module with no React or Node dependencies so it can be imported from
 * client components, server components and edge middleware alike. This is the
 * only place role-to-application and permission decisions are expressed;
 * callers ask questions instead of writing role if/else chains.
 */

import { appForRole, normalizeRole, type AppId, type UserRole } from './roles';
import { canAccessModule, hasAnyPermission, type Permission } from './permissions';

/** Roles that operate through apps/admin. */
export const ADMIN_APP_ROLES: readonly UserRole[] = ['SUPER_ADMIN', 'ACCOUNTANT', 'DEAN'];

/** True when the identity belongs in the administrative surface. */
export function isAdminRole(role: string | null | undefined): boolean {
  return appForRole(role) === 'admin';
}

/** True when the identity is the platform owner. */
export function isSuperAdmin(role: string | null | undefined): boolean {
  return normalizeRole(role) === 'SUPER_ADMIN';
}

/**
 * Where a user in `app` should be sent when they do not belong there.
 * Returns null when they do belong, meaning the route may render.
 */
export function rejectWrongApp(
  role: string | null | undefined,
  app: AppId,
  fallbackHome = '/'
): string | null {
  if (!role) return fallbackHome;
  return appForRole(role) === app ? null : fallbackHome;
}

/**
 * Nav gating driven by permission metadata rather than role.
 * `required` empty means the module is visible to any signed-in user.
 */
export function visibleModules<T extends { permissions?: readonly Permission[] }>(
  granted: readonly string[] | null | undefined,
  modules: readonly T[]
): T[] {
  return modules.filter((m) => canAccessModule(granted, m.permissions ?? []));
}

export { appForRole, normalizeRole, canAccessModule, hasAnyPermission };
export type { AppId, UserRole, Permission };
