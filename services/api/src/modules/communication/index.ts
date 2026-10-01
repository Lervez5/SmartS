import { Router } from 'express';
import { requirePermissions } from '../../middleware/rbac';

export const router: Router = Router();

/**
 * communication module - migrated
 * Legacy source: modules/messages
 * TODO: implement domain endpoints.
 */
router.get('/', requirePermissions('communications.view'), (_req, res) => {
  res.json({
    service: 'smartsprout-api',
    module: 'communication',
    state: 'migrated',
  });
});
