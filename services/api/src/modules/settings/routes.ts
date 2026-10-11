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
import { isSettingsArea, type SettingsArea } from './types';
import type { Permission } from '@schoolos/auth/permissions';
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

/**
 * Write permission per settings area.
 *
 * `notifications` accepts `sms.manage` as well as `settings.manage`, because that
 * is where the SMS channel, the provider and the sender ID are configured - and
 * the role that manages SMS (the DEAN) must be able to save them. Every other
 * area stays on a single permission, so this exception does not become a general
 * widening: finance configuration is still `finance.manage`, academic
 * configuration still `academics.manage`, and the rest still `settings.manage`,
 * which only a Super Admin holds.
 */
const AREA_PERMISSION: Record<SettingsArea, Permission[]> = {
  general: ['settings.manage'],
  branding: ['settings.manage'],
  academic: ['academics.manage'],
  finance: ['finance.manage'],
  subscription: ['settings.manage'],
  notifications: ['settings.manage', 'sms.manage'],
  glow: ['settings.manage'],
  security: ['settings.manage'],
};

// The area is bound here rather than read from req.params: these routes are
// registered as literal paths (so each can carry its own permission), and
// Express only fills req.params for ":param" segments.
for (const [area, permissions] of Object.entries(AREA_PERMISSION) as Array<
  [SettingsArea, Permission[]]
>) {
  router.put(
    `/${area}`,
    // Spread, because an area may accept more than one permission and
    // requirePermissions applies them as OR.
    requirePermissions(...permissions),
    asyncHandler((req, res, next) => updateAreaController(req, res, next, area))
  );
}
