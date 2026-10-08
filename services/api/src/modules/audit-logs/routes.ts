import { Router } from 'express';
import { listAuditLogsController } from './controller';
import { requireRole, requirePermissions } from '../../middleware/rbac';

export const router: Router = Router();

const requireAuditAccess = requirePermissions('users.view');

router.get('/', requireAuditAccess, (req, res, next) => {
  listAuditLogsController(req, res).catch(next);
});
