import { Request, Response } from "express";
import { Role } from "../../security/rbac";
import { listAuditLogsService } from "./service";
import { ApiError } from "../../shared/errorHandler";

export async function listAuditLogsController(req: Request, res: Response) {
  if (!req.user || !["super_admin", "school_admin"].includes(req.user.role)) {
    throw new ApiError(403, "Admin role required");
  }
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const logs = await listAuditLogsService(limit);
  res.json({ logs });
}


