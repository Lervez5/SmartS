import { Request, Response } from "express";
import { listAuditLogs } from "./service";

export async function listAuditLogsController(req: Request, res: Response): Promise<void> {
  const { search, action, limit } = req.query;

  const logs = await listAuditLogs({
    search: typeof search === "string" && search.length > 0 ? search : undefined,
    action: typeof action === "string" && action.length > 0 ? action : undefined,
    limit: limit ? Number(limit) : undefined,
  });

  res.json({ logs });
}
