// Role layout utilities - this file provides helper functions for role-based layouts
// The actual layout components should be implemented in each app using the shared UI components

import { type UserRole } from "@schoolos/types";

export interface RoleConfig {
  role: UserRole;
  permissions: string[];
  navigation: any[]; // Will be populated by the specific app
}

export function getRoleConfig(role: UserRole): RoleConfig {
  // This is a placeholder - actual implementation should be in the app
  // Each app should import roleNavigation from @schoolos/ui and configure accordingly
  return {
    role,
    permissions: [],
    navigation: [],
  };
}

export function hasPermission(userPermissions: string[], requiredPermission: string): boolean {
  return userPermissions.includes(requiredPermission);
}

export function hasAnyPermission(userPermissions: string[], requiredPermissions: string[]): boolean {
  return requiredPermissions.some(permission => userPermissions.includes(permission));
}

export function hasAllPermissions(userPermissions: string[], requiredPermissions: string[]): boolean {
  return requiredPermissions.every(permission => userPermissions.includes(permission));
}