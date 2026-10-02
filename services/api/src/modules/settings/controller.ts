import { Request, Response } from 'express';
import { isSettingsArea } from './types';
import { schoolScopeOf } from './scope';
import {
  getSettings,
  getAllSettings,
  getPublicBranding,
  updateSettings,
  getPersonalSettings,
  updatePersonalSettings,
} from './service';

/**
 * The small payload the portal chrome needs on every page load.
 *
 * Deliberately separate from GET /settings, which returns every configuration
 * area: the shell only needs a name and a logo, and pulling the whole set on
 * each navigation is what made the sidebar feel slow to settle.
 */
/**
 * Branding, for a signed-in administrator.
 *
 * Returns the full branding area in the same `{ settings }` envelope every
 * other area uses, so the settings screens can treat all eight uniformly.
 *
 * It previously returned the narrower `getPublicBranding` projection directly,
 * which made this the only area answering with a flat object — and the
 * `SettingsSection` component, which reads `body.settings`, rendered the whole
 * Branding screen empty even though values were saved. The shell and the
 * sign-in screens, which only need a name and a logo, read `/api/public/branding`
 * or unwrap `settings` themselves.
 */
export async function getBrandingController(req: Request, res: Response): Promise<void> {
  const scope = schoolScopeOf(req);
  res.json(await getSettings('branding', scope.schoolId));
}

export async function getAllController(req: Request, res: Response): Promise<void> {
  const scope = schoolScopeOf(req);
  res.json({ school: scope, areas: await getAllSettings(scope.schoolId) });
}

export async function getAreaController(req: Request, res: Response): Promise<void> {
  const scope = schoolScopeOf(req);
  const { area } = req.params;

  if (!isSettingsArea(area)) {
    res.status(404).json({ error: { message: `Unknown settings area "${area}"` } });
    return;
  }
  res.json(await getSettings(area, scope.schoolId));
}

export async function updateAreaController(
  req: Request,
  res: Response,
  _next?: (err?: unknown) => void,
  explicitArea?: string
): Promise<void> {
  const scope = schoolScopeOf(req);
  const area = explicitArea ?? req.params.area;

  if (!isSettingsArea(area)) {
    res.status(404).json({ error: { message: `Unknown settings area "${area}"` } });
    return;
  }
  res.json(await updateSettings(req.user!.id, scope.schoolId, scope.schoolName, area, req.body));
}

export async function getPersonalController(req: Request, res: Response): Promise<void> {
  res.json({ settings: await getPersonalSettings(req.user!.id) });
}

export async function updatePersonalController(req: Request, res: Response): Promise<void> {
  res.json(await updatePersonalSettings(req.user!.id, req.body));
}
