/**
 * Centralized authorization model.
 *
 * Permissions are `domain.action` strings grouped by the domains that actually
 * exist in services/api. Nothing here grants capability the API cannot
 * enforce, and nothing in the UI is expected to hand-roll role checks.
 *
 * Authentication answers WHO. This module answers WHAT.
 */

import type { UserRole } from './roles';

export const PERMISSION_DOMAINS = [
  'users',
  'roles',
  'students',
  'parents',
  'alumni',
  'staff',
  'admissions',
  'academics',
  'learningAreas',
  'curriculum',
  'assessment',
  'progress',
  'attendance',
  'examinations',
  'grading',
  'finance',
  'reports',
  'courses',
  'cohorts',
  'timetable',
  'teaching',
  'calendar',
  'communications',
  'sms',
  'announcements',
  'documents',
  'inventory',
  'library',
  'transport',
  'payroll',
  'expenses',
  'settings',
  'placements',
] as const;

export type PermissionDomain = (typeof PERMISSION_DOMAINS)[number];

export const PERMISSIONS = [
  // Identity and access administration
  'users.view',
  'users.create',
  'users.manage',
  'users.import',
  'users.activate',
  'roles.manage',

  // People
  'students.view',
  'students.manage',
  'parents.view',
  'parents.manage',
  'alumni.view',
  'alumni.manage',
  'staff.view',
  'staff.manage',
  'admissions.view',
  'admissions.manage',

  // Academic delivery
  'academics.view',
  'academics.manage',
  'courses.view',
  'courses.manage',
  'cohorts.view',
  'cohorts.manage',
  'timetable.view',
  'timetable.manage',

  /*
   * Teaching allocation: who is responsible for a stream, and for which
   * learning area, within an academic session. Managing this changes who can
   * reach learners, attendance registers and results, so it is a distinct
   * grant rather than being folded into `academics.manage`, which also covers
   * sessions, streams and curriculum.
   */
  'teaching.view',
  'teaching.manage',

  // Learner Placement: stream reorganization and learner-to-stream assignment
  'placements.view',
  'placements.manage',

  // CBC curriculum: learning areas, strands, sub-strands, outcomes, coverage
  'learningAreas.view',
  'learningAreas.manage',
  'curriculum.view',
  'curriculum.manage',
  'progress.view',
  'progress.manage',

  // CBC assessment workspace
  'assessment.view',
  'assessment.create',
  'assessment.grade',
  'assessment.moderate',
  'assessment.publish',

  // Attendance
  'attendance.view',
  'attendance.mark',
  'attendance.correct',
  // Sees every register in the school, not only the classes they are personally
  // assigned to. Academic administration is a school-wide job, and without this
  // a Dean's register list was scoped by the classes they happen to teach -
  // which for a Dean is usually none at all.
  'attendance.manage',
  'examinations.view',
  'examinations.manage',
  'grading.view',
  'grading.manage',
  'grades.view',
  'grades.manage',

  // Finance
  'finance.view',
  'finance.manage',
  'finance.payments',
  'finance.refunds',
  'finance.reconcile',

  // Reporting
  'reports.view',
  'reports.export',
  'reports.academic',
  'reports.attendance',
  'reports.finance',

  // Communication and scheduling
  'communications.view',
  'communications.send',

  // SMS Centre. Separate from `communications.*` on purpose: that pair governs
  // in-app and announcement messaging, and holding it must not by itself let a
  // role send bulk SMS, read another guardian's financial position, or change
  // automation rules. Each capability below is granted explicitly.
  'sms.view', // open the workspace and read campaign history
  'sms.send', // compose and send a bulk campaign to guardians
  'sms.reminders', // resolve and send balance reminders from the Finance domain
  'sms.manage', // configure automation rules and manage opt-outs
  'sms.credits', // inspect credit status and the provider configuration
  'announcements.view',
  'announcements.manage',
  'calendar.view',
  'calendar.manage',
  'documents.view',
  'documents.manage',

  // School operations
  'inventory.view',
  'inventory.manage',
  'library.view',
  'library.manage',
  'transport.view',
  'transport.manage',
  'payroll.view',
  'payroll.manage',
  'expenses.view',
  'expenses.manage',
  'settings.view',
  'settings.manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const PERMISSION_SET = new Set<string>(PERMISSIONS as readonly string[]);

export function isPermission(value: unknown): value is Permission {
  return typeof value === 'string' && PERMISSION_SET.has(value);
}

export function permissionsForDomain(domain: PermissionDomain): Permission[] {
  return PERMISSIONS.filter((p) => p.startsWith(`${domain}.`));
}

/* ------------------------------------------------------------------ *
 * Role grants
 *
 * Derived from what each role must be able to do in a school, and kept
 * aligned with the domains the API actually serves.
 * ------------------------------------------------------------------ */

const ALL: Permission[] = [...PERMISSIONS];

/**
 * DEAN: academic and CBC oversight. Owns curriculum, teaching, assessment
 * publication, learner progress and academic reporting. Holds no finance
 * operations and no identity administration beyond provisioning accounts.
 */
const ACADEMIC_STAFF: Permission[] = [
  'academics.view',
  'academics.manage',
  'learningAreas.view',
  'learningAreas.manage',
  'grades.view',
  'grades.manage',
  'curriculum.view',
  'curriculum.manage',
  'progress.view',
  'progress.manage',
  'courses.view',
  'courses.manage',
  'cohorts.view',
  'cohorts.manage',
  'timetable.view',
  'timetable.manage',
  'teaching.view',
  'teaching.manage',
  'placements.view',
  'placements.manage',
  'attendance.view',
  'attendance.mark',
  'attendance.correct',
  'attendance.manage',
  'examinations.view',
  'examinations.manage',
  'assessment.view',
  'assessment.create',
  'assessment.grade',
  'assessment.moderate',
  'assessment.publish',
  'grading.view',
  'grading.manage',
  'grades.view',
  'students.view',
  'students.manage',
  'parents.view',
  'admissions.view',
  'admissions.manage',
  'alumni.view',
  'staff.view',
  'calendar.view',
  'calendar.manage',
  'communications.view',
  'communications.send',
  'announcements.view',
  'announcements.manage',
  'documents.view',
  'documents.manage',
  'inventory.view',
  'library.view',
  'transport.view',
  'reports.view',
  'reports.export',
  'reports.academic',
  'reports.attendance',
  'sms.view',
  'sms.send',
  'sms.manage',
  'sms.credits',
  'users.create',
  'users.activate',
  'settings.view',
];

/**
 * ACCOUNTANT: finance. Sees only the learner, parent and staff information
 * needed to bill and reconcile, and no academic operations.
 *
 * Holds `sms.view` and `sms.reminders` so the SMS Centre is reachable for the
 * job that is genuinely theirs - chasing an outstanding balance. It does not
 * hold `sms.send`: composing a broadcast to every guardian in the school is not
 * a finance operation, and the role has no academic or cohort data to choose an
 * audience with. Nor `sms.manage` or `sms.credits`, which are administrative.
 */
const FINANCE_STAFF: Permission[] = [
  'finance.view',
  'finance.manage',
  'finance.payments',
  'finance.refunds',
  'finance.reconcile',
  'expenses.view',
  'expenses.manage',
  'payroll.view',
  'students.view',
  'parents.view',
  'alumni.view',
  'staff.view',
  'reports.view',
  'reports.export',
  'reports.finance',
  'documents.view',
  'documents.manage',
  'calendar.view',
  'communications.view',
  'communications.send',
  'announcements.view',
  'sms.view',
  'sms.reminders',
  'settings.view',
];

/**
 * TEACHER: teaching delivery inside assigned classes. Can mark, grade and
 * publish into their own scope, but cannot moderate or administer identities.
 */
const TEACHER_GRANTS: Permission[] = [
  'students.view',
  'parents.view',
  'academics.view',
  'learningAreas.view',
  'curriculum.view',
  'progress.view',
  'courses.view',
  'courses.manage',
  'cohorts.view',
  'timetable.view',
  'attendance.view',
  'attendance.mark',
  'examinations.view',
  'examinations.manage',
  'assessment.view',
  'assessment.create',
  'assessment.grade',
  'grading.view',
  // Not `grading.manage`. A teacher reads the band rules they mark against, but
  // the bands are the school's official grading configuration: changing them
  // reshapes every result in the school, including ones already recorded. That
  // is academic administration, held by DEAN and SUPER_ADMIN.
  'grades.view',
  'calendar.view',
  'calendar.manage',
  'communications.view',
  'communications.send',
  'announcements.view',
  'documents.view',
  'library.view',
  'reports.view',
  'reports.academic',
];

/**
 * PARENT: child-scoped reads only. Never sees institutional aggregates and
 * never sees another family's learners.
 */
const PARENT_GRANTS: Permission[] = [
  'students.view',
  'attendance.view',
  'academics.view',
  'learningAreas.view',
  'timetable.view',
  'progress.view',
  'assessment.view',
  'grading.view',
  'grades.view',
  'calendar.view',
  'communications.view',
  'announcements.view',
  'documents.view',
  'finance.view',
];

/**
 * STUDENT: own records only. Read-only everywhere, with no finance or
 * identity surface at all.
 */
const STUDENT_GRANTS: Permission[] = [
  'academics.view',
  'learningAreas.view',
  'curriculum.view',
  'courses.view',
  'timetable.view',
  'attendance.view',
  'progress.view',
  'assessment.view',
  'grading.view',
  'grades.view',
  'examinations.view',
  'calendar.view',
  'communications.view',
  'announcements.view',
  'documents.view',
  'library.view',
];

/**
 * Canonical role -> permission grants. The API seeds this table into MongoDB
 * and the frontend uses it to build navigation, so the two can never drift.
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: ALL,
  DEAN: ACADEMIC_STAFF,
  ACCOUNTANT: FINANCE_STAFF,
  TEACHER: TEACHER_GRANTS,
  PARENT: PARENT_GRANTS,
  STUDENT: STUDENT_GRANTS,
};

/** Static grants for a role, for clients that have not yet loaded user data. */
export function permissionsForRole(role: string | null | undefined): Permission[] {
  if (!role) return [];
  const canonical = role.toUpperCase().replace(/[\s-]+/g, '_') as UserRole;
  return ROLE_PERMISSIONS[canonical] ?? [];
}

/* ------------------------------------------------------------------ *
 * Checks
 * ------------------------------------------------------------------ */

export function hasPermission(
  granted: readonly string[] | null | undefined,
  required: Permission
): boolean {
  if (!granted) return false;
  return granted.includes(required);
}

export function hasAnyPermission(
  granted: readonly string[] | null | undefined,
  required: readonly Permission[]
): boolean {
  if (!granted || granted.length === 0) return false;
  return required.some((p) => granted.includes(p));
}

export function hasAllPermissions(
  granted: readonly string[] | null | undefined,
  required: readonly Permission[]
): boolean {
  if (!granted) return false;
  return required.every((p) => granted.includes(p));
}

/**
 * Navigation gating. A module is shown when the user holds any of the
 * permissions it declares, which lets the sidebar be built from metadata
 * instead of role conditionals.
 */
export function canAccessModule(
  granted: readonly string[] | null | undefined,
  required: readonly Permission[]
): boolean {
  if (required.length === 0) return true;
  return hasAnyPermission(granted, required);
}
