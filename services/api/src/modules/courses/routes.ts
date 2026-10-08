import { Router } from 'express';
import {
  listCoursesController,
  getCourseController,
  createCourseController,
  updateCourseController,
  deleteCourseController,
  myCoursesController,
  completeLessonController,
  listClassesController,
  getClassController,
  createClassController,
  addScheduleController,
  removeScheduleController,
} from './controller';
import { requireRole, requirePermissions } from '../../middleware/rbac';

export const router: Router = Router();

const requireCourseManage = requirePermissions('courses.manage');
const requireCourseView = requirePermissions('courses.view');

router.get('/student/my-courses', requireCourseView, (req, res, next) => {
  myCoursesController(req, res).catch(next);
});

router.get('/', requireCourseView, (req, res, next) => {
  listCoursesController(req, res).catch(next);
});

router.post('/', requireCourseManage, (req, res, next) => {
  createCourseController(req, res).catch(next);
});

router.put('/:id', requireCourseManage, (req, res, next) => {
  updateCourseController(req, res).catch(next);
});

router.delete('/:id', requireCourseManage, (req, res, next) => {
  deleteCourseController(req, res).catch(next);
});

router.post('/:id/lessons/:lessonId/complete', (req, res, next) => {
  completeLessonController(req, res).catch(next);
});

router.get('/classes', requirePermissions('cohorts.view'), (req, res, next) => {
  listClassesController(req, res).catch(next);
});

router.get('/classes/:id', requirePermissions('cohorts.view'), (req, res, next) => {
  getClassController(req, res).catch(next);
});

router.post('/classes', requireCourseManage, (req, res, next) => {
  createClassController(req, res).catch(next);
});

router.post('/classes/:id/schedules', requireCourseManage, (req, res, next) => {
  addScheduleController(req, res).catch(next);
});

router.delete('/classes/schedules/:scheduleId', requireCourseManage, (req, res, next) => {
  removeScheduleController(req, res).catch(next);
});
