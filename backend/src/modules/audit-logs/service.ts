import { listAuditLogs, createAuditLogRepo } from "./repository";

export function listAuditLogsService(limit = 100) {
  return listAuditLogs(limit);
}

export function logAction(userId: string | null, action: string, details: string) {
  return createAuditLogRepo(userId, action, details);
}


