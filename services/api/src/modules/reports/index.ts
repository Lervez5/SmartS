import { Router } from 'express';
import { requirePermissions } from '../../middleware/rbac';

export const router: Router = Router();

/**
 * reports module - migrated
 * Legacy source: modules/reporting, modules/analytics
 * TODO: implement domain endpoints.
 */
router.get('/', requirePermissions('reports.view'), (_req, res) => {
  res.json({
    service: 'schoolos-api',
    module: 'reports',
    state: 'migrated',
  });
});
