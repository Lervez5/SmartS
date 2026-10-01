import { Router } from 'express';

export const router: Router = Router();

/**
 * grading module - planned
 * Legacy source: none
 * TODO: implement domain endpoints.
 */
router.get('/', (_req, res) => {
  res.json({ service: 'smartsprout-api', module: 'grading', state: 'planned' });
});
