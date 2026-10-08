import { Request, Response } from "express";
import {
  academicReport,
  attendanceReport,
  financialReport,
  platformAnalytics,
  triggerExport,
} from "./service";

export async function academicReportController(req: Request, res: Response): Promise<void> {
  res.json(await academicReport(req.query as Record<string, unknown>));
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
