import { Router } from 'express';
import {
  studentDashboardController,
  teacherDashboardController,
  adminDashboardController,
  parentDashboardController,
} from './controller';
import { requireRole, requirePermissions } from '../../middleware/rbac';

export const router: Router = Router();

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
