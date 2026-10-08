import { Request, Response } from 'express';
import {
  updateRolePermissionsSchema,
  mutateRolePermissionSchema,
  assignRoleSchema,
} from './schema';
import {
  listRoles,
  getRole,
  permissionCatalogue,
  updateRolePermissions,
  mutateRolePermission,
  resetRoleToCatalogue,
  assignUserRole,
} from './service';

export async function listRolesController(_req: Request, res: Response): Promise<void> {
  res.json({ roles: await listRoles() });
}

export async function listPermissionsController(_req: Request, res: Response): Promise<void> {
  res.json({ domains: permissionCatalogue() });
}

export async function getRoleController(req: Request, res: Response): Promise<void> {
  res.json(await getRole(req.params.id));
}

export async function updateRolePermissionsController(req: Request, res: Response): Promise<void> {
  const dto = updateRolePermissionsSchema.parse(req.body);
  res.json(await updateRolePermissions(req.user!.id, req.params.id, dto));
}

export async function mutateRolePermissionController(req: Request, res: Response): Promise<void> {
  const dto = mutateRolePermissionSchema.parse(req.body);
  res.json(await mutateRolePermission(req.user!.id, req.params.id, dto));
}

export async function resetRoleController(req: Request, res: Response): Promise<void> {
  res.json(await resetRoleToCatalogue(req.user!.id, req.params.id));
}

export async function assignUserRoleController(req: Request, res: Response): Promise<void> {
  const dto = assignRoleSchema.parse(req.body);
  res.json(await assignUserRole(req.user!.id, req.params.userId, dto.role));
}
