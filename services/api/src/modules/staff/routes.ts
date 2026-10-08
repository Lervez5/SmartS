import { Router, type Request, type Response } from 'express';
import { requirePermissions } from '../../middleware/rbac';
import { requireSchoolScope } from '../../modules/settings/scope';
import { asyncHandler } from '../../shared/asyncHandler';
import {
  listStaffController,
  getStaffController,
  getStaffAssignmentsController,
  createStaffController,
  updateStaffController,
} from './controller';

export const router: Router = Router();

router.use(requireSchoolScope());

router.get('/', requirePermissions('staff.view'), asyncHandler(listStaffController));
router.get('/:id', requirePermissions('staff.view'), asyncHandler(getStaffController));
router.get(
  '/:userId/assignments',
  requirePermissions('staff.view'),
  asyncHandler(getStaffAssignmentsController)
);
router.post('/', requirePermissions('staff.manage'), asyncHandler(createStaffController));
router.put('/:id', requirePermissions('staff.manage'), asyncHandler(updateStaffController));
