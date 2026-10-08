import { z } from 'zod';

/** Replaces the full permission set of a role. */
export const updateRolePermissionsSchema = z.object({
  permissions: z.array(z.string().min(1)).min(1, 'At least one permission is required'),
  /** When true the listed permissions are added to the existing set. */
  additive: z.boolean().optional().default(false),
});

/** Grants or revokes a specific permission on a role. */
export const mutateRolePermissionSchema = z.object({
  permission: z.string().min(1),
  granted: z.boolean(),
});

export const assignRoleSchema = z.object({
  role: z.string().min(1),
});

export type UpdateRolePermissionsDto = z.infer<typeof updateRolePermissionsSchema>;
export type MutateRolePermissionDto = z.infer<typeof mutateRolePermissionSchema>;
export type AssignRoleDto = z.infer<typeof assignRoleSchema>;
