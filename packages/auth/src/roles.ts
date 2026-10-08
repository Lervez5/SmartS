/**
 * Canonical identity model for the school management platform.
 *
 * There are exactly four applications. Roles are not applications: a role
 * resolves to (a) which app the user lands in and (b) which permissions the
 * user holds. ACCOUNTANT, DEAN, and SUPER_ADMIN are staff who all operate
 * through apps/admin; they differ only by permission grants.
 */

export const ROLES = ['SUPER_ADMIN', 'ACCOUNTANT', 'DEAN', 'TEACHER', 'PARENT', 'STUDENT'] as const;

export type UserRole = (typeof ROLES)[number];

/** The four application boundaries. */
export const APPS = ['student', 'teacher', 'parent', 'admin'] as const;
export type AppId = (typeof APPS)[number];

/** Development ports are fixed by the deployment contract. */
export const APP_PORTS: Record<AppId, number> = {
  student: 3000,
  teacher: 3001,
  parent: 3002,
  admin: 3003,
};

export const APP_URLS: Record<AppId, string> = {
  student: process.env.NEXT_PUBLIC_STUDENT_URL ?? 'http://localhost:3000',
  teacher: process.env.NEXT_PUBLIC_TEACHER_URL ?? 'http://localhost:3001',
  parent: process.env.NEXT_PUBLIC_PARENT_URL ?? 'http://localhost:3002',
  admin: process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://localhost:3003',
};

/**
 * Which application each role belongs to. All administrative and staff roles
 * share apps/admin; this is what keeps the platform at four apps instead of one
 * per role.
 */
export const ROLE_APP: Record<UserRole, AppId> = {
  SUPER_ADMIN: 'admin',
  ACCOUNTANT: 'admin',
  DEAN: 'admin',
  TEACHER: 'teacher',
  PARENT: 'parent',
  STUDENT: 'student',
};

/**
 * In-app landing path, relative to the resolved application origin.
 *
 * Every value here must be a route the owning portal actually serves. An
 * accountant landing on a non-existent path produced a 404 straight after a
 * successful sign-in, so each entry is checked against the portal's page tree.
 */
export const ROLE_HOME: Record<UserRole, string> = {
  SUPER_ADMIN: '/admin',
  ACCOUNTANT: '/admin/finance',
  DEAN: '/admin',
  TEACHER: '/dashboard',
  PARENT: '/dashboard',
  STUDENT: '/dashboard',
};

/**
 * Roles that are provisioned by an administrator and can never self-register.
 * All of them, in practice, but named explicitly so the rule is enforceable.
 */
export const PROVISIONED_ROLES: readonly UserRole[] = ROLES;

/**
 * Legacy role values that may still exist in MongoDB, mapped to the canonical
 * model. This is the single place conversions happen; the rest of the codebase
 * uses UserRole only.
 */
export const LEGACY_ROLE_ALIASES: Record<string, UserRole> = {
  super_admin: 'SUPER_ADMIN',
  school_admin: 'DEAN',
  admin: 'SUPER_ADMIN',
  staff: 'DEAN',
  accountant: 'ACCOUNTANT',
  dean: 'DEAN',
  teacher: 'TEACHER',
  parent: 'PARENT',
  student: 'STUDENT',
};

/** Normalise any stored/legacy role string to the canonical model. */
export function normalizeRole(value: string | null | undefined): UserRole | null {
  if (!value) return null;
  const upper = String(value)
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  if ((ROLES as readonly string[]).includes(upper)) return upper as UserRole;
  return LEGACY_ROLE_ALIASES[String(value).toLowerCase()] ?? null;
}

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

/** The application a user should be routed to, or null if the role is unknown. */
export function appForRole(role: string | null | undefined): AppId | null {
  const normalized = normalizeRole(role);
  return normalized ? ROLE_APP[normalized] : null;
}

/** Absolute URL a user should land on after authenticating. */
export function destinationForRole(role: string | null | undefined): string | null {
  const app = appForRole(role);
  if (!app) return null;
  return `${APP_URLS[app]}${ROLE_HOME[normalizeRole(role)!]}`;
}

/** True when the role is permitted to use the given application. */
export function canAccessApp(role: string | null | undefined, app: AppId): boolean {
  const resolved = appForRole(role);
  return resolved === app;
}
