import { Request, Response } from 'express';
import { listAuditLogs } from './service';
import { schoolScopeOf } from '../settings/scope';

export async function listAuditLogsController(req: Request, res: Response): Promise<void> {
  const { search, action, limit } = req.query;
  const { schoolId } = schoolScopeOf(req);

  const logs = await listAuditLogs({
    search: typeof search === 'string' && search.length > 0 ? search : undefined,
    action: typeof action === 'string' && action.length > 0 ? action : undefined,
    limit: limit ? Number(limit) : undefined,
    // Scoped to the caller's school: the trail is a record of this school's
    // decisions, not the platform's.
    schoolId,
  });

  res.json({ logs });
}
