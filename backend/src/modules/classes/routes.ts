import { Router } from 'express';
import * as controller from './controller';

export const router = Router();

router.get('/teacher/my-cohorts', controller.getTeacherCohorts);
router.get('/admin/all-cohorts', controller.getAllCohorts);
router.get('/:id', controller.getCohortById);
router.post('/:id/enroll-bulk', controller.enrollBulkStudents);
router.post('/', controller.createCohort);
router.put('/:id', controller.updateCohort);
