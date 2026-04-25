import { Request, Response } from "express";
import { Role } from "../../security/rbac";
import { childProgressService, systemStatsService } from "./service";
import { progressQuerySchema } from "./schema";
import { ApiError } from "../../shared/errorHandler";

export async function childProgressController(req: Request, res: Response) {
  if (!req.user) {
    throw new ApiError(401, "Authentication required");
  }
  const parsed = progressQuerySchema.parse({ childId: req.params.childId });
  const isAdmin = ["super_admin", "school_admin", "teacher"].includes(req.user.role);
  if (req.user.role === "parent" || isAdmin) {
    const data = await childProgressService(parsed);
    res.json({ progress: data });
    return;
  }
  if (req.user.role === "student" && req.user.id === parsed.childId) {
    const data = await childProgressService(parsed);
    res.json({ progress: data });
    return;
  }
  throw new ApiError(403, "Not allowed to view this child's progress");
}

export async function systemStatsController(req: Request, res: Response) {
  if (!req.user || !["super_admin", "school_admin"].includes(req.user.role)) {
    throw new ApiError(403, "Admin role required");
  }
  const stats = await systemStatsService();
  res.json({ stats });
}


