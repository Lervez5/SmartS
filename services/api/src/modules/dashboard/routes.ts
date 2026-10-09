import { Router } from 'express';
import {
  studentDashboardController,
  teacherDashboardController,
  adminDashboardController,
  parentDashboardController,
} from './controller';
import { requireRole, requirePermissions } from '../../middleware/rbac';
import { requireSchoolScope } from '../settings/scope';

export const router: Router = Router();

// Every controller below resolves the caller's school, which is what keeps the
// aggregates to that school rather than the whole database.
router.use(requireSchoolScope());

router.get('/student', requireRole('STUDENT'), (req, res, next) => {
  studentDashboardController(req, res).catch(next);
});

router.get('/teacher', requireRole('TEACHER'), (req, res, next) => {
  teacherDashboardController(req, res).catch(next);
});

router.get('/admin', requirePermissions('users.view'), (req, res, next) => {
  adminDashboardController(req, res).catch(next);
});

router.get('/parent', requireRole('PARENT'), (req, res, next) => {
  parentDashboardController(req, res).catch(next);
});
