import { Request, Response } from "express";
import {
  getStudentDashboardData,
  getTeacherDashboardData,
  getAdminDashboardData,
  getParentDashboardData,
} from "./service";

export async function studentDashboardController(_req: Request, res: Response): Promise<void> {
  res.json(await getStudentDashboardData(_req.user!.id));
}

export async function teacherDashboardController(_req: Request, res: Response): Promise<void> {
  res.json(await getTeacherDashboardData(_req.user!.id));
}

export async function adminDashboardController(_req: Request, res: Response): Promise<void> {
  res.json(await getAdminDashboardData());
}

export async function parentDashboardController(_req: Request, res: Response): Promise<void> {
  res.json(await getParentDashboardData(_req.user!.id));
}
