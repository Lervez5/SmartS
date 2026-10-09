import { Request, Response } from 'express';
import {
  getStudentDashboardData,
  getTeacherDashboardData,
  getAdminDashboardData,
  getParentDashboardData,
} from './service';
import { schoolScopeOf } from '../settings/scope';

/**
 * Every dashboard is scoped to the caller's school.
 *
 * The figures these return are aggregates over learners, courses, invoices,
 * attendance and results, all of which hang off a school through their class or
 * membership. Without the scope they would be computed across every school in
 * the database, which is how a school came to see other schools' numbers.
 */
export async function studentDashboardController(req: Request, res: Response): Promise<void> {
  const { schoolId } = schoolScopeOf(req);
  res.json(await getStudentDashboardData(schoolId, req.user!.id));
}

export async function teacherDashboardController(req: Request, res: Response): Promise<void> {
  const { schoolId } = schoolScopeOf(req);
  res.json(await getTeacherDashboardData(schoolId, req.user!.id));
}

export async function adminDashboardController(req: Request, res: Response): Promise<void> {
  const { schoolId } = schoolScopeOf(req);
  const academicYearId =
    typeof req.query.academicYearId === 'string' ? req.query.academicYearId : undefined;
  const termId = typeof req.query.termId === 'string' ? req.query.termId : undefined;
  res.json(await getAdminDashboardData(schoolId, academicYearId, termId));
}

export async function parentDashboardController(req: Request, res: Response): Promise<void> {
  const { schoolId } = schoolScopeOf(req);
  res.json(await getParentDashboardData(schoolId, req.user!.id));
}
