import { Router } from 'express';
import {
  listRolesController,
  listPermissionsController,
  getRoleController,
  updateRolePermissionsController,
  mutateRolePermissionController,
  resetRoleController,
  assignUserRoleController,
} from './controller';
import { requirePermissions } from '../../middleware/rbac';
import { asyncHandler } from '../../shared/asyncHandler';

export const router: Router = Router();

/**
 * Reading the model is an administrative concern, changing it is restricted to
 * roles.manage, which only SUPER_ADMIN holds.
 */
const requireRoleView = requirePermissions('roles.manage');
const requireRoleManage = requirePermissions('roles.manage');

router.get('/permissions', requireRoleView, asyncHandler(listPermissionsController));

router.get('/', requireRoleView, asyncHandler(listRolesController));

router.get('/:id', requireRoleView, asyncHandler(getRoleController));

/** Replace (or extend) the permission set of a role. */
router.put('/:id/permissions', requireRoleManage, asyncHandler(updateRolePermissionsController));

/** Grant or revoke a single permission on a role. */
router.post('/:id/permissions', requireRoleManage, asyncHandler(mutateRolePermissionController));

/** Restore a platform role to its catalogue default. */
router.post('/:id/permissions/reset', requireRoleManage, asyncHandler(resetRoleController));

/** Assign a role to a user. */
router.put('/:id/users/:userId', requireRoleManage, asyncHandler(assignUserRoleController));
