import { Router } from 'express';
import {
  listCohortsController,
  getCohortController,
  createCohortController,
  updateCohortController,
  deleteCohortController,
  addStudentController,
  removeStudentController,
} from './controller';
import { requireRole, requirePermissions } from '../../middleware/rbac';

export const router: Router = Router();

const requireCohortManage = requirePermissions('cohorts.manage');
const requireCohortView = requirePermissions('cohorts.view');

router.get('/', requireCohortView, (req, res, next) => {
  listCohortsController(req, res).catch(next);
});

router.post('/', requireCohortManage, (req, res, next) => {
  createCohortController(req, res).catch(next);
});

router.get('/:id', requireCohortView, (req, res, next) => {
  getCohortController(req, res).catch(next);
});

router.put('/:id', requireCohortManage, (req, res, next) => {
  updateCohortController(req, res).catch(next);
});

router.delete('/:id', requireCohortManage, (req, res, next) => {
  deleteCohortController(req, res).catch(next);
});

router.post('/:id/students', requirePermissions('students.manage'), (req, res, next) => {
  addStudentController(req, res).catch(next);
});

router.delete(
  '/:id/students/:studentId',
  requirePermissions('students.manage'),
  (req, res, next) => {
    removeStudentController(req, res).catch(next);
  }
);
