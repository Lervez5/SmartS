import { Request, Response } from "express";
import { getStudentDashboardData, getTeacherDashboardData, getAdminDashboardData } from "./service";
import { ApiError } from "../../shared/errorHandler";
import { Role } from "../../security/rbac";

export async function getStudentDashboardController(req: Request, res: Response) {
  if (!req.user || req.user.role !== "student") {
    throw new ApiError(403, "Student access required");
  }
  const data = await getStudentDashboardData(req.user.id);
  res.json(data);
}

export async function getTeacherDashboardController(req: Request, res: Response) {
  if (!req.user || req.user.role !== "teacher") {
    throw new ApiError(403, "Teacher access required");
  }
  const data = await getTeacherDashboardData(req.user.id);
  res.json(data);
}

export async function getAdminDashboardController(req: Request, res: Response) {
  const isAdmin = req.user?.role === "super_admin" || req.user?.role === "school_admin";
  if (!req.user || !isAdmin) {
    throw new ApiError(403, "Admin access required");
  }
  const data = await getAdminDashboardData();
  res.json(data);
}
