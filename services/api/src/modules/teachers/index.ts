import { Router } from 'express';

export const router: Router = Router();

/**
 * teachers module - planned
 * Legacy source: (User role + Class.teacher)
 * TODO: implement domain endpoints.
 */
router.get('/', (_req, res) => {
  res.json({
    service: 'smartsprout-api',
    module: 'teachers',
    state: 'planned',
  });
});
