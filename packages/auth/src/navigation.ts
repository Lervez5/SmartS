/**
 * Central navigation registry.
 *
 * Every sidebar, quick action, primary action and breadcrumb in all four
 * portals is derived from this one table. A portal is never allowed to grow a
 * hand-rolled `if (role === "DEAN")` branch: an entry declares what it needs,
 * and `visibleSections` / `visibleQuickActions` decide what a given identity
 * actually sees.
 *
 * Two rules keep this honest:
 *
 *  1. `permissions` is the ONLY gate. Frontend hiding is a UX affordance, not
 *     a security boundary - the API independently enforces every one of these
 *     capabilities on each request.
 *  2. `implemented: false` marks a CBC concept that has navigation and routing
 *     but no backend yet. Those pages render an explicit "not yet available"
 *     state instead of pretending to have data. See `CBC_GAPS` at the bottom.
 */

import type { Permission } from './permissions';
import type { AppId, UserRole } from './roles';

/** A section groups related items in the sidebar. */
export interface NavSection {
  id: string;
  label: string;
  /** Any one of these grants is sufficient for the section to appear. */
  permissions: Permission[];
  items: NavItem[];
}

export interface NavItem {
  /** Stable identifier. Used as a React key and by tests; never localized. */
  id: string;
  label: string;
  /** Route relative to the portal root, e.g. "/admin/users". */
  href: string;
  /**
   * Permission gate. An item is visible when the identity holds ANY of these.
   * An empty list means the item is visible to every signed-in user of the
   * portal (e.g. "Dashboard").
   */
  permissions: Permission[];
  /**
   * Optional second gate: restrict to specific roles. Needed where a route is
   * shared but the label or meaning is not, such as the admin Dashboard which
   * is a different page for SUPER_ADMIN and for ACCOUNTANT.
   */
  roles?: UserRole[];
  /** Lucide icon name, resolved by the shell's icon map. */
  icon?: string;
  /** Sort order within the section. Lower first. */
  order?: number;
  /**
   * False when the backend capability does not exist yet. The route still
   * resolves so the sidebar is honest about the shape of the platform, but the
   * page shows a documented gap rather than fabricated data.
   */
  implemented?: boolean;
  /** Short note rendered on the gap state explaining what is missing. */
  gap?: string;
}

/** An entry in the `+ Quick Actions` menu. */
export interface QuickAction {
  id: string;
  label: string;
  href: string;
  permissions: Permission[];
  icon?: string;
  roles?: UserRole[];
  group: 'create' | 'record' | 'engage' | 'review';
  implemented?: boolean;
  gap?: string;
}

/** The contextual primary action rendered at the top of a module screen. */
export interface PrimaryAction {
  id: string;
  label: string;
  href: string;
  permissions: Permission[];
  icon?: string;
  roles?: UserRole[];
  implemented?: boolean;
  gap?: string;
}

/* ------------------------------------------------------------------ *
 * Student portal - the learner's own experience
 * ------------------------------------------------------------------ */

const STUDENT_NAV: NavSection[] = [
  {
    id: 'overview',
    label: 'Overview',
    permissions: [],
    items: [
      {
        id: 'stu.dashboard',
        label: 'Dashboard',
        href: '/dashboard',
        permissions: [],
        icon: 'layout-dashboard',
        order: 1,
      },
      {
        id: 'stu.profile',
        label: 'My Profile',
        href: '/profile',
        permissions: [],
        icon: 'user-round',
        order: 2,
      },
    ],
  },
  {
    id: 'learning',
    label: 'My Learning',
    permissions: ['courses.view', 'learningAreas.view'],
    items: [
      {
        id: 'stu.classes',
        label: 'My Classes',
        href: '/dashboard/classes',
        permissions: ['cohorts.view', 'courses.view'],
        icon: 'users-round',
        order: 1,
      },
      {
        id: 'stu.learning-areas',
        label: 'Learning Areas',
        href: '/dashboard/learning-areas',
        permissions: ['learningAreas.view'],
        icon: 'shapes',
        order: 2,
        implemented: false,
        gap: 'GET /api/learning-areas is not implemented. The LearningArea model does not exist in the Prisma schema.',
      },
      {
        id: 'stu.courses',
        label: 'Courses',
        href: '/dashboard/student/courses',
        permissions: ['courses.view'],
        icon: 'book-open',
        order: 3,
      },
      {
        id: 'stu.resources',
        label: 'Learning Resources',
        href: '/dashboard/resources',
        permissions: ['courses.view', 'library.view'],
        icon: 'library',
        order: 4,
        implemented: false,
        gap: 'GET /api/courses/:id/lessons/:lessonId and lesson listing for a student are not implemented.',
      },
    ],
  },
  {
    id: 'assignments',
    label: 'Assignments',
    permissions: ['examinations.view', 'courses.view'],
    items: [
      {
        id: 'stu.assignments',
        label: 'Assignments',
        href: '/dashboard/assignments',
        permissions: ['examinations.view', 'courses.view'],
        icon: 'clipboard-list',
        order: 1,
        implemented: false,
        gap: 'No assignment listing route exists. The Assignment model is populated by the dashboard service only.',
      },
    ],
  },
  {
    id: 'assessment',
    label: 'Assessment',
    permissions: ['assessment.view', 'grades.view', 'grading.view'],
    items: [
      {
        id: 'stu.assessment',
        label: 'My Assessment',
        href: '/dashboard/assessment',
        permissions: ['assessment.view', 'grades.view'],
        icon: 'clipboard-check',
        order: 1,
        implemented: false,
        gap: 'GET /api/assessment is not implemented. There is no Assessment model; scores live on Grade/ExamAttempt/Submission.',
      },
      {
        id: 'stu.competencies',
        label: 'Competencies',
        href: '/dashboard/competencies',
        permissions: ['progress.view', 'grading.view'],
        icon: 'badge-check',
        order: 2,
        implemented: false,
        gap: 'No Competency or CompetencyLevel model exists. SchoolAcademicSettings.enableCompetencyFramework is configuration only.',
      },
      {
        id: 'stu.progress',
        label: 'Learning Progress',
        href: '/dashboard/progress',
        permissions: ['progress.view'],
        icon: 'trending-up',
        order: 3,
        implemented: false,
        gap: 'GET /api/progress is not implemented. CourseEnrollment.progress exists but has no learner-progress report endpoint.',
      },
    ],
  },
  {
    id: 'attendance',
    label: 'Attendance & Schedule',
    permissions: ['attendance.view', 'timetable.view', 'calendar.view'],
    items: [
      {
        id: 'stu.attendance',
        label: 'My Attendance',
        href: '/dashboard/attendance/me',
        permissions: ['attendance.view'],
        icon: 'calendar-check',
        order: 1,
      },
      {
        id: 'stu.timetable',
        label: 'Timetable',
        href: '/dashboard/timetable',
        permissions: ['timetable.view'],
        icon: 'calendar-days',
        order: 2,
        implemented: false,
        gap: 'ClassSchedule rows exist but no timetable route aggregates them for a student.',
      },
      {
        id: 'stu.calendar',
        label: 'School Calendar',
        href: '/dashboard/calendar',
        permissions: ['calendar.view'],
        icon: 'calendar',
        order: 3,
      },
    ],
  },
  {
    id: 'communication',
    label: 'Communication',
    permissions: ['announcements.view', 'communications.view'],
    items: [
      {
        id: 'stu.announcements',
        label: 'Announcements',
        href: '/dashboard/announcements',
        permissions: ['announcements.view'],
        icon: 'megaphone',
        order: 1,
        implemented: false,
        gap: 'No Announcement model. Announcements exist only as a notification event key in src/modules/notifications/index.ts:27.',
      },
      {
        id: 'stu.messages',
        label: 'Messages',
        href: '/dashboard/messages',
        permissions: ['communications.view'],
        icon: 'message-square',
        order: 2,
        implemented: false,
        gap: 'GET /api/communication is a stub returning { state: "migrated" }. The Message model has no route.',
      },
    ],
  },
  {
    id: 'more',
    label: 'More',
    permissions: ['reports.view', 'documents.view'],
    items: [
      {
        id: 'stu.reports',
        label: 'My Reports',
        href: '/dashboard/reports',
        permissions: ['reports.view'],
        icon: 'file-bar-chart',
        order: 1,
        implemented: false,
        gap: 'GET /api/reports is a stub. Reporting requires reports.academic which a student does not hold.',
      },
      {
        id: 'stu.documents',
        label: 'Documents',
        href: '/dashboard/documents',
        permissions: ['documents.view'],
        icon: 'folder-open',
        order: 2,
        implemented: false,
        gap: 'GET /api/documents is a stub returning { state: "migrated" }.',
      },
      {
        id: 'stu.settings',
        label: 'Settings',
        href: '/settings',
        permissions: [],
        icon: 'settings',
        order: 3,
      },
    ],
  },
];

/* ------------------------------------------------------------------ *
 * Teacher portal - teaching delivery
 * ------------------------------------------------------------------ */

const TEACHER_NAV: NavSection[] = [
  {
    id: 'overview',
    label: 'Overview',
    permissions: [],
    items: [
      {
        id: 'tea.dashboard',
        label: 'Dashboard',
        href: '/dashboard',
        permissions: [],
        icon: 'layout-dashboard',
        order: 1,
      },
      {
        id: 'tea.profile',
        label: 'My Profile',
        href: '/profile',
        permissions: [],
        icon: 'user-round',
        order: 2,
      },
    ],
  },
  {
    id: 'teaching',
    label: 'Teaching & Learning',
    permissions: ['courses.view', 'cohorts.view'],
    items: [
      {
        id: 'tea.classes',
        label: 'My Classes',
        href: '/dashboard/classes',
        permissions: ['cohorts.view'],
        icon: 'users-round',
        order: 1,
      },
      {
        id: 'tea.learning-areas',
        label: 'Learning Areas',
        href: '/dashboard/learning-areas',
        permissions: ['learningAreas.view'],
        icon: 'shapes',
        order: 2,
        implemented: false,
        gap: 'GET /api/learning-areas is not implemented. Teachers currently see Subjects via GET /api/subjects, which has no RBAC guard.',
      },
      {
        id: 'tea.courses',
        label: 'Courses',
        href: '/dashboard/teacher/courses',
        permissions: ['courses.view'],
        icon: 'book-open',
        order: 3,
      },
      {
        id: 'tea.assignments',
        label: 'Assignments',
        href: '/dashboard/assignments',
        permissions: ['examinations.view', 'courses.view'],
        icon: 'clipboard-list',
        order: 4,
        implemented: false,
        gap: 'No assignment listing route exists for a teacher.',
      },
      {
        id: 'tea.resources',
        label: 'Learning Resources',
        href: '/dashboard/resources',
        permissions: ['courses.view', 'library.view', 'documents.view'],
        icon: 'library',
        order: 5,
        implemented: false,
        gap: 'Lesson and unit listing is not exposed; only POST /api/courses/:id/lessons/:lessonId/complete exists.',
      },
    ],
  },
  {
    id: 'curriculum',
    label: 'CBC Curriculum',
    permissions: ['curriculum.view', 'learningAreas.view'],
    items: [
      {
        id: 'tea.curriculum',
        label: 'Curriculum Explorer',
        href: '/dashboard/curriculum',
        permissions: ['curriculum.view'],
        icon: 'git-branch',
        order: 1,
        implemented: false,
        gap: 'No Strand, SubStrand or LearningOutcome model exists. The curriculum hierarchy has no backend.',
      },
      {
        id: 'tea.coverage',
        label: 'Curriculum Coverage',
        href: '/dashboard/curriculum/coverage',
        permissions: ['curriculum.view'],
        icon: 'pie-chart',
        order: 2,
        implemented: false,
        gap: 'No CurriculumCoverage model and no coverage computation route.',
      },
    ],
  },
  {
    id: 'assessment',
    label: 'Assessment',
    permissions: ['assessment.view', 'grading.view', 'examinations.view'],
    items: [
      {
        id: 'tea.assessment',
        label: 'Assessments',
        href: '/dashboard/assessment',
        permissions: ['assessment.view', 'examinations.view'],
        icon: 'clipboard-check',
        order: 1,
        implemented: false,
        gap: 'GET /api/assessment is not implemented. Assessments surface as /api/examinations, which is a different concept.',
      },
      {
        id: 'tea.grading',
        label: 'Grading',
        href: '/dashboard/grading',
        permissions: ['grading.view', 'grading.manage'],
        icon: 'pen-line',
        order: 2,
        implemented: false,
        gap: 'GET /api/grading is a stub returning { state: "planned" }. Submission grading has no route.',
      },
      {
        id: 'tea.learner-progress',
        label: 'Learner Progress',
        href: '/dashboard/progress',
        permissions: ['progress.view'],
        icon: 'trending-up',
        order: 3,
        implemented: false,
        gap: 'GET /api/progress is not implemented.',
      },
    ],
  },
  {
    id: 'learners',
    label: 'Learners',
    permissions: ['students.view'],
    items: [
      {
        id: 'tea.learners',
        label: 'My Learners',
        href: '/dashboard/learners',
        permissions: ['students.view', 'cohorts.view'],
        icon: 'graduation-cap',
        order: 1,
        implemented: false,
        gap: 'GET /api/students returns all students with no class scoping. A teacher-scoped roster route does not exist.',
      },
    ],
  },
  {
    id: 'operations',
    label: 'Attendance & Schedule',
    permissions: ['attendance.view', 'timetable.view', 'calendar.view'],
    items: [
      {
        id: 'tea.attendance',
        label: 'Mark Attendance',
        href: '/dashboard/attendance/class',
        permissions: ['attendance.mark'],
        icon: 'clipboard-check',
        order: 1,
      },
      {
        id: 'tea.timetable',
        label: 'Timetable',
        href: '/dashboard/timetable',
        permissions: ['timetable.view'],
        icon: 'calendar-days',
        order: 2,
        implemented: false,
        gap: 'ClassSchedule rows exist but no timetable route aggregates them for a teacher.',
      },
      {
        id: 'tea.calendar',
        label: 'School Calendar',
        href: '/dashboard/calendar',
        permissions: ['calendar.view'],
        icon: 'calendar',
        order: 3,
      },
    ],
  },
  {
    id: 'communication',
    label: 'Communication',
    permissions: ['announcements.view', 'communications.view'],
    items: [
      {
        id: 'tea.announcements',
        label: 'Announcements',
        href: '/dashboard/announcements',
        permissions: ['announcements.view'],
        icon: 'megaphone',
        order: 1,
        implemented: false,
        gap: 'No Announcement model exists.',
      },
      {
        id: 'tea.messages',
        label: 'Messages',
        href: '/dashboard/messages',
        permissions: ['communications.view'],
        icon: 'message-square',
        order: 2,
        implemented: false,
        gap: 'GET /api/communication is a stub; the Message model has no route.',
      },
    ],
  },
  {
    id: 'more',
    label: 'More',
    permissions: ['reports.view', 'documents.view', 'library.view'],
    items: [
      {
        id: 'tea.reports',
        label: 'Reports',
        href: '/dashboard/reports',
        permissions: ['reports.academic', 'reports.view'],
        icon: 'file-bar-chart',
        order: 1,
        implemented: false,
        gap: 'GET /api/reports is a stub. The working reporting module is /api/reporting.',
      },
      {
        id: 'tea.library',
        label: 'Library',
        href: '/dashboard/library',
        permissions: ['library.view'],
        icon: 'library',
        order: 2,
        implemented: false,
        gap: 'GET /api/library exists but is not reachable from the teacher portal.',
      },
      {
        id: 'tea.settings',
        label: 'Settings',
        href: '/settings',
        permissions: [],
        icon: 'settings',
        order: 3,
      },
    ],
  },
];

/* ------------------------------------------------------------------ *
 * Parent portal - linked children only
 * ------------------------------------------------------------------ */

const PARENT_NAV: NavSection[] = [
  {
    id: 'overview',
    label: 'Overview',
    permissions: [],
    items: [
      {
        id: 'par.dashboard',
        label: 'Dashboard',
        href: '/dashboard',
        permissions: [],
        icon: 'layout-dashboard',
        order: 1,
      },
      {
        id: 'par.profile',
        label: 'My Profile',
        href: '/profile',
        permissions: [],
        icon: 'user-round',
        order: 2,
      },
    ],
  },
  {
    id: 'children',
    label: 'My Children',
    permissions: ['students.view'],
    items: [
      {
        id: 'par.children',
        label: 'My Children',
        href: '/dashboard/children',
        permissions: ['students.view'],
        icon: 'graduation-cap',
        order: 1,
      },
      {
        id: 'par.learning-progress',
        label: 'Learning Progress',
        href: '/dashboard/progress',
        permissions: ['progress.view'],
        icon: 'trending-up',
        order: 2,
        implemented: false,
        gap: 'GET /api/progress is not implemented. The parent dashboard service returns recentGrades but no per-child progress report.',
      },
      {
        id: 'par.competencies',
        label: 'Competencies & Results',
        href: '/dashboard/competencies',
        permissions: ['grading.view', 'progress.view'],
        icon: 'badge-check',
        order: 3,
        implemented: false,
        gap: 'No Competency model exists. CBC competency reporting is unimplemented.',
      },
    ],
  },
  {
    id: 'attendance',
    label: 'Attendance & Schedule',
    permissions: ['attendance.view', 'timetable.view', 'calendar.view'],
    items: [
      {
        id: 'par.attendance',
        label: 'Attendance',
        href: '/dashboard/attendance',
        permissions: ['attendance.view'],
        icon: 'calendar-check',
        order: 1,
      },
      {
        id: 'par.timetable',
        label: 'Timetable',
        href: '/dashboard/timetable',
        permissions: ['timetable.view'],
        icon: 'calendar-days',
        order: 2,
        implemented: false,
        gap: 'ClassSchedule rows exist but no timetable route aggregates them for a parent.',
      },
      {
        id: 'par.calendar',
        label: 'School Calendar',
        href: '/dashboard/calendar',
        permissions: ['calendar.view'],
        icon: 'calendar',
        order: 3,
      },
    ],
  },
  {
    id: 'assessment',
    label: 'Assessment',
    permissions: ['assessment.view', 'grades.view'],
    items: [
      {
        id: 'par.assessment',
        label: 'Assessment Results',
        href: '/dashboard/assessment',
        permissions: ['assessment.view', 'grades.view'],
        icon: 'clipboard-check',
        order: 1,
        implemented: false,
        gap: 'GET /api/assessment is not implemented. The parent dashboard returns recentGrades instead.',
      },
      {
        id: 'par.assignments',
        label: 'Assignments',
        href: '/dashboard/assignments',
        permissions: ['communications.view'],
        icon: 'clipboard-list',
        order: 2,
        implemented: false,
        gap: 'No assignment route exists for a parent.',
      },
    ],
  },
  {
    id: 'finance',
    label: 'Fees & Payments',
    permissions: ['finance.view'],
    items: [
      {
        id: 'par.invoices',
        label: 'Invoices',
        href: '/dashboard/finance/invoices',
        permissions: ['finance.view'],
        icon: 'receipt',
        order: 1,
        implemented: false,
        gap: 'GET /api/finance/invoices is not parent-scoped: it returns every invoice the caller can read with no child filter.',
      },
      {
        id: 'par.payments',
        label: 'Payments',
        href: '/dashboard/finance/payments',
        permissions: ['finance.view'],
        icon: 'credit-card',
        order: 2,
        implemented: false,
        gap: 'No /api/finance/payments or /api/finance/receipts route exists. A payment is a Receipt row.',
      },
    ],
  },
  {
    id: 'communication',
    label: 'Communication',
    permissions: ['announcements.view', 'communications.view'],
    items: [
      {
        id: 'par.announcements',
        label: 'Announcements',
        href: '/dashboard/announcements',
        permissions: ['announcements.view'],
        icon: 'megaphone',
        order: 1,
        implemented: false,
        gap: 'No Announcement model exists.',
      },
      {
        id: 'par.messages',
        label: 'Messages',
        href: '/dashboard/messages',
        permissions: ['communications.view'],
        icon: 'message-square',
        order: 2,
        implemented: false,
        gap: 'GET /api/communication is a stub; the Message model has no route.',
      },
    ],
  },
  {
    id: 'more',
    label: 'More',
    permissions: ['reports.view', 'documents.view'],
    items: [
      {
        id: 'par.reports',
        label: 'Reports',
        href: '/dashboard/reports',
        permissions: ['reports.view'],
        icon: 'file-bar-chart',
        order: 1,
        implemented: false,
        gap: 'GET /api/reports is a stub.',
      },
      {
        id: 'par.documents',
        label: 'Documents',
        href: '/dashboard/documents',
        permissions: ['documents.view'],
        icon: 'folder-open',
        order: 2,
        implemented: false,
        gap: 'GET /api/documents is a stub.',
      },
      {
        id: 'par.settings',
        label: 'Settings',
        href: '/settings',
        permissions: [],
        icon: 'settings',
        order: 3,
      },
    ],
  },
];

/* ------------------------------------------------------------------ *
 * Admin portal - shared by SUPER_ADMIN, DEAN and ACCOUNTANT.
 *
 * The three roles hold disjoint permission sets, so the same table produces
 * three genuinely different navigation experiences without role branching.
 * ------------------------------------------------------------------ */

const ADMIN_NAV: NavSection[] = [
  {
    id: 'overview',
    label: 'Overview',
    permissions: [],
    items: [
      {
        id: 'adm.dashboard',
        label: 'Dashboard',
        href: '/admin',
        permissions: [],
        icon: 'layout-dashboard',
        order: 1,
      },
      {
        id: 'adm.profile',
        label: 'My Profile',
        href: '/profile',
        permissions: [],
        icon: 'user-round',
        order: 2,
      },
    ],
  },
  {
    /**
     * People: the school's human population, in the order an administrator
     * works through it — current learners, those joining, those who have left,
     * their guardians, daily presence, then staff.
     *
     * Attendance moved in here from its own single-item section. It is a
     * property of a learner on a given day, so grouping it with the people it
     * describes reads better than a separate top-level entry — and it keeps one
     * "People" group rather than splitting the population across two headings.
     */
    id: 'people',
    label: 'People',
    permissions: ['students.view', 'alumni.view', 'attendance.view', 'staff.view'],
    items: [
      {
        id: 'adm.learners',
        label: 'Active Learners',
        href: '/admin/students',
        permissions: ['students.view'],
        icon: 'graduation-cap',
        order: 1,
      },
      {
        id: 'adm.admissions',
        label: 'Enrollment Hub',
        href: '/admin/admissions',
        permissions: ['admissions.view'],
        icon: 'clipboard-list',
        order: 2,
        implemented: false,
        gap: 'GET /api/admissions is a stub returning a planned placeholder. The AdmissionApplication model exists in the Prisma schema but has no route, so applications cannot be created, reviewed or enrolled.',
      },
      {
        id: 'adm.alumni',
        label: 'Alumni Office',
        href: '/admin/alumni',
        permissions: ['alumni.view'],
        icon: 'archive',
        order: 3,
        implemented: false,
        gap: 'No alumni domain exists at all: no Alumni/Alumnus model, no graduation-on-leaver state on StudentProfile, and no /api/alumni module. This needs a model, a leaver workflow on the student record, and a read route before the screen can show anything.',
      },
      {
        id: 'adm.parents',
        label: 'Parents',
        href: '/admin/parents',
        permissions: ['parents.view'],
        icon: 'users',
        order: 4,
        implemented: false,
        gap: 'GET /api/parents is a stub returning a planned placeholder. ParentProfile and ParentChildLink exist in the schema but have no route.',
      },
      {
        id: 'adm.attendance',
        label: 'Attendance',
        href: '/admin/attendance',
        permissions: ['attendance.view'],
        icon: 'calendar-check',
        order: 5,
        implemented: false,
        gap: 'GET /api/attendance/reports exists and is permission-gated, but no admin screen consumes it and there is no school-wide class list to scope a register by. Only per-class marking (POST /api/attendance/mark) and /roster/:classId are implemented.',
      },
      {
        id: 'adm.staff',
        label: 'School Staff',
        href: '/admin/staff',
        permissions: ['staff.view'],
        icon: 'user-round',
        order: 6,
        implemented: false,
        gap: 'GET /api/staff exists and is permission-gated, but /admin/staff is still a placeholder rather than a table bound to it.',
      },
    ],
  },
  {
    id: 'curriculum',
    label: 'CBC Academics',
    permissions: ['curriculum.view', 'academics.view', 'learningAreas.view'],
    items: [
      {
        id: 'adm.progress',
        label: 'Learner Progress Reports',
        href: '/admin/progress',
        permissions: ['progress.view'],
        icon: 'trending-up',
        order: 4,
        implemented: false,
        gap: 'GET /api/progress is not implemented. There is no Progress model and no CBC learner-progress report route.',
      },
      {
        id: 'adm.curriculum',
        label: 'Curriculum Structure',
        href: '/admin/academics/curriculum',
        permissions: ['curriculum.view'],
        icon: 'git-branch',
        order: 2,
        implemented: false,
        gap: 'No Strand, SubStrand or LearningOutcome model exists.',
      },
      {
        id: 'adm.coverage',
        label: 'Curriculum Coverage',
        href: '/admin/academics/coverage',
        permissions: ['curriculum.view'],
        icon: 'pie-chart',
        order: 3,
        implemented: false,
        gap: 'No CurriculumCoverage model and no coverage computation route.',
      },
      {
        id: 'adm.classes',
        label: 'Classes',
        href: '/admin/classes',
        permissions: ['cohorts.view'],
        icon: 'users-round',
        order: 4,
      },
    ],
  },
  {
    id: 'teaching',
    label: 'Teaching & Learning',
    permissions: ['courses.view', 'staff.view'],
    items: [
      {
        id: 'adm.courses',
        label: 'Courses',
        href: '/admin/courses',
        permissions: ['courses.view'],
        icon: 'book-open',
        order: 1,
      },
      {
        id: 'adm.timetable',
        label: 'Timetable',
        href: '/admin/timetable',
        permissions: ['timetable.view'],
        icon: 'calendar-days',
        order: 2,
        implemented: false,
        gap: 'ClassSchedule rows exist but no school-wide timetable route aggregates them.',
      },
    ],
  },
  {
    /**
     * Summative assessment.
     *
     * Ordered the way a summative cycle is actually run: set the paper
     * (Overview), sit the tests, record and publish results, report on them,
     * map them to learning areas, then grade.
     *
     * Items point at real routes wherever one exists. `Results` reuses
     * /admin/examinations, which is the only examination data the API serves,
     * rather than introducing a second examinations screen. `Tests` and
     * `Reports` have no route and get an explicit gap until they are built.
     */
    id: 'summative',
    label: 'Summative Assessment',
    permissions: ['assessment.view', 'examinations.view', 'grading.view'],
    items: [
      {
        id: 'adm.assessment',
        label: 'Overview',
        href: '/admin/assessment',
        permissions: ['assessment.view', 'examinations.view'],
        icon: 'clipboard-check',
        order: 1,
        implemented: false,
        gap: 'GET /api/assessment is not implemented. /api/examinations covers examinations only, so there is no summative assessment overview to aggregate from.',
      },
      {
        id: 'adm.assessment.tests',
        label: 'Tests',
        href: '/admin/assessment/tests',
        permissions: ['assessment.view', 'examinations.view'],
        icon: 'file-text',
        order: 2,
        implemented: false,
        gap: 'No test-paper domain exists. There is no Test/Paper model, no question bank, and no route to author or schedule a summative paper. /api/examinations records attempts against an already-defined assessment; it does not define the paper.',
      },
      {
        id: 'adm.assessment.results',
        label: 'Results',
        href: '/admin/examinations',
        permissions: ['examinations.view', 'grading.view'],
        icon: 'list-checks',
        order: 3,
      },
      {
        id: 'adm.assessment.reports',
        label: 'Reports',
        href: '/admin/assessment/reports',
        permissions: ['assessment.view', 'reports.academic'],
        icon: 'file-bar-chart',
        order: 4,
        implemented: false,
        gap: 'GET /api/reporting exists but has no summative-assessment report. General reporting lives under Reports & Analytics; this screen would cover per-assessment analysis, rank order and grade distribution.',
      },
      {
        id: 'adm.assessment.learning-areas',
        label: 'Learning Areas',
        href: '/admin/academics/learning-areas',
        permissions: ['learningAreas.view'],
        icon: 'shapes',
        order: 5,
        implemented: false,
        gap: 'GET /api/learning-areas is not implemented. No LearningArea model exists, so a summative paper cannot yet be mapped to the learning areas it assesses.',
      },
      {
        id: 'adm.grading',
        label: 'Grading',
        href: '/admin/grading',
        permissions: ['grading.view'],
        icon: 'scale',
        order: 6,
        implemented: false,
        gap: 'GET /api/grading is a stub. Rubrics are a free-text field on Assignment and Submission.rubricScores is an untyped Json blob, so there is no grading workspace to drive.',
      },
    ],
  },
  {
    /**
     * Finance.
     *
     * Ordered as the money moves: what was paid, what was billed, what is still
     * owed, then the instruments that adjust a bill. Only Invoices has a working
     * endpoint today; the rest state their missing dependency rather than
     * showing an empty table.
     *
     * Balances Registry sits at /admin/finance because that is the accountant's
     * landing route, and a per-learner receivables ledger is what an accountant
     * opens it for.
     */
    id: 'finance',
    label: 'Finance',
    permissions: ['finance.view'],
    items: [
      {
        id: 'adm.finance.payments',
        label: 'Payments',
        href: '/admin/finance/payments',
        permissions: ['finance.payments'],
        icon: 'credit-card',
        order: 1,
        implemented: false,
        gap: 'A payment is a Receipt row, and the Receipt model exists with method, paidBy and receivedAt, but there is no /api/finance/payments or /api/finance/receipts route. Recording and listing payments both have to be built.',
      },
      {
        id: 'adm.finance.invoices',
        label: 'Invoices',
        href: '/admin/finance/invoices',
        permissions: ['finance.view'],
        icon: 'receipt',
        order: 2,
      },
      {
        id: 'adm.finance.balances',
        label: 'Balances Registry',
        href: '/admin/finance',
        permissions: ['finance.view'],
        icon: 'scale',
        order: 3,
      },
      {
        id: 'adm.finance.credit-notes',
        label: 'Credit Notes',
        href: '/admin/finance/credit-notes',
        permissions: ['finance.manage'],
        icon: 'file-minus',
        order: 4,
        implemented: false,
        gap: 'No CreditNote model exists. SchoolFinanceSettings.creditNotesEnabled is configuration only, and there is no route to raise, number or apply a credit note against an invoice.',
      },
      {
        id: 'adm.finance.refunds',
        label: 'Refunds',
        href: '/admin/finance/refunds',
        permissions: ['finance.refunds'],
        icon: 'undo-2',
        order: 5,
        implemented: false,
        gap: 'No Refund model exists. SchoolFinanceSettings.refundsEnabled is configuration only, and a refund would have to reference both the original Receipt and the Invoice it reverses.',
      },
    ],
  },
  {
    /**
     * Reports.
     *
     * Both items point at real endpoints: GET /api/reporting/financial and
     * /api/reporting/attendance run actual Prisma aggregates and are gated by
     * reports.finance and reports.attendance respectively, so an ACCOUNTANT
     * sees Financial Reports and a DEAN sees both, purely from permissions.
     */
    id: 'reporting',
    label: 'Reports',
    permissions: ['reports.view'],
    items: [
      {
        id: 'adm.reports.financial',
        label: 'Financial Reports',
        href: '/admin/reports/financial',
        permissions: ['reports.finance'],
        icon: 'wallet',
        order: 1,
      },
      {
        id: 'adm.reports.attendance',
        label: 'Attendance Reports',
        href: '/admin/reports/attendance',
        permissions: ['reports.attendance'],
        icon: 'calendar-check',
        order: 2,
      },
    ],
  },
  {
    id: 'communication',
    label: 'Communication',
    permissions: ['communications.view', 'announcements.view'],
    items: [
      {
        id: 'adm.announcements',
        label: 'Announcements',
        href: '/admin/announcements',
        permissions: ['announcements.view'],
        icon: 'megaphone',
        order: 1,
        implemented: false,
        gap: 'No Announcement model exists.',
      },
      {
        id: 'adm.communication',
        label: 'Messages',
        href: '/admin/communication',
        permissions: ['communications.view'],
        icon: 'message-square',
        order: 2,
        implemented: false,
        gap: 'GET /api/communication is a stub; the Message model has no route.',
      },
    ],
  },
  {
    id: 'resources',
    label: 'Resources',
    permissions: ['library.view', 'inventory.view', 'transport.view'],
    items: [
      {
        id: 'adm.library',
        label: 'Library',
        href: '/admin/library',
        permissions: ['library.view'],
        icon: 'library',
        order: 1,
      },
      {
        id: 'adm.inventory',
        label: 'Inventory',
        href: '/admin/inventory',
        permissions: ['inventory.view'],
        icon: 'package',
        order: 2,
        implemented: false,
        gap: 'GET /api/inventory is a stub returning { state: "planned" }. The Asset model has no route.',
      },
      {
        id: 'adm.transport',
        label: 'Transport',
        href: '/admin/transport',
        permissions: ['transport.view'],
        icon: 'bus',
        order: 3,
      },
      {
        id: 'adm.documents',
        label: 'Documents',
        href: '/admin/documents',
        permissions: ['documents.view'],
        icon: 'folder-open',
        order: 4,
        implemented: false,
        gap: 'GET /api/documents is a stub returning { state: "migrated" }.',
      },
    ],
  },
  {
    /**
     * Administration.
     *
     * CBC terminology: a school runs on *academic sessions* (formerly academic
     * years and terms), allocates *teachers* to classes and learning areas,
     * moves *learners* between grades at a transition, and groups learners by
     * grade and stream. Those are the operating levers, so they sit together
     * ahead of the identity and configuration surfaces.
     *
     * Absorbs the old Configuration section: School Configuration is the last
     * item here rather than a separate one-item heading.
     */
    id: 'administration',
    label: 'Administration',
    permissions: [
      'academics.view',
      'users.view',
      'users.create',
      'roles.manage',
      'users.import',
      'settings.view',
    ],
    items: [
      {
        id: 'adm.academic-sessions',
        label: 'Academic Sessions',
        href: '/admin/academics/years',
        permissions: ['academics.view'],
        icon: 'calendar-range',
        order: 1,
        implemented: false,
        gap: 'No AcademicYear or Term model exists. SchoolAcademicSettings.currentAcademicYearId is a free-text string with no target collection, so sessions and terms cannot be listed, created or closed.',
      },
      {
        id: 'adm.teacher-allocation',
        label: 'Teacher Allocation',
        href: '/admin/academics/teacher-allocation',
        permissions: ['staff.view', 'courses.manage'],
        icon: 'user-round-check',
        order: 2,
        implemented: false,
        gap: 'Allocation is representable — Class.teacherId and Course.teacherId both point at User — but there is no route to read or reassign them. GET /api/subjects has no RBAC guard, so a scoped allocation view has to be built before this screen is safe.',
      },
      {
        id: 'adm.student-transitions',
        label: 'Student Transitions',
        href: '/admin/academics/student-transitions',
        permissions: ['students.manage'],
        icon: 'arrow-right-left',
        order: 3,
        implemented: false,
        gap: 'No promotion or transfer workflow exists. StudentProfile.gradeLevel is a free-text string, SchoolAcademicSettings.promotionRule is an unapplied string, and there is no route that moves a learner between classes or closes a session.',
      },
      {
        id: 'adm.grades',
        label: 'Grades',
        href: '/admin/academics/grades',
        permissions: ['academics.view'],
        icon: 'layers',
        order: 4,
        implemented: false,
        gap: 'No Grade model exists. Grade is a fixed Prisma enum, while StudentProfile.gradeLevel and Class.gradeLevel are free-text strings, so grades cannot be listed, ordered or renamed.',
      },
      {
        id: 'adm.streams',
        label: 'Streams',
        href: '/admin/academics/streams',
        permissions: ['academics.view'],
        icon: 'split',
        order: 5,
        implemented: false,
        gap: 'No Stream model exists. A CBC school groups learners by stream within a grade, so this needs a Stream entity with a parent Grade before enrolment can record it.',
      },
      {
        id: 'adm.sms',
        label: 'SMS Centre',
        href: '/admin/sms',
        permissions: ['communications.send', 'settings.manage'],
        icon: 'message-square',
        order: 6,
        implemented: false,
        gap: 'SMS is configuration only. SchoolNotificationSettings stores smsEnabled, smsProvider and smsSenderId, and the notifications module can name the sms channel, but no SMS provider is integrated and there is no route to send a message or read delivery reports.',
      },
      {
        id: 'adm.roles',
        label: 'Roles & Permissions',
        href: '/admin/roles',
        permissions: ['roles.manage'],
        icon: 'shield-check',
        order: 7,
      },
      {
        id: 'adm.settings',
        label: 'School Configuration',
        href: '/admin/settings/general',
        permissions: ['settings.view'],
        icon: 'settings',
        order: 8,
      },
    ],
  },
];

/* ------------------------------------------------------------------ *
 * Registry
 * ------------------------------------------------------------------ */

export const NAVIGATION: Record<AppId, NavSection[]> = {
  student: STUDENT_NAV,
  teacher: TEACHER_NAV,
  parent: PARENT_NAV,
  admin: ADMIN_NAV,
};

/** Quick actions per portal, filtered by the identity's permissions. */
export const QUICK_ACTIONS: Record<AppId, QuickAction[]> = {
  student: [
    {
      id: 'stu.qa.assignments',
      label: 'View Assignments',
      href: '/dashboard/assignments',
      permissions: ['examinations.view'],
      icon: 'clipboard-list',
      group: 'review',
      implemented: false,
      gap: 'No assignment listing route exists.',
    },
    {
      id: 'stu.qa.progress',
      label: 'My Progress',
      href: '/dashboard/progress',
      permissions: ['progress.view'],
      icon: 'trending-up',
      group: 'review',
      implemented: false,
      gap: 'GET /api/progress is not implemented.',
    },
    {
      id: 'stu.qa.calendar',
      label: 'School Calendar',
      href: '/dashboard/calendar',
      permissions: ['calendar.view'],
      icon: 'calendar',
      group: 'engage',
    },
    {
      id: 'stu.qa.messages',
      label: 'Message a Teacher',
      href: '/dashboard/messages',
      permissions: ['communications.view'],
      icon: 'message-square',
      group: 'engage',
      implemented: false,
      gap: 'GET /api/communication is a stub.',
    },
  ],
  teacher: [
    {
      id: 'tea.qa.assignment',
      label: 'New Assignment',
      href: '/dashboard/assignments/new',
      permissions: ['courses.manage'],
      icon: 'clipboard-list',
      group: 'create',
      implemented: false,
      gap: 'The Assignment model exists but has no create route.',
    },
    {
      id: 'tea.qa.assessment',
      label: 'New Assessment',
      href: '/dashboard/assessment/new',
      permissions: ['assessment.create'],
      icon: 'clipboard-check',
      group: 'create',
      implemented: false,
      gap: 'No Assessment model or create route exists.',
    },
    {
      id: 'tea.qa.attendance',
      label: 'Mark Attendance',
      href: '/dashboard/attendance/class',
      permissions: ['attendance.mark'],
      icon: 'calendar-check',
      group: 'record',
    },
    {
      id: 'tea.qa.grade',
      label: 'Grade Submissions',
      href: '/dashboard/grading',
      permissions: ['grading.manage'],
      icon: 'pen-line',
      group: 'review',
      implemented: false,
      gap: 'GET /api/grading is a stub; Submission grading has no route.',
    },
    {
      id: 'tea.qa.message',
      label: 'Message Learners',
      href: '/dashboard/messages',
      permissions: ['communications.send'],
      icon: 'message-square',
      group: 'engage',
      implemented: false,
      gap: 'GET /api/communication is a stub.',
    },
    {
      id: 'tea.qa.report',
      label: 'Academic Report',
      href: '/dashboard/reports',
      permissions: ['reports.academic'],
      icon: 'file-bar-chart',
      group: 'review',
      implemented: false,
      gap: 'GET /api/reports is a stub; the working module is /api/reporting.',
    },
  ],
  parent: [
    {
      id: 'par.qa.children',
      label: 'My Children',
      href: '/dashboard/children',
      permissions: ['students.view'],
      icon: 'graduation-cap',
      group: 'review',
    },
    {
      id: 'par.qa.invoices',
      label: 'View Invoices',
      href: '/dashboard/finance/invoices',
      permissions: ['finance.view'],
      icon: 'receipt',
      group: 'record',
      implemented: false,
      gap: 'GET /api/finance/invoices is not parent-scoped.',
    },
    {
      id: 'par.qa.attendance',
      label: 'Attendance',
      href: '/dashboard/attendance',
      permissions: ['attendance.view'],
      icon: 'calendar-check',
      group: 'review',
    },
    {
      id: 'par.qa.message',
      label: 'Message School',
      href: '/dashboard/messages',
      permissions: ['communications.view'],
      icon: 'message-square',
      group: 'engage',
      implemented: false,
      gap: 'GET /api/communication is a stub.',
    },
  ],
  admin: [
    {
      id: 'adm.qa.user',
      label: 'Create User',
      href: '/admin/users/new',
      permissions: ['users.create'],
      icon: 'user-plus',
      group: 'create',
      implemented: false,
      gap: 'POST /api/users exists but has no form screen.',
    },
    {
      id: 'adm.qa.invite',
      label: 'Invite User',
      href: '/admin/invitations',
      permissions: ['users.create'],
      icon: 'mail-plus',
      group: 'create',
    },
    {
      id: 'adm.qa.learner',
      label: 'Add Learner',
      href: '/admin/students/new',
      permissions: ['students.manage'],
      icon: 'graduation-cap',
      group: 'create',
      implemented: false,
      gap: 'POST /api/students exists but has no form screen.',
    },
    {
      id: 'adm.qa.assessment',
      label: 'New Assessment',
      href: '/admin/assessment/new',
      permissions: ['assessment.create'],
      icon: 'clipboard-check',
      group: 'create',
      implemented: false,
      gap: 'No Assessment model or create route exists.',
    },
    {
      id: 'adm.qa.payment',
      label: 'Record Payment',
      href: '/admin/finance/payments',
      permissions: ['finance.payments'],
      icon: 'credit-card',
      group: 'record',
      implemented: false,
      gap: 'No /api/finance/payments route exists.',
    },
    {
      id: 'adm.qa.invoice',
      label: 'Create Invoice',
      href: '/admin/finance/invoices',
      permissions: ['finance.manage'],
      icon: 'receipt',
      group: 'record',
    },
    {
      id: 'adm.qa.report',
      label: 'Generate Report',
      href: '/admin/reports',
      permissions: ['reports.export'],
      icon: 'file-bar-chart',
      group: 'review',
      implemented: false,
      gap: 'POST /api/reporting/export exists but the /admin/reports screen is a stub.',
    },
    {
      id: 'adm.qa.announce',
      label: 'Send Announcement',
      href: '/admin/announcements',
      permissions: ['communications.send'],
      icon: 'megaphone',
      group: 'engage',
      implemented: false,
      gap: 'POST /api/notifications/send exists; no announcement screen consumes it.',
    },
  ],
};

/**
 * Contextual primary action per module. A module screen renders this instead of
 * a hard-coded button so the affordance always matches the caller's grants.
 */
export const PRIMARY_ACTIONS: Record<string, PrimaryAction> = {
  '/admin/users': {
    id: 'pa.users',
    label: 'New User',
    href: '/admin/users/new',
    permissions: ['users.create'],
    icon: 'user-plus',
    implemented: false,
    gap: 'POST /api/users exists but has no form screen.',
  },
  '/admin/students': {
    id: 'pa.students',
    label: 'Add Learner',
    href: '/admin/students/new',
    permissions: ['students.manage'],
    icon: 'user-plus',
    implemented: false,
    gap: 'POST /api/students exists but has no form screen.',
  },
  '/admin/invitations': {
    id: 'pa.invitations',
    label: 'Invite User',
    href: '/admin/invitations/new',
    permissions: ['users.create'],
    icon: 'mail-plus',
    implemented: false,
    gap: 'POST /api/invitations exists but has no form screen.',
  },
  '/admin/finance/invoices': {
    id: 'pa.invoices',
    label: 'Create Invoice',
    href: '/admin/finance/invoices/new',
    permissions: ['finance.manage'],
    icon: 'receipt',
  },
  '/admin/finance/payments': {
    id: 'pa.payments',
    label: 'Record Payment',
    href: '/admin/finance/payments/new',
    permissions: ['finance.payments'],
    icon: 'credit-card',
    implemented: false,
    gap: 'No /api/finance/payments route exists.',
  },
  '/admin/assessment': {
    id: 'pa.admin.assessment',
    label: 'New Assessment',
    href: '/admin/assessment/new',
    permissions: ['assessment.create'],
    icon: 'clipboard-check',
    implemented: false,
    gap: 'No Assessment model or create route exists.',
  },
  '/admin/finance': {
    id: 'pa.finance',
    label: 'Create Invoice',
    href: '/admin/finance/invoices/new',
    permissions: ['finance.manage'],
    icon: 'receipt',
  },
  '/admin/library': {
    id: 'pa.library',
    label: 'Add Book',
    href: '/admin/library/new',
    permissions: ['library.manage'],
    icon: 'plus',
    implemented: false,
    gap: 'POST /api/library exists but has no form screen.',
  },
  '/admin/transport': {
    id: 'pa.transport',
    label: 'Add Route',
    href: '/admin/transport/new',
    permissions: ['transport.manage'],
    icon: 'plus',
    implemented: false,
    gap: 'POST /api/transport exists but has no form screen.',
  },
  '/admin/classes': {
    id: 'pa.classes',
    label: 'New Class',
    href: '/admin/classes/new',
    permissions: ['cohorts.manage'],
    icon: 'plus',
  },
  '/dashboard/attendance/class': {
    id: 'pa.attendance',
    label: 'Mark Attendance',
    href: '/dashboard/attendance/class',
    permissions: ['attendance.mark'],
    icon: 'calendar-check',
  },
  '/dashboard/assessment': {
    id: 'pa.assessment',
    label: 'New Assessment',
    href: '/dashboard/assessment/new',
    permissions: ['assessment.create'],
    icon: 'clipboard-check',
    implemented: false,
    gap: 'No Assessment model or create route exists.',
  },
  '/dashboard/assignments': {
    id: 'pa.assignments',
    label: 'New Assignment',
    href: '/dashboard/assignments/new',
    permissions: ['courses.manage', 'assessment.create'],
    icon: 'clipboard-list',
    implemented: false,
    gap: 'The Assignment model exists but has no create route.',
  },
  '/dashboard/student/courses': {
    id: 'pa.courses',
    label: 'Browse Courses',
    href: '/dashboard/student/courses',
    permissions: ['courses.view'],
    icon: 'book-open',
  },
};

/* ------------------------------------------------------------------ *
 * Derivation
 * ------------------------------------------------------------------ */

function roleAllows(roles: UserRole[] | undefined, role: UserRole | undefined): boolean {
  if (!roles || roles.length === 0) return true;
  if (!role) return false;
  return roles.includes(role);
}

function grantsAny(
  granted: readonly string[] | null | undefined,
  required: readonly Permission[]
): boolean {
  if (required.length === 0) return true;
  if (!granted || granted.length === 0) return false;
  return required.some((p) => granted.includes(p));
}

export interface NavItemLike {
  id: string;
  label: string;
  href: string;
  permissions: Permission[];
  roles?: UserRole[];
  icon?: string;
  order?: number;
  implemented?: boolean;
  gap?: string;
}

export interface NavSectionResult {
  id: string;
  label: string;
  items: NavItemLike[];
}

/**
 * Resolve the sections an identity may see in a portal. Sections with no
 * visible items are dropped so a role never sees a dangling group header.
 */
export function visibleSections(
  app: AppId,
  granted: readonly string[] | null | undefined,
  role?: UserRole | null
): NavSectionResult[] {
  const sections = NAVIGATION[app] ?? [];
  const out: NavSectionResult[] = [];

  for (const section of sections) {
    const items = section.items
      .filter((item) => grantsAny(granted, item.permissions))
      .filter((item) => roleAllows(item.roles, role ?? undefined))
      .sort((a, b) => (a.order ?? 100) - (b.order ?? 100));

    if (items.length > 0) out.push({ id: section.id, label: section.label, items });
  }

  return out;
}

/** Flat list of the items an identity may see, in sidebar order. */
export function visibleNavItems(
  app: AppId,
  granted: readonly string[] | null | undefined,
  role?: UserRole | null
): NavItemLike[] {
  return visibleSections(app, granted, role).flatMap((s) => s.items);
}

/** Quick actions available to an identity in a portal. */
export function visibleQuickActions(
  app: AppId,
  granted: readonly string[] | null | undefined,
  role?: UserRole | null
): QuickAction[] {
  const actions = QUICK_ACTIONS[app] ?? [];
  return actions
    .filter((a) => grantsAny(granted, a.permissions))
    .filter((a) => roleAllows(a.roles, role ?? undefined));
}

/**
 * The contextual primary action for a module screen, or null when the caller
 * lacks the permission or the module declares none.
 */
export function primaryActionFor(
  path: string,
  granted: readonly string[] | null | undefined,
  role?: UserRole | null
): PrimaryAction | null {
  const action = PRIMARY_ACTIONS[path];
  if (!action) return null;
  if (!grantsAny(granted, action.permissions)) return null;
  if (!roleAllows(action.roles, role ?? undefined)) return null;
  return action;
}

/** True when the caller may see at least one entry in the sidebar. */
export function hasAnyNavigation(
  app: AppId,
  granted: readonly string[] | null | undefined,
  role?: UserRole | null
): boolean {
  return visibleNavItems(app, granted, role).length > 0;
}

/**
 * The account settings route for a portal.
 *
 * Derived from the registry rather than hardcoded per component. The user menu
 * needs a settings link, and the admin portal serves it at `/admin/settings`
 * while the other three serve `/settings` — a single `/settings` default sent
 * admin users to a route that does not exist, which the portal middleware then
 * redirected to the sign-in page.
 *
 * Scanning the registry means adding or moving a settings entry updates every
 * link automatically.
 */
export function settingsHrefFor(
  app: AppId,
  granted: readonly string[] | null | undefined,
  role?: UserRole | null
): string {
  const items = visibleNavItems(app, granted, role);
  const settings = items.find((item) => item.id.endsWith('.settings'));
  return settings?.href ?? '/';
}

/**
 * CBC concepts the platform is designed to carry but whose backend does not
 * exist yet. Surfaced in the implementation report and reused by the gap
 * screens so the UI can state precisely what is missing.
 */
export const CBC_GAPS: ReadonlyArray<{ concept: string; missing: string }> = [
  {
    concept: 'Learning Area',
    missing: 'No LearningArea model. Subject is the closest analogue and has no RBAC guard.',
  },
  {
    concept: 'Strand / Sub-strand',
    missing: 'No Strand or SubStrand model anywhere in the schema.',
  },
  {
    concept: 'Learning Outcome',
    missing: 'No LearningOutcome model. Course.learningObjectives is a free-text array.',
  },
  {
    concept: 'Competency / Competency Level',
    missing: 'No Competency model. SchoolAcademicSettings.competencyLevels is a JSON string.',
  },
  {
    concept: 'Curriculum Coverage',
    missing: 'No CurriculumCoverage model and no coverage computation route.',
  },
  {
    concept: 'Assessment (formative / summative / performance task)',
    missing: 'No Assessment model. Assignment and Examination are the only assessment carriers.',
  },
  {
    concept: 'Rubric',
    missing:
      'Assignment.rubric is a free-text String; Submission.rubricScores is an untyped Json blob.',
  },
  {
    concept: 'Evidence / Portfolio',
    missing: 'No Evidence or Portfolio model. Only SchoolAcademicSettings boolean flags exist.',
  },
  {
    concept: 'Grading scale',
    missing: 'No GradeScale model. Grade.scale is a Prisma enum with three fixed values.',
  },
  {
    concept: 'Academic Year / Term',
    missing:
      'No AcademicYear or Term model. SchoolAcademicSettings.currentAcademicYearId is a dangling string.',
  },
  {
    concept: 'Grade / Level',
    missing:
      'No Grade model. StudentProfile.gradeLevel and Class.gradeLevel are free-text strings.',
  },
  {
    concept: 'Values',
    missing:
      'No curriculum Values entity. School.motto/vision/mission exist but are not curriculum-scoped.',
  },
  {
    concept: 'Learner Progress Report',
    missing: 'No progress report model or route. CourseEnrollment.progress is the only signal.',
  },
];
