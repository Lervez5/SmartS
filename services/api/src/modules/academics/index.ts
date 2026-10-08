import { Router } from 'express';
import { requirePermissions } from '../../middleware/rbac';

export const router: Router = Router();

/**
 * academics module - migrated
 * Legacy source: modules/subjects, modules/courses, modules/timetable
 * TODO: implement domain endpoints.
 */
router.get('/', requirePermissions('academics.view'), (_req, res) => {
  res.json({
    service: 'schoolos-api',
    module: 'academics',
    state: 'migrated',
  });
});
