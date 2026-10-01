/**
 * Public, unauthenticated display metadata.
 *
 * The sign-in screen runs before a user has a session, so it cannot read
 * `/api/settings/branding` — that route sits behind `requireSchoolScope` and
 * answers 401. This router exposes the same `getPublicBranding` projection with
 * no guard, because the login page needs the school's name, logo and curriculum
 * to render correctly.
 *
 * The projection is deliberately narrow. It returns display values only —
 * name, logo, colours, portal naming, curriculum and the configured academic
 * session. It must never grow to include configuration, contact details, finance
 * policy, security policy or any user data. A change to `getPublicBranding` in
 * services/api/src/modules/settings/service.ts is therefore a security-relevant
 * change and should be reviewed as one.
 */

import { Router } from 'express';
import { asyncHandler } from '../../shared/asyncHandler';
import { getSignInBranding, resolveFirstActiveSchool } from '../settings/service';

export const router: Router = Router();

router.get(
  '/branding',
  asyncHandler(async (_req, res) => {
    // Single-tenant deployment: the platform provisions one school, so the
    // first active school is the one on the sign-in screen. A multi-tenant
    // deployment would resolve this from the request host instead.
    const school = await resolveFirstActiveSchool();
    if (!school) {
      res.status(404).json({ error: { message: 'No school is configured' } });
      return;
    }
    res.json(await getSignInBranding(school.id));
  })
);
