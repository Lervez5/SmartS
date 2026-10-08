import { Request, Response } from 'express';
import {
  getStudentDashboardData,
  getTeacherDashboardData,
  getAdminDashboardData,
  getParentDashboardData,
} from './service';

export async function studentDashboardController(_req: Request, res: Response): Promise<void> {
  res.json(await getStudentDashboardData(_req.user!.id));
}

export async function teacherDashboardController(_req: Request, res: Response): Promise<void> {
  res.json(await getTeacherDashboardData(_req.user!.id));
}

export async function adminDashboardController(req: Request, res: Response): Promise<void> {
  const academicYearId = typeof req.query.academicYearId === 'string' ? req.query.academicYearId : undefined;
  const termId = typeof req.query.termId === 'string' ? req.query.termId : undefined;
  res.json(await getAdminDashboardData(academicYearId, termId));
}

export async function parentDashboardController(_req: Request, res: Response): Promise<void> {
  res.json(await getParentDashboardData(_req.user!.id));
}
