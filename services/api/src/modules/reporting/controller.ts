import { Request, Response } from 'express';
import {
  academicReport,
  attendanceReport,
  financialReport,
  platformAnalytics,
  triggerExport,
} from './service';
import { schoolScopeOf } from '../settings/scope';

export async function academicReportController(req: Request, res: Response): Promise<void> {
  const { schoolId } = schoolScopeOf(req);
  res.json(await academicReport(schoolId, req.query as Record<string, unknown>));
}

export async function attendanceReportController(req: Request, res: Response): Promise<void> {
  res.json(await attendanceReport(req.query as Record<string, unknown>));
}

export async function financialReportController(req: Request, res: Response): Promise<void> {
  res.json(await financialReport(req.query as Record<string, unknown>));
}

export async function analyticsController(_req: Request, res: Response): Promise<void> {
  res.json(await platformAnalytics());
}

export async function exportController(req: Request, res: Response): Promise<void> {
  res.status(202).json(await triggerExport(req.user!.id, req.body ?? {}));
}
