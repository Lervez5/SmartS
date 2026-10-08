import { Router } from 'express';
import {
  academicReportController,
  attendanceReportController,
  financialReportController,
  analyticsController,
  exportController,
} from './controller';
import { requireRole, requirePermissions } from '../../middleware/rbac';
import { requireSchoolScope } from '../settings/scope';
import { router as summativeRouter } from './summative';

export const router: Router = Router();

const requireAcademicReport = requirePermissions('reports.academic');
const requireAttendanceReport = requirePermissions('reports.attendance');
const requireFinanceReport = requirePermissions('reports.finance');

router.get('/academic', requireAcademicReport, (req, res, next) => {
  academicReportController(req, res).catch(next);
});

router.get('/attendance', requireAttendanceReport, (req, res, next) => {
  attendanceReportController(req, res).catch(next);
});

router.get('/financial', requireFinanceReport, (req, res, next) => {
  financialReportController(req, res).catch(next);
});

router.get('/analytics', requirePermissions('reports.view'), (req, res, next) => {
  analyticsController(req, res).catch(next);
});

router.post('/export', requirePermissions('reports.export'), (req, res, next) => {
  exportController(req, res).catch(next);
});

/** Summative overview, mounted with the rest of reporting and school-scoped. */
router.use('/', requireSchoolScope(), summativeRouter);
