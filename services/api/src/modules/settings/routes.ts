import { Router } from 'express';
import {
  getBrandingController,
  getAllController,
  getAreaController,
  updateAreaController,
  getPersonalController,
  updatePersonalController,
} from './controller';
import { requireSchoolScope } from './scope';
import { requirePermissions } from '../../middleware/rbac';
import { asyncHandler } from '../../shared/asyncHandler';

export const router: Router = Router();

/** Personal preferences: the signed-in user's own settings, not the school's. */
router.get('/personal', (req, res, next) => {
  getPersonalController(req, res).catch(next);
});

router.put('/personal', (req, res, next) => {
  updatePersonalController(req, res).catch(next);
});

/**
 * School configuration. The school is resolved from the caller's membership
 * before any permission is evaluated, so an unauthorised or cross-school
 * request is rejected on scope, not on a guessed id.
 */
router.use(requireSchoolScope());

router.get('/branding', asyncHandler(getBrandingController));

router.get('/', requirePermissions('settings.view'), asyncHandler(getAllController));

/**
 * Reads are open to anyone who may see settings; writes are gated per area so
 * an Accountant can manage finance configuration without touching branding.
 */
router.get('/:area', requirePermissions('settings.view'), asyncHandler(getAreaController));

const AREA_PERMISSION = {
  general: 'settings.manage',
  branding: 'settings.manage',
  academic: 'academics.manage',
  finance: 'finance.manage',
  subscription: 'settings.manage',
  notifications: 'settings.manage',
  glow: 'settings.manage',
  security: 'settings.manage',
} as const;

// The area is bound here rather than read from req.params: these routes are
// registered as literal paths (so each can carry its own permission), and
// Express only fills req.params for ":param" segments.
for (const [area, permission] of Object.entries(AREA_PERMISSION)) {
  const boundArea = area as keyof typeof AREA_PERMISSION;
  router.put(
    `/${area}`,
    requirePermissions(permission as never),
    asyncHandler((req, res, next) => updateAreaController(req, res, next, boundArea))
  );
}
