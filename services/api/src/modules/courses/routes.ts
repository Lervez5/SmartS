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
import { requirePermissions } from '../../middleware/rbac';
import { requireSchoolScope } from '../settings/scope';

export const router: Router = Router();

// Courses belong to one school, and every controller now scopes through it.
// Without this the scope cannot be resolved at all, which would fail every route
// rather than silently widen them.
router.use(requireSchoolScope());

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

// Recording a lesson as completed is course work, so it is gated on the same
// course permission as reading one. It previously had no guard at all, which let
// any authenticated user log completion against any lesson.
router.post('/:id/lessons/:lessonId/complete', requireCourseView, (req, res, next) => {
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
