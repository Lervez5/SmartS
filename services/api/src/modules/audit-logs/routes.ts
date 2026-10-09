import { Router } from 'express';
import { listAuditLogsController } from './controller';
import { requirePermissions } from '../../middleware/rbac';
import { requireSchoolScope } from '../settings/scope';

export const router: Router = Router();

// The trail is a record of this school's own administrative decisions.
router.use(requireSchoolScope());

const requireAuditAccess = requirePermissions('users.view');

router.get('/', requireAuditAccess, (req, res, next) => {
  listAuditLogsController(req, res).catch(next);
});
