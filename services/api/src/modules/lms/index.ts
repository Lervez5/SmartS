import { Router } from 'express';
import { requirePermissions } from '../../middleware/rbac';

export const router: Router = Router();

/**
 * lms module - migrated
 * Legacy source: modules/courses, modules/assignments, modules/assignments/submission
 * TODO: implement domain endpoints.
 */
router.get('/', requirePermissions('academics.view'), (_req, res) => {
  res.json({ service: 'schoolos-api', module: 'lms', state: 'migrated' });
});
