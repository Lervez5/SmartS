'use client';

import * as React from 'react';
import { useApi } from '@schoolos/hooks';
import { useAuth } from '@schoolos/auth';
import {
  ActionButtons,
  Button,
  ContextFilterBar,
  DashboardCard,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  FloatingFormModal,
  Input,
  LoadingState,
  SectionHeader,
  Select,
  StatusPill,
  TextInput,
  notify,
  type ContextFilter,
  type DataTableColumn,
  type StatusTone,
} from '@schoolos/ui';

/**
 * Enrollment Hub - the school's front door for people.
 *
 * Three ways a person arrives here, and all three end in the same place:
 *
 *   Applications - one learner at a time, reviewed and then placed. Used when
 *     the school decides before on-boarding, as with an applicant who has to be
 *     interviewed.
 *   Bulk Enroll - a whole set of people at once: learners, their guardians and
 *     the staff who will teach them, together or one category at a time. Used
 *     when the school has already decided, as with a roster from a Excel export.
 *   History - what each bulk run created, so an import can be checked rather
 *     than trusted.
 *
 * A learner placed either way gets an `Enrollment`, and every other category
 * gets its own profile. All of them are Users, so nothing here invents a
 * second kind of person.
 */

type UserRole = 'SUPER_ADMIN' | 'ACCOUNTANT' | 'DEAN' | 'TEACHER' | 'PARENT' | 'STUDENT';

type AdmissionStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn' | 'enrolled';

type EntryStatus = 'pending' | 'enrolled' | 'duplicate' | 'failed';

const PROFILE_KIND: Record<UserRole, 'student' | 'parent' | 'staff'> = {
  STUDENT: 'student',
  PARENT: 'parent',
  SUPER_ADMIN: 'staff',
  ACCOUNTANT: 'staff',
  DEAN: 'staff',
  TEACHER: 'staff',
};

const ROLE_LABEL: Record<UserRole, string> = {
  STUDENT: 'Student',
  PARENT: 'Parent / guardian',
  TEACHER: 'Teacher',
  DEAN: 'Dean',
  ACCOUNTANT: 'Accountant',
  SUPER_ADMIN: 'Super admin',
};

/** What each role's profile needs, so the form asks for the right things. */
const ROLE_HINT: Record<UserRole, string> = {
  STUDENT: 'Placed into a class or grade. A class is optional at import.',
  PARENT: 'A guardian account. Guardian links to learners are made by email.',
  TEACHER: 'A staff record. Class placement comes later, from teacher allocation.',
  DEAN: 'A staff record. Holds academic oversight permissions.',
  ACCOUNTANT: 'A staff record. Holds finance permissions.',
  SUPER_ADMIN: 'A staff record. Full system administration.',
};

const ROLES: UserRole[] = ['STUDENT', 'TEACHER', 'PARENT', 'DEAN', 'ACCOUNTANT', 'SUPER_ADMIN'];

/**
 * Column order for CSV import.
 *
 * Only `email` is required. Everything else is optional and role-dependent, so
 * a staff roster can leave `grade_level` blank and a learner roster can leave
 * `employee_id` blank - both are the same file.
 */
const CSV_COLUMNS = [
  'email',
  'role',
  'first_name',
  'last_name',
  'phone',
  'grade_level',
  'class_code',
  'stream_code',
  'academic_year',
  'date_of_birth',
  'gender',
  'admission_number',
  'parent_email',
  'employee_id',
  'position',
  'department',
  'hire_date',
] as const;

type CsvColumn = (typeof CSV_COLUMNS)[number];

interface ParentSummary {
  id: string | null;
  userId: string | null;
  name: string | null;
  email: string | null;
}

interface ApplicationRecord {
  id: string;
  status: AdmissionStatus;
  appliedAt: string;
  reviewedAt: string | null;
  notes: string | null;
  applicant: {
    studentProfileId: string;
    userId: string | null;
    name: string;
    email: string | null;
    phone: string | null;
    avatar: string | null;
    accountStatus: string | null;
    gradeLevel: string | null;
    dateOfBirth: string | null;
    gender: string | null;
    parents: ParentSummary[];
  };
}

interface OverviewResponse {
  summary: {
    total: number;
    byStatus: Record<AdmissionStatus, number>;
    awaitingDecision: number;
  };
  classes: Array<{
    id: string;
    name: string;
    classCode: string | null;
    gradeLevel: string | null;
    academicYearId: string | null;
    streams: Array<{
      id: string;
      name: string;
      code: string;
      capacity: number | null;
      status: string;
    }>;
  }>;
  academicYears: Array<{
    id: string;
    name: string;
    label: string | null;
    status: string;
    startDate: string;
    endDate: string;
  }>;
}

interface ApplicationsResponse {
  applications: ApplicationRecord[];
}

interface BatchEntryRecord {
  id: string;
  rowNumber: number;
  role: UserRole;
  profileKind: 'student' | 'parent' | 'staff';
  status: EntryStatus;
  email: string;
  name: string;
  phone: string | null;
  gradeLevel: string | null;
  classId: string | null;
  streamId: string | null;
  academicYearId: string | null;
  parentEmail: string | null;
  employeeId: string | null;
  position: string | null;
  department: string | null;
  userId: string | null;
  error: string | null;
}

interface BatchRecord {
  id: string;
  schoolId: string;
  status: 'draft' | 'completed' | 'abandoned';
  source: string | null;
  notes: string | null;
  createdById: string | null;
  createdAt: string;
  counts: {
    total: number;
    enrolled: number;
    duplicate: number;
    failed: number;
    pending: number;
  };
  entries: BatchEntryRecord[];
}

interface BatchesResponse {
  batches: BatchRecord[];
}

const STATUS_TONE: Record<AdmissionStatus, StatusTone> = {
  pending: 'warning',
  accepted: 'info',
  enrolled: 'success',
  rejected: 'danger',
  withdrawn: 'neutral',
};

const STATUS_LABEL: Record<AdmissionStatus, string> = {
  pending: 'Awaiting review',
  accepted: 'Accepted',
  enrolled: 'Enrolled',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

const ENTRY_TONE: Record<EntryStatus, StatusTone> = {
  pending: 'warning',
  enrolled: 'success',
  duplicate: 'info',
  failed: 'danger',
};

const ENTRY_LABEL: Record<EntryStatus, string> = {
  pending: 'Pending',
  enrolled: 'Enrolled',
  duplicate: 'Already exists',
  failed: 'Failed',
};

const ACCOUNT_TONE: Record<string, StatusTone> = {
  active: 'success',
  pending: 'info',
  suspended: 'danger',
  archived: 'neutral',
};

type Tab = 'applications' | 'bulk' | 'history';

function formatDate(value?: string | null): string {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Reads the operator-facing message out of an API error envelope. */
async function errorMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  return body?.error?.message ?? `${fallback} (HTTP ${res.status})`;
}

function sessionLabel(year: { name: string; label: string | null }): string {
  return year.label ? `${year.name} - ${year.label}` : year.name;
}

/**
 * Reads a role out of an operator's text.
 *
 * Accepts what a spreadsheet actually contains - `Teacher`, `teacher`,
 * `class teacher` - because a roster typed by a registrar will not match an enum
 * spelling. Family words are accepted too: "class teacher" is a TEACHER.
 */
function normaliseRole(value: string): UserRole | null {
  const key = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (!key) return null;
  if ((ROLES as string[]).includes(key)) return key as UserRole;
  const map: Record<string, UserRole> = {
    learner: 'STUDENT',
    pupil: 'STUDENT',
    student: 'STUDENT',
    students: 'STUDENT',
    guardian: 'PARENT',
    parent: 'PARENT',
    daddy: 'PARENT',
    mummy: 'PARENT',
    mother: 'PARENT',
    father: 'PARENT',
    teacher: 'TEACHER',
    teachers: 'TEACHER',
    class_teacher: 'TEACHER',
    staff: 'TEACHER',
    dean: 'DEAN',
    accountant: 'ACCOUNTANT',
    bursar: 'ACCOUNTANT',
    cashier: 'ACCOUNTANT',
    admin: 'SUPER_ADMIN',
    super_admin: 'SUPER_ADMIN',
    administrator: 'SUPER_ADMIN',
  };
  return map[key] ?? null;
}

/**
 * Parses one CSV (or tab-separated) line.
 *
 * Quoted fields are honoured, because a name like "Auma, Grace" contains the
 * delimiter and must not split into two columns.
 */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ',' || char === '\t') {
      out.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  out.push(current.trim());
  return out;
}

/** Splits pasted rows into header + body rows, ignoring blanks. */
function parseCsv(text: string): { header: string[]; rows: string[][] } {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) return { header: [], rows: [] };
  return {
    header: splitCsvLine(lines[0]).map((h) => h.toLowerCase()),
    rows: lines.slice(1).map(splitCsvLine),
  };
}

/** Normalises a header cell to a known column, so `First Name` and `first_name` both land. */
function normaliseHeader(cell: string): CsvColumn | null {
  const key = cell
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  return (CSV_COLUMNS as readonly string[]).includes(key) ? (key as CsvColumn) : null;
}

interface DraftRow {
  key: string;
  role: UserRole;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  gradeLevel: string;
  classId: string;
  streamId: string;
  academicYearId: string;
  dateOfBirth: string;
  gender: string;
  admissionNumber: string;
  parentEmail: string;
  employeeId: string;
  position: string;
  department: string;
  hireDate: string;
}

function emptyRow(defaultRole: UserRole): DraftRow {
  return {
    key: `row-${Math.random().toString(36).slice(2, 9)}`,
    role: defaultRole,
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    gradeLevel: '',
    classId: '',
    streamId: '',
    academicYearId: '',
    dateOfBirth: '',
    gender: '',
    admissionNumber: '',
    parentEmail: '',
    employeeId: '',
    position: '',
    department: '',
    hireDate: '',
  };
}

export default function EnrollmentHubPage() {
  const { can } = useAuth();
  const canView = can('admissions.view');
  const canManage = can('admissions.manage');

  const [tab, setTab] = React.useState<Tab>('applications');

  const [status, setStatus] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [debounced, setDebounced] = React.useState('');

  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  const [showNewModal, setShowNewModal] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [enrollTarget, setEnrollTarget] = React.useState<ApplicationRecord | null>(null);

  // New applicant intake
  const [newEmail, setNewEmail] = React.useState('');
  const [newFirstName, setNewFirstName] = React.useState('');
  const [newLastName, setNewLastName] = React.useState('');
  const [newPhone, setNewPhone] = React.useState('');
  const [newGradeLevel, setNewGradeLevel] = React.useState('');
  const [newDateOfBirth, setNewDateOfBirth] = React.useState('');
  const [newParentUserId, setNewParentUserId] = React.useState('');

  // Placement decision
  const [enrollClassId, setEnrollClassId] = React.useState('');
  const [enrollStreamId, setEnrollStreamId] = React.useState('');
  const [enrollAcademicYearId, setEnrollAcademicYearId] = React.useState('');
  const [enrollParentUserId, setEnrollParentUserId] = React.useState('');

  // Bulk enrollment
  const [csvText, setCsvText] = React.useState('');
  /// Where the rows in `draftRows` came from, so a run records its own origin.
  const [bulkSource, setBulkSource] = React.useState<'CSV import' | 'Manual entry'>('CSV import');
  const [defaultRole, setDefaultRole] = React.useState<UserRole>('STUDENT');
  const [defaultClassId, setDefaultClassId] = React.useState('');
  const [defaultAcademicYearId, setDefaultAcademicYearId] = React.useState('');
  const [draftRows, setDraftRows] = React.useState<DraftRow[]>([]);
  const [lastBatch, setLastBatch] = React.useState<BatchRecord | null>(null);

  const [expandedBatchId, setExpandedBatchId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  // The overview carries the summary, the class options and the sessions in one
  // round trip, so the screen can act without waiting on a second request.
  const overview = useApi<OverviewResponse>(canView ? '/api/enrollment' : null);

  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (debounced) params.set('search', debounced);
  const qs = params.toString();

  const applications = useApi<ApplicationsResponse>(
    canView ? `/api/enrollment/applications${qs ? `?${qs}` : ''}` : null
  );

  // Guardians already on the platform, so a learner can be linked at entry
  // without re-keying them.
  const parents = useApi<{ parents?: Array<Record<string, any>> }>(
    canManage ? '/api/parents' : null
  );

  const batches = useApi<BatchesResponse>(
    canView && tab === 'history' ? '/api/enrollment/batches' : null
  );

  const rows = React.useMemo(() => applications.data?.applications ?? [], [applications.data]);
  const classes = overview.data?.classes ?? [];
  const academicYears = overview.data?.academicYears ?? [];
  const summary = overview.data?.summary;

  const parentOptions = React.useMemo(
    () =>
      (parents.data?.parents ?? []).map((parent: any) => ({
        value: (parent.userId ?? parent.id) as string,
        label: (parent.name ?? parent.email ?? 'Guardian') as string,
      })),
    [parents.data]
  );

  const classOptions = React.useMemo(
    () =>
      classes.map((cls) => ({
        value: cls.id,
        label: [cls.name, cls.gradeLevel].filter(Boolean).join(' - '),
      })),
    [classes]
  );

  const streamOptionsFor = React.useCallback(
    (classId: string) => {
      const cls = classes.find((c) => c.id === classId);
      return (cls?.streams ?? []).map((stream) => ({
        value: stream.id,
        label: `${stream.name} (${stream.code})`,
      }));
    },
    [classes]
  );

  const selectedClass = classes.find((c) => c.id === enrollClassId);
  const selectedStream = selectedClass?.streams.find((s) => s.id === enrollStreamId);
  const enrollStreamOptions = streamOptionsFor(enrollClassId);

  const selectedRows = rows.filter((row) => selectedIds.has(row.id));
  const allSelected = rows.length > 0 && rows.every((row) => selectedIds.has(row.id));

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(rows.map((row) => row.id)));
  }

  async function review(id: string, next: AdmissionStatus) {
    setBusy(true);
    try {
      const res = await fetch(`/api/enrollment/applications/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        notify.error(await errorMessage(res, 'Could not update the application'));
        return;
      }
      notify.success(`Application ${STATUS_LABEL[next].toLowerCase()}`);
      applications.refetch();
      overview.refetch();
    } catch {
      notify.error('Could not reach the API. Check that it is running.');
    } finally {
      setBusy(false);
    }
  }

  async function bulkReview(next: AdmissionStatus) {
    if (selectedRows.length === 0) return;
    setBusy(true);
    try {
      const res = await fetch('/api/enrollment/applications/bulk', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationIds: selectedRows.map((row) => row.id), status: next }),
      });
      if (!res.ok) {
        notify.error(await errorMessage(res, 'Could not review the selected applications'));
        return;
      }
      const body = (await res.json()) as {
        results?: Array<{ id: string; status: string; error?: string }>;
      };
      const failed = body.results?.filter((r) => r.status === 'failed') ?? [];
      const done = (body.results?.length ?? 0) - failed.length;
      if (failed.length > 0) {
        notify.error(
          `${done} updated, ${failed.length} failed: ${failed[0]?.error ?? 'unknown error'}.`
        );
      } else {
        notify.success(
          `${done} application${done === 1 ? '' : 's'} ${STATUS_LABEL[next].toLowerCase()}.`
        );
      }
      setSelectedIds(new Set());
      applications.refetch();
      overview.refetch();
    } catch {
      notify.error('Could not reach the API. Check that it is running.');
    } finally {
      setBusy(false);
    }
  }

  function withdraw(row: ApplicationRecord) {
    void (async () => {
      setBusy(true);
      try {
        const res = await fetch(`/api/enrollment/applications/${row.id}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        if (!res.ok) {
          notify.error(await errorMessage(res, 'Could not withdraw the application'));
          return;
        }
        notify.success(`Application for ${row.applicant.name} withdrawn.`);
        setSelectedIds(new Set());
        applications.refetch();
        overview.refetch();
      } catch {
        notify.error('Could not reach the API. Check that it is running.');
      } finally {
        setBusy(false);
      }
    })();
  }

  async function submitApplication() {
    if (!newEmail.trim() && !newFirstName.trim() && !newLastName.trim()) {
      notify.error('Give the applicant an email address.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/enrollment/applications', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newEmail.trim() || undefined,
          firstName: newFirstName.trim() || undefined,
          lastName: newLastName.trim() || undefined,
          phone: newPhone.trim() || undefined,
          gradeLevel: newGradeLevel.trim() || undefined,
          dateOfBirth: newDateOfBirth || undefined,
          parentUserId: newParentUserId || undefined,
        }),
      });
      if (!res.ok) {
        notify.error(await errorMessage(res, 'Could not open the application'));
        return;
      }
      notify.success('Application opened. The learner account is pending activation.');
      setShowNewModal(false);
      setNewEmail('');
      setNewFirstName('');
      setNewLastName('');
      setNewPhone('');
      setNewGradeLevel('');
      setNewDateOfBirth('');
      setNewParentUserId('');
      applications.refetch();
      overview.refetch();
    } catch {
      notify.error('Could not reach the API. Check that it is running.');
    } finally {
      setBusy(false);
    }
  }

  function openEnroll(row: ApplicationRecord) {
    setEnrollTarget(row);
    // The session the class belongs to is the sensible default: it is the one
    // the placement is being made in.
    const defaultClass = classes[0];
    setEnrollClassId(defaultClass?.id ?? '');
    setEnrollStreamId('');
    setEnrollAcademicYearId(defaultClass?.academicYearId ?? academicYears[0]?.id ?? '');
    setEnrollParentUserId(row.applicant.parents[0]?.userId ?? '');
  }

  async function submitPlacement() {
    if (!enrollTarget) return;
    if (!enrollClassId) {
      notify.error('Choose the class or grade to place the learner in.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/enrollment/applications/${enrollTarget.id}/enroll`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId: enrollClassId,
          ...(enrollStreamId ? { streamId: enrollStreamId } : {}),
          ...(enrollAcademicYearId ? { academicYearId: enrollAcademicYearId } : {}),
          ...(enrollParentUserId ? { parentUserId: enrollParentUserId } : {}),
        }),
      });
      if (!res.ok) {
        notify.error(await errorMessage(res, 'Could not place the learner'));
        return;
      }
      notify.success(
        `${enrollTarget.applicant.name} placed in ${selectedClass?.name ?? 'the class'}.`
      );
      setEnrollTarget(null);
      applications.refetch();
      overview.refetch();
    } catch {
      notify.error('Could not reach the API. Check that it is running.');
    } finally {
      setBusy(false);
    }
  }

  /* ---------------- bulk enrollment ---------------- */

  /** Turns a pasted or typed row into the shape the API takes. */
  function toEntry(row: DraftRow, fallbackRole: UserRole) {
    const role = row.role || fallbackRole;
    const kind = PROFILE_KIND[role];
    return {
      role,
      email: row.email.trim(),
      firstName: row.firstName.trim() || undefined,
      lastName: row.lastName.trim() || undefined,
      phone: row.phone.trim() || undefined,
      gradeLevel: kind === 'student' ? row.gradeLevel.trim() || undefined : undefined,
      dateOfBirth: kind === 'student' && row.dateOfBirth ? row.dateOfBirth : undefined,
      gender: kind === 'student' && row.gender ? row.gender : undefined,
      admissionNumber: kind === 'student' ? row.admissionNumber.trim() || undefined : undefined,
      // A class or stream left blank on the row falls back to the run's default,
      // because an import of a whole class usually means one class.
      classId: kind === 'student' ? row.classId || defaultClassId || undefined : undefined,
      streamId: kind === 'student' ? row.streamId || undefined : undefined,
      academicYearId:
        kind === 'student' ? row.academicYearId || defaultAcademicYearId || undefined : undefined,
      parentEmail: kind === 'student' ? row.parentEmail.trim() || undefined : undefined,
      employeeId: kind === 'staff' ? row.employeeId.trim() || undefined : undefined,
      position: kind === 'staff' ? row.position.trim() || undefined : undefined,
      department: kind === 'staff' ? row.department.trim() || undefined : undefined,
      hireDate: kind === 'staff' && row.hireDate ? row.hireDate : undefined,
    };
  }

  function parseCsvIntoDraft() {
    const { header, rows: parsed } = parseCsv(csvText);
    if (header.length === 0) {
      notify.error('Paste a header row plus at least one row of people.');
      return;
    }
    if (!header.includes('email')) {
      notify.error('The header must include an `email` column.');
      return;
    }

    const columns = header.map(normaliseHeader);
    const drafts: DraftRow[] = [];
    const unknown = new Set<string>();

    for (const cells of parsed) {
      const row = emptyRow(defaultRole);
      columns.forEach((column, index) => {
        const value = cells[index]?.trim() ?? '';
        if (!value) return;
        if (!column) {
          if (header[index]) unknown.add(header[index]);
          return;
        }
        if (column === 'email') row.email = value.toLowerCase();
        else if (column === 'role') row.role = normaliseRole(value) ?? row.role;
        else if (column === 'first_name') row.firstName = value;
        else if (column === 'last_name') row.lastName = value;
        else if (column === 'phone') row.phone = value;
        else if (column === 'grade_level') row.gradeLevel = value;
        else if (column === 'class_code') row.classId = matchClass(value)?.id ?? value;
        else if (column === 'stream_code') row.streamId = matchStream(value) ?? value;
        else if (column === 'academic_year') row.academicYearId = matchYear(value) ?? value;
        else if (column === 'date_of_birth') row.dateOfBirth = value;
        else if (column === 'gender') row.gender = value;
        else if (column === 'admission_number') row.admissionNumber = value;
        else if (column === 'parent_email') row.parentEmail = value.toLowerCase();
        else if (column === 'employee_id') row.employeeId = value;
        else if (column === 'position') row.position = value;
        else if (column === 'department') row.department = value;
        else if (column === 'hire_date') row.hireDate = value;
      });
      drafts.push(row);
    }

    if (drafts.length === 0) {
      notify.error('No data rows found under the header.');
      return;
    }

    if (unknown.size > 0) {
      notify.error(`Unrecognised columns ignored: ${[...unknown].join(', ')}.`);
    } else {
      notify.success(
        `${drafts.length} row${drafts.length === 1 ? '' : 's'} read. Review before enrolling.`
      );
    }
    setDraftRows(drafts);
    setBulkSource('CSV import');
  }

  function matchClass(codeOrName: string) {
    const needle = codeOrName.toLowerCase();
    return (
      classes.find((c) => (c.classCode ?? '').toLowerCase() === needle) ??
      classes.find((c) => c.name.toLowerCase() === needle)
    );
  }

  function matchStream(codeOrName: string): string | undefined {
    const needle = codeOrName.toLowerCase();
    return classes
      .flatMap((c) => c.streams.map((s) => ({ ...s, classId: c.id })))
      .find((s) => s.code.toLowerCase() === needle || s.name.toLowerCase() === needle)?.id;
  }

  function matchYear(name: string): string | undefined {
    const needle = name.toLowerCase();
    return academicYears.find(
      (y) => y.name.toLowerCase() === needle || (y.label ?? '').toLowerCase() === needle
    )?.id;
  }

  function updateRow(key: string, patch: Partial<DraftRow>) {
    setDraftRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function removeRow(key: string) {
    setDraftRows((prev) => prev.filter((row) => row.key !== key));
  }

  function resetBulk() {
    setDraftRows([]);
    setCsvText('');
    setBulkSource('CSV import');
    setLastBatch(null);
  }

  async function submitBatch() {
    if (draftRows.length === 0) {
      notify.error('Add at least one person to enroll.');
      return;
    }

    const entries = draftRows.map((row) => toEntry(row, defaultRole));
    const invalid = entries.findIndex(
      (entry) => !entry.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entry.email)
    );
    if (invalid >= 0) {
      notify.error(`Row ${invalid + 1} needs a valid email address.`);
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/enrollment/batches', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: bulkSource,
          entries,
        }),
      });
      if (!res.ok) {
        notify.error(await errorMessage(res, 'Could not run the bulk enrollment'));
        return;
      }
      const body = (await res.json()) as { batch: BatchRecord };
      const batch = body.batch;
      setLastBatch(batch);
      const { enrolled, duplicate, failed } = batch.counts;
      if (failed > 0) {
        notify.error(
          `${enrolled} enrolled, ${duplicate} already existed, ${failed} failed. See the rows below.`
        );
      } else {
        notify.success(`${enrolled} enrolled. ${duplicate} already existed.`);
      }
      setDraftRows([]);
      setCsvText('');
      overview.refetch();
      batches.refetch();
    } catch {
      notify.error('Could not reach the API. Check that it is running.');
    } finally {
      setBusy(false);
    }
  }

  const draftEntries = draftRows.map((row) => toEntry(row, defaultRole));
  const studentDrafts = draftEntries.filter(
    (entry) => PROFILE_KIND[entry.role] === 'student'
  ).length;
  const staffDrafts = draftEntries.filter((entry) => PROFILE_KIND[entry.role] === 'staff').length;
  const parentDrafts = draftEntries.filter((entry) => PROFILE_KIND[entry.role] === 'parent').length;

  const filters: ContextFilter[] = [
    {
      id: 'status',
      label: 'Status',
      value: status,
      allowAll: true,
      allLabel: 'All applications',
      options: (Object.keys(STATUS_LABEL) as AdmissionStatus[]).map((key) => ({
        value: key,
        label: STATUS_LABEL[key],
      })),
      onChange: setStatus,
    },
  ];

  const applicationColumns: Array<DataTableColumn<ApplicationRecord>> = [
    {
      id: 'select',
      header: '',
      className: 'w-10',
      cell: (row) =>
        canManage && row.status !== 'enrolled' ? (
          <input
            type="checkbox"
            checked={selectedIds.has(row.id)}
            onChange={() => toggleRow(row.id)}
            aria-label={`Select ${row.applicant.name}`}
            className="h-4 w-4 rounded border-input"
          />
        ) : null,
      hideBelow: 'sm',
    },
    {
      id: 'applicant',
      header: 'Applicant',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{row.applicant.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {row.applicant.email ?? 'No email'}
          </p>
        </div>
      ),
      sortValue: (row) => row.applicant.name,
    },
    {
      id: 'grade',
      header: 'Grade',
      cell: (row) => (
        <span className="text-sm text-foreground">
          {row.applicant.gradeLevel ?? <span className="text-muted-foreground">Not set</span>}
        </span>
      ),
      hideBelow: 'md',
      sortValue: (row) => row.applicant.gradeLevel ?? '',
    },
    {
      id: 'account',
      header: 'Account',
      cell: (row) =>
        row.applicant.accountStatus ? (
          <StatusPill
            label={row.applicant.accountStatus}
            tone={ACCOUNT_TONE[row.applicant.accountStatus] ?? 'neutral'}
          />
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
      hideBelow: 'lg',
      sortValue: (row) => row.applicant.accountStatus ?? '',
    },
    {
      id: 'applied',
      header: 'Applied',
      cell: (row) => (
        <span className="text-sm text-muted-foreground">{formatDate(row.appliedAt)}</span>
      ),
      hideBelow: 'sm',
      sortValue: (row) => row.appliedAt,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => <StatusPill label={STATUS_LABEL[row.status]} tone={STATUS_TONE[row.status]} />,
      sortValue: (row) => row.status,
    },
    {
      id: 'actions',
      header: '',
      align: 'right',
      cell: (row) => {
        // Actions follow the lifecycle a row is actually in: a pending
        // application is decided, an accepted one is placed, and an enrolled one
        // is settled and offers nothing.
        const items = [];
        if (row.status === 'pending') {
          items.push({
            id: 'accept',
            label: `Accept ${row.applicant.name}`,
            icon: 'check',
            onClick: () => review(row.id, 'accepted'),
          });
        }
        if (row.status === 'pending' || row.status === 'accepted') {
          items.push({
            id: 'enroll',
            label: `Place ${row.applicant.name} in a class`,
            icon: 'user-round-check',
            onClick: () => openEnroll(row),
          });
        }
        if (row.status !== 'enrolled' && row.status !== 'rejected') {
          items.push({
            id: 'reject',
            label: `Reject ${row.applicant.name}`,
            icon: 'x',
            tone: 'danger' as const,
            onClick: () => review(row.id, 'rejected'),
          });
        }
        if (row.status !== 'enrolled') {
          items.push({
            id: 'withdraw',
            label: `Withdraw ${row.applicant.name}`,
            icon: 'archive',
            tone: 'danger' as const,
            onClick: () => withdraw(row),
          });
        }
        return <ActionButtons items={items} />;
      },
    },
  ];

  const batchColumns: Array<DataTableColumn<BatchRecord>> = [
    {
      id: 'when',
      header: 'Run',
      cell: (row) => (
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{formatDate(row.createdAt)}</p>
          <p className="text-xs text-muted-foreground">{row.source ?? 'Manual entry'}</p>
        </div>
      ),
      sortValue: (row) => row.createdAt,
    },
    {
      id: 'total',
      header: 'Rows',
      align: 'right',
      cell: (row) => <span className="text-sm text-foreground">{row.counts.total}</span>,
      sortValue: (row) => row.counts.total,
    },
    {
      id: 'enrolled',
      header: 'Enrolled',
      align: 'right',
      cell: (row) => (
        <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
          {row.counts.enrolled}
        </span>
      ),
      hideBelow: 'sm',
      sortValue: (row) => row.counts.enrolled,
    },
    {
      id: 'duplicate',
      header: 'Existing',
      align: 'right',
      cell: (row) => <span className="text-sm text-foreground">{row.counts.duplicate}</span>,
      hideBelow: 'sm',
      sortValue: (row) => row.counts.duplicate,
    },
    {
      id: 'failed',
      header: 'Failed',
      align: 'right',
      cell: (row) => (
        <span
          className={
            row.counts.failed > 0
              ? 'text-sm font-medium text-destructive'
              : 'text-sm text-muted-foreground'
          }
        >
          {row.counts.failed}
        </span>
      ),
      hideBelow: 'sm',
      sortValue: (row) => row.counts.failed,
    },
    {
      id: 'actions',
      header: '',
      align: 'right',
      cell: (row) => (
        <ActionButtons
          items={[
            {
              id: 'toggle',
              label: expandedBatchId === row.id ? 'Hide rows' : 'Show rows',
              icon: expandedBatchId === row.id ? 'arrow-up' : 'arrow-down',
              onClick: () => setExpandedBatchId(expandedBatchId === row.id ? null : row.id),
            },
          ]}
        />
      ),
    },
  ];

  const expandedBatch = batches.data?.batches.find((b) => b.id === expandedBatchId);

  if (!canView) {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="Enrollment Hub"
          description="Take, review and place learners entering the school."
        />
        <ErrorState
          title="You do not have access to the Enrollment Hub"
          message="Viewing applications requires admissions.view. Your role does not hold it, and the API refuses the request independently of this screen."
        />
      </div>
    );
  }

  const filtered = Boolean(debounced) || Boolean(status);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Enrollment Hub"
        description="Bring people into the school one at a time, or a whole set at once. Learners, guardians and staff all arrive here."
        action={
          canManage ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setShowNewModal(true)}>
                Single Applicant
              </Button>
              <Button
                onClick={() => {
                  resetBulk();
                  setTab('bulk');
                }}
              >
                Bulk Enroll
              </Button>
            </div>
          ) : null
        }
      />

      <div className="flex flex-wrap gap-1 rounded-lg border bg-card p-1">
        {(
          [
            ['applications', 'Applications'],
            ['bulk', 'Bulk Enroll'],
            ['history', 'History'],
          ] as Array<[Tab, string]>
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={
              tab === value
                ? 'rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground'
                : 'rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground'
            }
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'applications' ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <DashboardCard
              title="Awaiting review"
              value={summary?.awaitingDecision ?? 0}
              icon="clipboard-list"
              tone={(summary?.awaitingDecision ?? 0) > 0 ? 'warning' : 'accent'}
              description="Applications not yet decided"
            />
            <DashboardCard
              title="Accepted"
              value={summary?.byStatus.accepted ?? 0}
              icon="clipboard-check"
              description="Approved, waiting to be placed"
            />
            <DashboardCard
              title="Enrolled"
              value={summary?.byStatus.enrolled ?? 0}
              icon="user-round-check"
              tone="success"
              description="Placed in a class"
            />
            <DashboardCard
              title="Total applications"
              value={summary?.total ?? 0}
              icon="users-round"
              description="Every application on record"
            />
          </div>

          <ContextFilterBar
            filters={filters}
            search={{
              value: search,
              onChange: setSearch,
              placeholder: 'Search by applicant name or email…',
            }}
            actions={
              rows.length > 0 ? (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    disabled={!canManage || rows.every((r) => r.status === 'enrolled')}
                    className="h-4 w-4 rounded border-input"
                  />
                  Select all
                </label>
              ) : null
            }
          />

          {selectedRows.length > 0 && canManage ? (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
              <p className="text-sm font-medium text-foreground">
                {selectedRows.length} application{selectedRows.length === 1 ? '' : 's'} selected
              </p>
              <div className="flex flex-1 flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => bulkReview('accepted')}
                >
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => bulkReview('rejected')}
                >
                  Reject
                </Button>
              </div>
              <button type="button" onClick={() => setSelectedIds(new Set())} className="underline">
                Clear
              </button>
            </div>
          ) : null}

          {applications.loading ? (
            <LoadingState label="Loading applications" />
          ) : applications.error ? (
            <ErrorState
              title="Could not load applications"
              message="GET /api/enrollment/applications requires admissions.view. Confirm the API is running and that your session still holds the permission."
            />
          ) : (
            <DataTable
              caption="Learner applications"
              columns={applicationColumns}
              rows={rows}
              rowKey={(row) => row.id}
              pageSize={15}
              empty={
                <EmptyState
                  title={filtered ? 'No applications match these filters' : 'No applications yet'}
                  description={
                    filtered
                      ? 'Adjust the search or status filter above.'
                      : 'Open the first application, or use Bulk Enroll for a whole intake.'
                  }
                  icon="clipboard-list"
                />
              }
            />
          )}
        </>
      ) : null}

      {tab === 'bulk' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <DashboardCard
              title="Bulk enrollment"
              value={batches.data?.batches.length ?? 0}
              icon="layers"
              tone="accent"
              description="Runs recorded for this school"
            />
            <DashboardCard
              title="People enrolled"
              value={(batches.data?.batches ?? []).reduce((sum, b) => sum + b.counts.enrolled, 0)}
              icon="user-round-check"
              tone="success"
              description="Onboarded by bulk runs"
            />
            <DashboardCard
              title="Rows needing attention"
              value={(batches.data?.batches ?? []).reduce(
                (sum, b) => sum + b.counts.failed + b.counts.duplicate,
                0
              )}
              icon="triangle-alert"
              description="Failed or already existed"
            />
          </div>

          {canManage ? (
            <div className="rounded-lg border bg-card p-5">
              <h2 className="text-base font-semibold text-foreground">
                Enroll many people at once
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Paste a spreadsheet export, or add rows by hand. Any category of person can be in
                the same run: the <code className="rounded bg-muted px-1">role</code> column decides
                what each one gets.
              </p>

              <div className="mt-4">
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Expected columns
                </p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {CSV_COLUMNS.join(', ')}
                </p>
              </div>

              <div className="mt-4 flex flex-wrap items-end gap-3">
                <Field label="Default role" className="w-full sm:w-64">
                  <Select
                    value={defaultRole}
                    onChange={(e) => setDefaultRole(normaliseRole(e.target.value) ?? 'STUDENT')}
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABEL[role]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <p className="text-xs text-muted-foreground">{ROLE_HINT[defaultRole]}</p>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Default class" hint="Used for learner rows that do not name a class.">
                  <Select
                    value={defaultClassId}
                    onChange={(e) => setDefaultClassId(e.target.value)}
                  >
                    <option value="">No default class</option>
                    {classOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Default academic session">
                  <Select
                    value={defaultAcademicYearId}
                    onChange={(e) => setDefaultAcademicYearId(e.target.value)}
                  >
                    <option value="">No default session</option>
                    {academicYears.map((year) => (
                      <option key={year.id} value={year.id}>
                        {sessionLabel(year)}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <div className="mt-5">
                <Field
                  label="Paste rows"
                  hint="CSV or TSV, with a header row. Quoted fields are honoured."
                >
                  <textarea
                    value={csvText}
                    onChange={(e) => setCsvText(e.target.value)}
                    rows={5}
                    spellCheck={false}
                    placeholder={
                      'email,role,first_name,last_name,grade_level,class_code\nlearner1@school.example,STUDENT,Ama,Juma,PP2,PP2\ntess@school.example,TEACHER,Tess,Otieno'
                    }
                    className="w-full rounded-xl border border-input/80 bg-background/80 px-3.5 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:outline-none"
                  />
                </Field>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button variant="outline" onClick={parseCsvIntoDraft} disabled={!csvText.trim()}>
                    Read rows
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setDraftRows((prev) => [...prev, emptyRow(defaultRole)]);
                      setBulkSource('Manual entry');
                    }}
                  >
                    Add a row by hand
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <ErrorState
              title="You cannot run a bulk enrollment"
              message="Enrolling people requires admissions.manage. Your role does not hold it, and the API refuses the request independently of this screen."
            />
          )}

          {draftRows.length > 0 && canManage ? (
            <div className="space-y-3 rounded-lg border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {draftRows.length} row{draftRows.length === 1 ? '' : 's'} ready
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {studentDrafts} learner{studentDrafts === 1 ? '' : 's'} · {parentDrafts}{' '}
                    guardian
                    {parentDrafts === 1 ? '' : 's'} · {staffDrafts} staff
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setDraftRows([])}>
                    Discard
                  </Button>
                  <Button onClick={submitBatch} disabled={busy}>
                    {busy ? 'Enrolling…' : 'Enroll them'}
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                      <th className="py-2 pr-2 font-medium">#</th>
                      <th className="py-2 pr-2 font-medium">Role</th>
                      <th className="py-2 pr-2 font-medium">Email</th>
                      <th className="py-2 pr-2 font-medium">First name</th>
                      <th className="py-2 pr-2 font-medium">Last name</th>
                      <th className="py-2 pr-2 font-medium">Details</th>
                      <th className="py-2 pr-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {draftRows.map((row, index) => {
                      const kind = PROFILE_KIND[toEntry(row, defaultRole).role];
                      return (
                        <tr key={row.key} className="border-b last:border-0">
                          <td className="py-2 pr-2 text-muted-foreground">{index + 1}</td>
                          <td className="py-2 pr-2">
                            <Select
                              value={row.role}
                              onChange={(e) =>
                                updateRow(row.key, {
                                  role: normaliseRole(e.target.value) ?? 'STUDENT',
                                })
                              }
                              className="h-9 w-36"
                            >
                              {/* A row with no role yet would otherwise show the
                                  first option as if it had been chosen. */}
                              <option value="">Choose a role</option>
                              {ROLES.map((role) => (
                                <option key={role} value={role}>
                                  {ROLE_LABEL[role]}
                                </option>
                              ))}
                            </Select>
                          </td>
                          <td className="py-2 pr-2">
                            <Input
                              value={row.email}
                              onChange={(e) => updateRow(row.key, { email: e.target.value })}
                              placeholder="name@school.example"
                              className="h-9 w-56"
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <Input
                              value={row.firstName}
                              onChange={(e) => updateRow(row.key, { firstName: e.target.value })}
                              placeholder="First name"
                              className="h-9 w-32"
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <Input
                              value={row.lastName}
                              onChange={(e) => updateRow(row.key, { lastName: e.target.value })}
                              placeholder="Last name"
                              className="h-9 w-32"
                            />
                          </td>
                          <td className="py-2 pr-2 text-xs text-muted-foreground">
                            {kind === 'student'
                              ? [
                                  row.gradeLevel,
                                  row.classId
                                    ? (matchClass(row.classId)?.name ?? row.classId)
                                    : null,
                                ]
                                  .filter(Boolean)
                                  .join(' · ') || 'No placement stated'
                              : null}
                            {kind === 'staff'
                              ? [row.employeeId, row.position, row.department]
                                  .filter(Boolean)
                                  .join(' · ') || 'No staff details'
                              : null}
                            {kind === 'parent' ? 'Guardian account' : null}
                          </td>
                          <td className="py-2 pr-2 text-right">
                            <button
                              type="button"
                              onClick={() => removeRow(row.key)}
                              className="text-xs text-destructive underline"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {lastBatch ? (
            <div className="space-y-3 rounded-lg border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-foreground">Result of the last run</h3>
                <div className="flex flex-wrap gap-2 text-xs">
                  <StatusPill label={`${lastBatch.counts.enrolled} enrolled`} tone="success" />
                  <StatusPill label={`${lastBatch.counts.duplicate} already existed`} tone="info" />
                  <StatusPill label={`${lastBatch.counts.failed} failed`} tone="danger" />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                      <th className="py-2 pr-2 font-medium">#</th>
                      <th className="py-2 pr-2 font-medium">Person</th>
                      <th className="py-2 pr-2 font-medium">Role</th>
                      <th className="py-2 pr-2 font-medium">Outcome</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lastBatch.entries.map((entry) => (
                      <tr key={entry.id} className="border-b last:border-0">
                        <td className="py-2 pr-2 text-muted-foreground">{entry.rowNumber}</td>
                        <td className="py-2 pr-2">
                          <p className="text-sm text-foreground">{entry.name}</p>
                          <p className="text-xs text-muted-foreground">{entry.email}</p>
                          {entry.error ? (
                            <p className="text-xs text-destructive">{entry.error}</p>
                          ) : null}
                        </td>
                        <td className="py-2 pr-2 text-xs text-muted-foreground">
                          {ROLE_LABEL[entry.role]}
                        </td>
                        <td className="py-2 pr-2">
                          <StatusPill
                            label={ENTRY_LABEL[entry.status]}
                            tone={ENTRY_TONE[entry.status]}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === 'history' ? (
        <div className="space-y-4">
          {batches.loading ? (
            <LoadingState label="Loading enrollment history" />
          ) : batches.error ? (
            <ErrorState
              title="Could not load enrollment history"
              message="GET /api/enrollment/batches requires admissions.view. Confirm the API is running and that your session still holds the permission."
            />
          ) : (batches.data?.batches.length ?? 0) === 0 ? (
            <EmptyState
              title="No bulk enrollments yet"
              description="Bulk-enroll a set of people and the run will be recorded here, with what each row became."
              icon="layers"
            />
          ) : (
            <>
              <DataTable
                caption="Bulk enrollment runs"
                columns={batchColumns}
                rows={batches.data?.batches ?? []}
                rowKey={(row) => row.id}
                pageSize={10}
              />

              {expandedBatch ? (
                <div className="rounded-lg border bg-card p-5">
                  <h3 className="text-sm font-semibold text-foreground">
                    {expandedBatch.counts.total} rows ·{' '}
                    {expandedBatch.source ?? formatDate(expandedBatch.createdAt)}
                  </h3>
                  {expandedBatch.notes ? (
                    <p className="mt-1 text-xs text-muted-foreground">{expandedBatch.notes}</p>
                  ) : null}
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                          <th className="py-2 pr-2 font-medium">#</th>
                          <th className="py-2 pr-2 font-medium">Person</th>
                          <th className="py-2 pr-2 font-medium">Role</th>
                          <th className="py-2 pr-2 font-medium">Outcome</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expandedBatch.entries.map((entry) => (
                          <tr key={entry.id} className="border-b last:border-0">
                            <td className="py-2 pr-2 text-muted-foreground">{entry.rowNumber}</td>
                            <td className="py-2 pr-2">
                              <p className="text-sm text-foreground">{entry.name}</p>
                              <p className="text-xs text-muted-foreground">{entry.email}</p>
                              {entry.error ? (
                                <p className="text-xs text-destructive">{entry.error}</p>
                              ) : null}
                            </td>
                            <td className="py-2 pr-2 text-xs text-muted-foreground">
                              {ROLE_LABEL[entry.role]}
                            </td>
                            <td className="py-2 pr-2">
                              <StatusPill
                                label={ENTRY_LABEL[entry.status]}
                                tone={ENTRY_TONE[entry.status]}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      <FloatingFormModal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        title="New Application"
        description="Take in a learner. The learner account is created pending activation; activating it is the invitation flow's job."
        icon="user-plus"
        submitLabel="Open Application"
        isSubmitting={busy}
        onSubmit={submitApplication}
        size="lg"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Email address" required>
            <TextInput
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="learner@school.example"
            />
          </Field>
          <Field label="Phone">
            <TextInput
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="07xx xxx xxx"
            />
          </Field>
          <Field label="First name">
            <TextInput
              value={newFirstName}
              onChange={(e) => setNewFirstName(e.target.value)}
              placeholder="First name"
            />
          </Field>
          <Field label="Last name">
            <TextInput
              value={newLastName}
              onChange={(e) => setNewLastName(e.target.value)}
              placeholder="Last name"
            />
          </Field>
          <Field
            label="Grade / class applied for"
            hint="The placement is decided when the learner is accepted."
          >
            <TextInput
              value={newGradeLevel}
              onChange={(e) => setNewGradeLevel(e.target.value)}
              placeholder="e.g. PP2"
            />
          </Field>
          <Field label="Date of birth">
            <TextInput
              type="date"
              value={newDateOfBirth}
              onChange={(e) => setNewDateOfBirth(e.target.value)}
            />
          </Field>
          <Field
            label="Parent / guardian"
            hint="Linked to the learner when they are placed. Optional."
            className="sm:col-span-2"
          >
            <Select value={newParentUserId} onChange={(e) => setNewParentUserId(e.target.value)}>
              <option value="">No guardian yet</option>
              {parentOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </FloatingFormModal>

      <FloatingFormModal
        isOpen={Boolean(enrollTarget)}
        onClose={() => setEnrollTarget(null)}
        title="Place Learner"
        description="Placing a learner writes their enrollment, which is what attendance, results and the class register read."
        icon="user-round-check"
        submitLabel="Place Learner"
        isSubmitting={busy}
        onSubmit={submitPlacement}
        size="lg"
      >
        {enrollTarget ? (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-sm font-medium text-foreground">{enrollTarget.applicant.name}</p>
              <p className="text-xs text-muted-foreground">
                {enrollTarget.applicant.email ?? 'No email'} ·{' '}
                {enrollTarget.applicant.gradeLevel
                  ? `applied for ${enrollTarget.applicant.gradeLevel}`
                  : 'grade not stated'}
              </p>
              {enrollTarget.applicant.parents.length > 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Guardian:{' '}
                  {enrollTarget.applicant.parents
                    .map((parent) => parent.name ?? parent.email ?? 'linked')
                    .join(', ')}
                </p>
              ) : null}
            </div>

            {classes.length === 0 ? (
              <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
                There are no classes in your school yet. Create a class first - a placement needs
                one.
              </p>
            ) : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Academic session" required>
                <Select
                  value={enrollAcademicYearId}
                  onChange={(e) => setEnrollAcademicYearId(e.target.value)}
                >
                  <option value="">No session</option>
                  {academicYears.map((year) => (
                    <option key={year.id} value={year.id}>
                      {sessionLabel(year)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Class / grade" required>
                <Select
                  value={enrollClassId}
                  onChange={(e) => {
                    setEnrollClassId(e.target.value);
                    setEnrollStreamId('');
                  }}
                >
                  <option value="">Select a class…</option>
                  {classOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Stream"
                hint={
                  enrollClassId && enrollStreamOptions.length === 0
                    ? 'This class has no streams.'
                    : 'Optional. Streams belong to the selected class.'
                }
              >
                <Select
                  value={enrollStreamId}
                  onChange={(e) => setEnrollStreamId(e.target.value)}
                  disabled={!enrollClassId || enrollStreamOptions.length === 0}
                >
                  <option value="">No stream</option>
                  {enrollStreamOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Parent / guardian" hint="Optional. Links the learner to a guardian.">
                <Select
                  value={enrollParentUserId}
                  onChange={(e) => setEnrollParentUserId(e.target.value)}
                >
                  <option value="">No guardian</option>
                  {parentOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <p className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
              {selectedClass
                ? `${enrollTarget.applicant.name} will be placed in ${selectedClass.name}${selectedStream ? ` / ${selectedStream.name} (${selectedStream.code})` : ''}.`
                : 'Choose a class to place the learner in.'}
            </p>
          </div>
        ) : null}
      </FloatingFormModal>
    </div>
  );
}
