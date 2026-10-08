import { Router } from 'express';
import { requireAuth } from './middleware/auth';

import { router as authRouter } from './modules/auth';
import { router as usersRouter } from './modules/users';
import { router as invitationsRouter } from './modules/invitations';
import { router as studentsRouter } from './modules/students';
import { router as alumniRouter } from './modules/alumni';
import { router as parentsRouter } from './modules/parents';
import { router as teachersRouter } from './modules/teachers';
import { router as staffRouter } from './modules/staff';
import { router as admissionsRouter } from './modules/admissions';
import { router as academicsRouter } from './modules/academics';
import { router as academicSessionsRouter } from './modules/academic-sessions';
import { router as streamsRouter } from './modules/academics/streams';
import { router as resultsEntryRouter } from './modules/academics/results-entry';
import { router as teacherAllocationRouter } from './modules/academics/allocation/routes';
import { router as classesRouter } from './modules/classes';
import { router as subjectsRouter } from './modules/subjects';
import { router as attendanceRouter } from './modules/attendance';
import { router as examinationsRouter } from './modules/examinations';
import { router as gradingRouter } from './modules/grading';
import { router as lmsRouter } from './modules/lms';
import { router as financeRouter } from './modules/finance';
import { router as expensesRouter } from './modules/expenses';
import { router as payrollRouter } from './modules/payroll';
import { router as transportRouter } from './modules/transport';
import { router as libraryRouter } from './modules/library';
import { router as inventoryRouter } from './modules/inventory';
import { router as communicationRouter } from './modules/communication';
import { router as notificationsRouter } from './modules/notifications';
import { router as documentsRouter } from './modules/documents';
import { router as reportsRouter } from './modules/reports';

import { router as dashboardRouter } from './modules/dashboard';
import { router as coursesRouter } from './modules/courses';
import { router as cohortsRouter } from './modules/cohorts';
import { router as calendarRouter } from './modules/calendar';
import { router as reportingRouter } from './modules/reporting';
import { router as auditLogsRouter } from './modules/audit-logs';
import { router as rolesRouter } from './modules/roles';
import { router as settingsRouter } from './modules/settings';
import { router as publicRouter } from './modules/public';
import { router as uploadsRouter } from './modules/uploads';
import { router as attendanceRegistersRouter } from './modules/attendance/registers';
export const router: Router = Router();

router.use('/auth', authRouter);
router.use('/invitations', invitationsRouter);

// Mounted before requireAuth: the sign-in screen has no session yet and still
// needs the school name, logo and academic session to render.
router.use('/public', publicRouter);

// The raw body parser for this path is registered in app.ts before the JSON one.
router.use('/uploads', uploadsRouter);
router.use(requireAuth);

// Registers live under the attendance module, so they mount with it and are
// therefore behind requireAuth like every other protected route.
router.use('/attendance', attendanceRegistersRouter);

router.use('/users', usersRouter);
router.use('/students', studentsRouter);
router.use('/alumni', alumniRouter);
router.use('/parents', parentsRouter);
router.use('/teachers', teachersRouter);
router.use('/staff', staffRouter);
router.use('/admissions', admissionsRouter);
router.use('/academics', academicsRouter);
router.use('/classes', classesRouter);
router.use('/subjects', subjectsRouter);
router.use('/attendance', attendanceRouter);
router.use('/examinations', examinationsRouter);
router.use('/grading', gradingRouter);
router.use('/lms', lmsRouter);
router.use('/finance', financeRouter);
router.use('/expenses', expensesRouter);
router.use('/payroll', payrollRouter);
router.use('/transport', transportRouter);
router.use('/library', libraryRouter);
router.use('/inventory', inventoryRouter);
router.use('/communication', communicationRouter);
router.use('/notifications', notificationsRouter);
router.use('/documents', documentsRouter);
router.use('/dashboard', dashboardRouter);
router.use('/courses', coursesRouter);
router.use('/cohorts', cohortsRouter);
router.use('/calendar', calendarRouter);
router.use('/reporting', reportingRouter);
router.use('/audit-logs', auditLogsRouter);
router.use('/roles', rolesRouter);
router.use('/settings', settingsRouter);
router.use('/academic-sessions', academicSessionsRouter);
router.use('/streams', streamsRouter);
router.use('/results-entry', resultsEntryRouter);
router.use('/teacher-allocation', teacherAllocationRouter);

router.use('/reports', reportsRouter);
