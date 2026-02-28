import { listAuditLogs } from "./repository";

export function listAuditLogsService(limit = 100) {
  return listAuditLogs(limit);
}


