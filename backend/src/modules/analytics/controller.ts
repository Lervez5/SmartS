import { Request, Response } from "express";
import { childProgressService, systemStatsService } from "./service";
import { progressQuerySchema } from "./schema";
import { ApiError } from "../../shared/errorHandler";

export async function childProgressController(req: Request, res: Response) {
  if (!req.user) {
    throw new ApiError(401, "Authentication required");
  }
  const parsed = progressQuerySchema.parse({ childId: req.params.childId });
  if (req.user.role === "parent" || req.user.role === "admin") {
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
  if (!req.user || req.user.role !== "admin") {
    throw new ApiError(403, "Admin role required");
  }
  const stats = await systemStatsService();
  res.json({ stats });
}


