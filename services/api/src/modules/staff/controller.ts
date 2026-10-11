import { Request, Response } from 'express';
import { requirePermissions } from '../../middleware/rbac';
import { requireSchoolScope, schoolScopeOf } from '../../modules/settings/scope';
import { recordAuditLog } from '../../modules/audit-logs/service';
import { ApiError } from '../../shared/logger';
import { asyncHandler } from '../../shared/asyncHandler';
import {
  listStaff,
  getStaffMember,
  createStaff,
  updateStaff,
  getStaffAssignments,
} from './service';
import { listStaffSchema, createStaffSchema, updateStaffSchema } from './schema';

export const requireStaffView = requirePermissions('staff.view');
export const requireStaffManage = requirePermissions('staff.manage');

export async function listStaffController(req: Request, res: Response) {
  const { schoolId } = schoolScopeOf(req);
  const query = listStaffSchema.parse(req.query);
  const result = await listStaff(schoolId, query);
  res.json(result);
}

export async function getStaffController(req: Request, res: Response) {
  const { schoolId } = schoolScopeOf(req);
  const member = await getStaffMember(schoolId, req.params.id);
  if (!member) {
    res.status(404).json({ error: { message: 'Staff member not found' } });
    return;
  }
  res.json({ staff: [member] });
}

export async function getStaffAssignmentsController(req: Request, res: Response) {
  const { schoolId } = schoolScopeOf(req);
  const result = await getStaffAssignments(schoolId, req.params.userId);
  res.json(result);
}

export async function createStaffController(req: Request, res: Response) {
  const { schoolId } = schoolScopeOf(req);
  const payload = createStaffSchema.parse(req.body);
  const staff = await createStaff(schoolId, payload, req.user?.id ?? null);
  res.status(201).json(staff);
}

export async function updateStaffController(req: Request, res: Response) {
  const { schoolId } = schoolScopeOf(req);
  const payload = updateStaffSchema.parse(req.body);
  const staff = await updateStaff(schoolId, req.params.id, payload, req.user?.id ?? null);
  res.json(staff);
}
