import { Router } from 'express';
import { requirePermissions } from '../../middleware/rbac';

export const router: Router = Router();

/**
 * documents module - migrated
 * Legacy source: modules/upload
 * TODO: implement domain endpoints.
 */
router.get('/', requirePermissions('documents.view'), (_req, res) => {
  res.json({
    service: 'smartsprout-api',
    module: 'documents',
    state: 'migrated',
  });
});
