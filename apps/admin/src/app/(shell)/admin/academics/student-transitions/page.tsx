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
  LoadingState,
  NavIcon,
  SectionHeader,
  Select,
  StatusPill,
  TextInput,
  initialsOf,
  notify,
  type DataTableColumn,
  type StatusTone,
} from '@schoolos/ui';

interface StudentForSelect {
  id: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
  gradeLevel: string | null;
}

interface StudentsResponse {
  students?: StudentForSelect[];
}

interface TransitionRecord {
  id: string;
  studentProfileId: string;
  userId: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  avatar: string | null;
  admissionId: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  enrollmentDate: string | null;
  gradeLevel: string | null;
  accountStatus: string;
  reason: 'completed' | 'transferred' | 'withdrawn';
  exitDate: string;
  lastGradeLevel: string | null;
  lastStream: string | null;
  destination: string | null;
  notes: string | null;
  recordedAt: string;
  recordedById: string | null;
  restoredAt: string | null;
  restoredById: string | null;
  isRestored: boolean;
  academicYearId: string | null;
  academicYear: { id: string; name: string; label?: string | null } | null;
  currentClass: { id: string; name: string; classCode?: string | null; gradeLevel?: string | null } | null;
}

interface TransitionsResponse {
  transitions?: TransitionRecord[];
  total?: number;
}

interface OptionsResponse {
  reasons?: Array<{ value: string; count: number }>;
  academicYears?: Array<{ value: string; label: string }>;
  classes?: Array<{ value: string; label: string; gradeLevel?: string | null }>;
}

interface ClassesResponse {
  classes?: Array<{ id: string; name: string; gradeLevel?: string | null }>;
}

interface EnrollmentEntry {
  id: string;
  classId: string;
  className: string | null;
  classCode: string | null;
  gradeLevel: string | null;
  streamId: string | null;
  streamCode: string | null;
  streamName: string | null;
  academicYearId: string | null;
  academicYear: { id: string; name: string; label: string | null } | null;
  startDate: string | null;
  createdAt: string;
}

interface TransitionDetail {
  id: string;
  studentProfileId: string;
  userId: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  avatar: string | null;
  admissionId: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  enrollmentDate: string | null;
  gradeLevel: string | null;
  accountStatus: string;
  reason: 'completed' | 'transferred' | 'withdrawn';
  exitDate: string;
  lastGradeLevel: string | null;
  lastStream: string | null;
  destination: string | null;
  notes: string | null;
  recordedAt: string;
  recordedById: string | null;
  recordedBy: { id: string; name: string | null; email: string } | null;
  restoredAt: string | null;
  restoredById: string | null;
  restoredBy: { id: string; name: string | null; email: string } | null;
  isRestored: boolean;
  academicYear: { id: string; name: string; label: string | null } | null;
  enrollments: EnrollmentEntry[];
  history: TransitionRecord[];
}

const REASON_LABEL: Record<string, string> = {
  completed: 'Completed',
  transferred: 'Transferred',
  withdrawn: 'Withdrawn',
};

const REASON_TONE: Record<string, StatusTone> = {
  completed: 'success',
  transferred: 'info',
  withdrawn: 'warning',
};

const ACCOUNT_TONE: Record<string, StatusTone> = {
  active: 'success',
  pending: 'info',
  suspended: 'danger',
  archived: 'neutral',
};

const SORTS = [
  { value: 'exit_desc', label: 'Most recent exit' },
  { value: 'exit_asc', label: 'Oldest exit' },
  { value: 'name_asc', label: 'Name (A–Z)' },
  { value: 'name_desc', label: 'Name (Z–A)' },
  { value: 'reason', label: 'Reason (A–Z)' },
];

function formatDate(value?: string | null): string {
  if (!value) return '-';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? '-'
    : parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function displayName(record: { name?: string | null; firstName?: string | null; lastName?: string | null } | null): string {
  if (!record) return '';
  return record.name ?? [record.firstName, record.lastName].filter(Boolean).join(' ') ?? '';
}

interface TimelineEntry {
  type: 'enrolled' | 'class_placement' | 'exit' | 'restore';
  label: string;
  date: string | null;
  detail: string;
}

function buildTimeline(detail: TransitionDetail): TimelineEntry[] {
  const items: TimelineEntry[] = [];

  if (detail.enrollmentDate) {
    items.push({
      type: 'enrolled',
      label: 'Enrolled',
      date: detail.enrollmentDate,
      detail: `into ${detail.gradeLevel || detail.lastGradeLevel || 'school'}`,
    });
  }

  for (const e of detail.enrollments) {
    const when = e.startDate ?? e.createdAt;
    const label = e.academicYear
      ? `${e.className ?? 'Class'} - ${e.academicYear.name}`
      : e.className ?? 'A class';
    items.push({
      type: 'class_placement',
      label: e.streamCode ? `${label}, Stream ${e.streamCode}` : label,
      date: when,
      detail: [e.classCode, e.gradeLevel].filter(Boolean).join(' · ') || '-',
    });
  }

  for (const h of detail.history) {
    items.push({
      type: 'exit',
      label: `Exited (${REASON_LABEL[h.reason] ?? h.reason})`,
      date: h.exitDate,
      detail: [h.destination, h.lastGradeLevel, h.lastStream].filter(Boolean).join(' · ') || '-',
    });
    if (h.restoredAt) {
      items.push({
        type: 'restore',
        label: 'Restored',
        date: h.restoredAt,
        detail: h.notes || '-',
      });
    }
  }

  return items.sort((a, b) => {
    const ta = a.date ? new Date(a.date).getTime() : 0;
    const tb = b.date ? new Date(b.date).getTime() : 0;
    return ta - tb;
  });
}

export default function StudentTransitionsPage() {
  const { can } = useAuth();
  const canView = can('students.view');
  const canManage = can('students.manage');

  const [query, setQuery] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [academicYearId, setAcademicYearId] = React.useState('');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [showRestored, setShowRestored] = React.useState(false);
  const [sort, setSort] = React.useState('exit_desc');
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const [recording, setRecording] = React.useState(false);
  const [recordForm, setRecordForm] = React.useState({
    studentId: '',
    reason: '',
    exitDate: '',
    destination: '',
    lastGradeLevel: '',
    lastStream: '',
    notes: '',
  });
  const [restoring, setRestoring] = React.useState<TransitionRecord | null>(null);
  const [restoreForm, setRestoreForm] = React.useState({
    targetGradeLevel: '',
    classId: '',
    notes: '',
  });
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const params = new URLSearchParams({ sort });
  if (debounced) params.set('search', debounced);
  if (reason) params.set('reason', reason);
  if (academicYearId) params.set('academicYearId', academicYearId);
  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo) params.set('dateTo', dateTo);
  if (showRestored) params.set('includeRestored', 'true');
  params.set('limit', '200');

  const { data, loading, error, refetch } = useApi<TransitionsResponse>(
    canView ? `/api/student-transitions?${params.toString()}` : null
  );
  const options = useApi<OptionsResponse>(
    canView ? '/api/student-transitions/options' : null
  );
  const detail = useApi<TransitionDetail>(
    canView && selectedId ? `/api/student-transitions/${selectedId}` : null
  );

  const students = useApi<StudentsResponse>(canManage ? '/api/students' : null);
  const classes = useApi<ClassesResponse>(canManage ? '/api/classes' : null);

  const transitions = React.useMemo(() => data?.transitions ?? [], [data]);
  const total = data?.total ?? transitions.length;

  const completed = transitions.filter((r) => r.reason === 'completed').length;
  const transferred = transitions.filter((r) => r.reason === 'transferred').length;
  const withdrawn = transitions.filter((r) => r.reason === 'withdrawn').length;
  const restoredCount = transitions.filter((r) => r.isRestored).length;

  const columns: Array<DataTableColumn<TransitionRecord>> = [
    {
      id: 'learner',
      header: 'Learner',
      cell: (row) => {
        const name = displayName(row);
        return (
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-bold text-muted-foreground">
              {row.avatar ? (
                <span
                  role="img"
                  aria-label=""
                  className="h-full w-full bg-cover bg-center"
                  style={{ backgroundImage: `url(${row.avatar})` }}
                />
              ) : (
                initialsOf(name || row.email)
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{name || 'Unnamed'}</p>
              <p className="truncate text-xs text-muted-foreground">
                {[
                  row.dateOfBirth ? `b. ${formatDate(row.dateOfBirth)}` : null,
                  row.enrollmentDate ? `joined ${formatDate(row.enrollmentDate)}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || row.email}
              </p>
            </div>
          </div>
        );
      },
      sortValue: (row) => displayName(row),
    },
    {
      id: 'reason',
      header: 'Exit Reason',
      cell: (row) => (
        <div className="min-w-0">
          <StatusPill
            label={REASON_LABEL[row.reason] ?? row.reason}
            tone={REASON_TONE[row.reason] ?? 'neutral'}
          />
          {row.reason === 'transferred' && row.destination ? (
            <p className="mt-1 truncate text-xs text-muted-foreground">to {row.destination}</p>
          ) : null}
        </div>
      ),
      sortValue: (row) => row.reason,
    },
    {
      id: 'level',
      header: 'Last Level',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-foreground">{row.lastGradeLevel || 'Not recorded'}</p>
          <p className="truncate text-xs text-muted-foreground">
            {row.lastStream ? `Stream ${row.lastStream}` : 'No stream recorded'}
          </p>
        </div>
      ),
      sortValue: (row) => row.lastGradeLevel ?? '',
    },
    {
      id: 'date',
      header: 'Exit Date',
      cell: (row) => <span className="text-sm text-foreground">{formatDate(row.exitDate)}</span>,
      sortValue: (row) => row.exitDate,
    },
    {
      id: 'status',
      header: 'Account',
      cell: (row) => (
        <StatusPill
          label={row.isRestored ? 'Restored' : row.accountStatus}
          tone={row.isRestored ? 'success' : ACCOUNT_TONE[row.accountStatus] ?? 'neutral'}
        />
      ),
      sortValue: (row) => (row.isRestored ? 'restored' : row.accountStatus),
    },
  ];

  async function recordExit() {
    const { studentId, reason: r, exitDate, destination, lastGradeLevel, lastStream, notes } = recordForm;
    if (!studentId || !r) {
      notify.error('Select a student and choose an exit reason.');
      return;
    }
    if (r === 'transferred' && !destination.trim()) {
      notify.error('A transfer needs a destination school.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/student-transitions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          reason: r,
          ...(exitDate ? { exitDate } : {}),
          ...(lastGradeLevel.trim() ? { lastGradeLevel: lastGradeLevel.trim() } : {}),
          ...(lastStream.trim() ? { lastStream: lastStream.trim() } : {}),
          ...(destination.trim() ? { destination: destination.trim() } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        notify.error(body?.error?.message ?? `Could not record the exit (HTTP ${res.status}).`);
        return;
      }

      notify.success('Exit recorded for the learner');
      setRecording(false);
      setRecordForm({
        studentId: '', reason: '', exitDate: '', destination: '', lastGradeLevel: '', lastStream: '', notes: '',
      });
      refetch();
      detail.refetch();
    } catch {
      notify.error('Could not reach the API. Check that it is running.');
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    if (!restoring) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/student-transitions/${restoring.id}/restore`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(restoreForm.targetGradeLevel.trim() ? { targetGradeLevel: restoreForm.targetGradeLevel.trim() } : {}),
          ...(restoreForm.classId ? { classId: restoreForm.classId } : {}),
          ...(restoreForm.notes.trim() ? { notes: restoreForm.notes.trim() } : {}),
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        notify.error(body?.error?.message ?? `The restore was refused (HTTP ${res.status}).`);
        return;
      }

      notify.success(`${displayName(restoring)} returned to the active roll`);
      setRestoring(null);
      setRestoreForm({ targetGradeLevel: '', classId: '', notes: '' });
      setSelectedId(null);
      refetch();
      detail.refetch();
    } catch {
      notify.error('Could not reach the API. Check that it is running.');
    } finally {
      setBusy(false);
    }
  }

  if (!canView) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Student Transitions" />
        <ErrorState
          title="You do not have access to student transitions"
          message="Viewing transitions requires students.view. Your role does not hold it, and the API refuses the request independently of this screen."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Student Transitions"
        description={`Academic lifecycle of learners - enrollments, class placements, exits and restorations. ${total === 1 ? '1 record' : `${total} records`} on the transition log.`}
        action={
          canManage ? (
            <Button
              variant="default"
              size="md"
              onClick={() => setRecording(true)}
              className="inline-flex items-center gap-1.5"
            >
              <NavIcon name="file-minus" className="h-4 w-4" />
              Record an Exit
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <DashboardCard title="On the roll" value={total} icon="arrow-right-left" tone="accent" description="Students with a transition recorded" />
        <DashboardCard title="Completed" value={completed} icon="check" tone="success" description="Finished their level" />
        <DashboardCard title="Transferred" value={transferred} icon="arrow-right-left" description="Moved to another school" />
        <DashboardCard title="Withdrawn" value={withdrawn} icon="triangle-alert" tone={withdrawn > 0 ? 'warning' : 'default'} description="Left before completing" />
        <DashboardCard title="Restored" value={restoredCount} icon="undo-2" tone="success" description="Returned to the active roll" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          {loading ? (
            <LoadingState label="Loading transitions" />
          ) : error ? (
            <ErrorState
              title="Could not load transitions"
              message="GET /api/student-transitions requires students.view. Confirm the API is running and that your session still holds the permission."
              onRetry={refetch}
            />
          ) : (
            <DataTable
              caption="Student transitions"
              columns={columns}
              rows={transitions}
              rowKey={(row) => row.id}
              pageSize={15}
              onRowClick={(row) => setSelectedId(row.id)}
              toolbar={
                <ContextFilterBar
                  search={{
                    value: query,
                    onChange: setQuery,
                    placeholder: 'Search by name, email or admission no.…',
                  }}
                  filters={[
                    {
                      id: 'reason',
                      label: 'Exit Reason',
                      value: reason,
                      options: (options.data?.reasons ?? []).map((r) => ({
                        value: r.value,
                        label: `${REASON_LABEL[r.value] ?? r.value} (${r.count})`,
                      })),
                      onChange: setReason,
                      allLabel: 'All reasons',
                    },
                    {
                      id: 'session',
                      label: 'Academic Session',
                      value: academicYearId,
                      options: options.data?.academicYears ?? [],
                      onChange: setAcademicYearId,
                      allLabel: 'All sessions',
                    },
                    {
                      id: 'sort',
                      label: 'Sort by',
                      value: sort,
                      options: SORTS,
                      onChange: setSort,
                      allowAll: false,
                    },
                  ]}
                  actions={
                    <div className="flex items-end gap-2">
                      <label className="block text-xs font-medium text-muted-foreground" htmlFor="date-from">
                        From
                      </label>
                      <input
                        id="date-from"
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="h-9 w-40 rounded-md border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      <label className="block text-xs font-medium text-muted-foreground" htmlFor="date-to">
                        To
                      </label>
                      <input
                        id="date-to"
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="h-9 w-40 rounded-md border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={showRestored}
                          onChange={(e) => setShowRestored(e.target.checked)}
                          className="h-4 w-4"
                        />
                        Restored
                      </label>
                    </div>
                  }
                />
              }
              empty={
                <EmptyState
                  title={
                    transitions.length === 0 && !debounced && !reason && !academicYearId && !dateFrom && !dateTo
                      ? 'No student transitions yet'
                      : 'No transitions match these filters'
                  }
                  description={
                    transitions.length === 0 && !debounced && !reason && !academicYearId && !dateFrom && !dateTo
                      ? 'Exits and restores will appear here as they are recorded.'
                      : 'Adjust the search or filters above.'
                  }
                  icon="arrow-right-left"
                />
              }
            />
          )}
        </div>

        <div>
          {selectedId && detail.loading ? (
            <LoadingState label="Loading learner detail" />
          ) : selectedId && detail.error ? (
            <ErrorState
              title="Could not load the learner detail"
              message="Select another row or try again."
              onRetry={() => detail.refetch()}
            />
          ) : selectedId && detail.data ? (
            <DetailPanel
              detail={detail.data}
              onRestore={() => setRestoring(transitions.find((r) => r.id === selectedId) ?? null)}
              canManage={canManage}
            />
          ) : (
            <EmptyState
              title="Select a transition"
              description="Click a row to view the learner's identity card and lifecycle timeline."
              icon="mouse-pointer"
            />
          )}
        </div>
      </div>

      <FloatingFormModal
        isOpen={recording}
        onClose={() => {
          setRecording(false);
          setRecordForm({
            studentId: '', reason: '', exitDate: '', destination: '', lastGradeLevel: '', lastStream: '', notes: '',
          });
        }}
        title="Record an Exit"
        description="Archives the learner's account and records the reason and destination. The learner's attendance, grades, documents and parent links stay attached to the same profile record."
        icon="file-minus"
        submitLabel="Record exit"
        isSubmitting={busy}
        onSubmit={recordExit}
        size="lg"
      >
        <div className="grid grid-cols-1 gap-4">
          <Field label="Learner" hint="Select the student leaving the school">
            <Select
              value={recordForm.studentId}
              onChange={(e) => setRecordForm({ ...recordForm, studentId: e.target.value })}
            >
              <option value="">Select a learner…</option>
              {(students.data?.students ?? []).map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name || [row.firstName, row.lastName].filter(Boolean).join(' ') || row.email}
                  {row.gradeLevel ? ` - ${row.gradeLevel}` : ''}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Exit Reason" required>
            <Select
              value={recordForm.reason}
              onChange={(e) => setRecordForm({ ...recordForm, reason: e.target.value })}
            >
              <option value="">Choose a reason…</option>
              <option value="completed">Completed</option>
              <option value="transferred">Transferred</option>
              <option value="withdrawn">Withdrawn</option>
            </Select>
          </Field>
          <Field label="Exit Date" hint="Defaults to today if left blank">
            <TextInput
              type="date"
              value={recordForm.exitDate}
              onChange={(e) => setRecordForm({ ...recordForm, exitDate: e.target.value })}
            />
          </Field>
          {recordForm.reason === 'transferred' ? (
            <Field label="Destination School" hint="Where the learner is moving to">
              <TextInput
                value={recordForm.destination}
                onChange={(e) => setRecordForm({ ...recordForm, destination: e.target.value })}
                placeholder="e.g. Green Valley Secondary"
              />
            </Field>
          ) : null}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Last Grade Level" hint="Defaults to current level">
              <TextInput
                value={recordForm.lastGradeLevel}
                onChange={(e) => setRecordForm({ ...recordForm, lastGradeLevel: e.target.value })}
              />
            </Field>
            <Field label="Stream" hint="Optional free-text stream">
              <TextInput
                value={recordForm.lastStream}
                onChange={(e) => setRecordForm({ ...recordForm, lastStream: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Notes">
            <TextInput
              value={recordForm.notes}
              onChange={(e) => setRecordForm({ ...recordForm, notes: e.target.value })}
              placeholder="Optional context for the record…"
            />
          </Field>
        </div>
      </FloatingFormModal>

      <FloatingFormModal
        isOpen={canManage && Boolean(restoring)}
        onClose={() => {
          setRestoring(null);
          setRestoreForm({ targetGradeLevel: '', classId: '', notes: '' });
        }}
        title={`Restore ${displayName(restoring) || restoring?.email || ''}`}
        description="This reactivates the account, returns the learner to the active roll and stamps the exit as reversed."
        icon="undo-2"
        submitLabel="Restore learner"
        isSubmitting={busy}
        onSubmit={restore}
        size="md"
      >
        <div className="grid grid-cols-1 gap-4">
          <Field
            label="Grade to return into"
            hint={`Defaults to ${restoring?.lastGradeLevel ?? 'their last level'}`}
          >
            <TextInput
              value={restoreForm.targetGradeLevel}
              onChange={(e) => setRestoreForm({ ...restoreForm, targetGradeLevel: e.target.value })}
              placeholder={restoring?.lastGradeLevel ?? 'Year 7'}
            />
          </Field>
          <Field label="Class" hint="Optional class placement">
            <Select
              value={restoreForm.classId}
              onChange={(e) => setRestoreForm({ ...restoreForm, classId: e.target.value })}
            >
              <option value="">Do not place in a class</option>
              {(classes.data?.classes ?? []).map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                  {row.gradeLevel ? ` - ${row.gradeLevel}` : ''}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Notes" hint="Optional note for the restore record">
            <TextInput
              value={restoreForm.notes}
              onChange={(e) => setRestoreForm({ ...restoreForm, notes: e.target.value })}
              placeholder="e.g. Re-enrolled mid-year for Grade 8"
            />
          </Field>
        </div>
      </FloatingFormModal>
    </div>
  );
}

interface DetailPanelProps {
  detail: TransitionDetail;
  onRestore: () => void;
  canManage: boolean;
}

function DetailPanel({ detail, onRestore, canManage }: DetailPanelProps) {
  const timeline = buildTimeline(detail);
  const name = displayName(detail);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <h2 className="text-lg font-semibold text-foreground">Learner Detail</h2>
        {canManage && !detail.isRestored ? (
          <Button variant="default" size="sm" onClick={onRestore}>
            <NavIcon name="undo-2" className="h-4 w-4" />
            Restore learner
          </Button>
        ) : null}
      </div>

      <div className="rounded-lg border bg-card p-5">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xl font-bold text-muted-foreground">
            {detail.avatar ? (
              <span
                role="img"
                aria-label=""
                className="h-full w-full bg-cover bg-center"
                style={{ backgroundImage: `url(${detail.avatar})` }}
              />
            ) : (
              initialsOf(name || detail.email)
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold text-foreground">{name || 'Unnamed'}</p>
            <p className="text-sm text-muted-foreground">{detail.email}</p>
            {detail.phone ? <p className="text-sm text-muted-foreground">{detail.phone}</p> : null}
          </div>
          <div className="flex shrink-0 gap-2">
            <StatusPill
              label={detail.isRestored ? 'Restored' : detail.accountStatus}
              tone={detail.isRestored ? 'success' : ACCOUNT_TONE[detail.accountStatus] ?? 'neutral'}
            />
            <StatusPill
              label={REASON_LABEL[detail.reason] ?? detail.reason}
              tone={REASON_TONE[detail.reason] ?? 'neutral'}
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <span className="text-muted-foreground">Admission #</span>
            <span className="ml-2 font-mono text-xs">
              {detail.admissionId ? detail.admissionId.slice(-8).toUpperCase() : '-'}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Grade Level</span>
            <span className="ml-2">{detail.gradeLevel || detail.lastGradeLevel || '-'}</span>
          </div>
        <div>
          <span className="text-muted-foreground">Enrollment Date</span>
          <span className="ml-2">{formatDate(detail.enrollmentDate)}</span>
        </div>
        {detail.enrollments[0]?.className ? (
          <div>
            <span className="text-muted-foreground">Last Class</span>
            <span className="ml-2">{detail.enrollments[0].className}</span>
          </div>
        ) : null}
          <div>
            <span className="text-muted-foreground">Exit Date</span>
            <span className="ml-2">{formatDate(detail.exitDate)}</span>
          </div>
          {detail.destination ? (
            <div>
              <span className="text-muted-foreground">Destination</span>
              <span className="ml-2">{detail.destination}</span>
            </div>
          ) : null}
        </div>

        {detail.notes ? (
          <div className="mt-4">
            <span className="block text-xs font-medium text-muted-foreground">Notes</span>
            <p className="mt-1 text-sm text-foreground">{detail.notes}</p>
          </div>
        ) : null}
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Lifecycle Timeline</h3>
        <ol className="relative ml-2 border-l border-muted pl-4">
          {timeline.map((item, i) => (
            <li key={`${item.type}-${i}`} className="mb-4 last:mb-0">
              <div className="absolute -ml-2 h-4 w-4 rounded-full border-2 border-background bg-primary"></div>
              <div className="ml-2">
                <p className="text-xs font-medium uppercase text-muted-foreground">{item.label}</p>
                <p className="text-sm font-medium text-foreground">
                  {item.date ? formatDate(item.date) : '-'}
                </p>
                <p className="text-xs text-muted-foreground">{item.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="flex gap-2 text-xs text-muted-foreground">
        <span>Recorded by {detail.recordedBy?.name ?? detail.recordedBy?.email ?? '-'}</span>
        <span>·</span>
        <span>{formatDate(detail.recordedAt)}</span>
        {detail.restoredAt ? (
          <>
            <span>·</span>
            <span>Restored by {detail.restoredBy?.name ?? detail.restoredBy?.email ?? '-'}</span>
            <span>{formatDate(detail.restoredAt)}</span>
          </>
        ) : null}
      </div>
    </div>
  );
}
