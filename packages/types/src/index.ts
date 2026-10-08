/**
 * Domain contracts shared across the API and all portals.
 *
 * These interfaces mirror the persistence models but contain no
 * database-specific artifacts. The canonical role and permission
 * definitions live in @schoolos/auth; this package focuses on the
 * runtime entities users, sessions, accounts and domain objects.
 */

import type { UserRole, AppId } from '@schoolos/auth';
import type { Permission, PermissionDomain } from '@schoolos/auth';

export type { UserRole, AppId, Permission, PermissionDomain };

/** Account lifecycle states. */
export type AccountStatus = 'pending' | 'active' | 'suspended' | 'archived';

/** A user record as returned by the API. */
export interface User {
  id: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  role: UserRole;
  permissions: Permission[];
  appId: string;
  status: AccountStatus;
  createdAt: string;
  updatedAt: string;
}

/** A role definition. */
export interface Role {
  id: string;
  name: UserRole;
  description?: string;
  permissions: Permission[];
  createdAt: string;
  updatedAt: string;
}

/** Session token pair for cookie-based auth. */
export interface Session {
  accessToken: string;
  refreshToken: string;
  user: User;
}

/** A permission entry in the catalogue. */
export interface PermissionEntry {
  key: Permission;
  name: string;
  description?: string;
  domain: PermissionDomain;
}

/** Invitation state. */
export type InvitationStatus = 'pending' | 'accepted' | 'expired';

/** An invitation sent to provision a user. */
export interface Invitation {
  id: string;
  email: string;
  role: UserRole;
  status: InvitationStatus;
  token?: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

/** Audit log entry. */
export interface AuditLogEntry {
  id: string;
  userId?: string;
  action: string;
  details?: string;
  meta?: Record<string, unknown>;
  createdAt: string;
}
