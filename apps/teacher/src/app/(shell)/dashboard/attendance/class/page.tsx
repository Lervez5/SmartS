'use client';

import * as React from 'react';
import { useApi } from '@schoolos/hooks';
import {
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  SectionHeader,
  StatusPill,
  type DataTableColumn,
  type StatusTone,
} from '@schoolos/ui';

/**
 * Teacher attendance marking.
 *
 * `GET /api/classes/teacher/my-cohorts` returns only classes where
 * `Class.teacherId` is the caller, so the class picker cannot be widened.
 * `POST /api/attendance/mark` re-checks that on the server and additionally
 * rejects any student who is not enrolled, so a tampered payload cannot mark a
 * learner outside the class.
 */
interface TeacherClass {
  id: string;
  name: string;
  gradeLevel?: string | null;
  subject?: { id: string; name: string } | null;
  _count?: { enrollments?: number } | null;
}

interface ClassesResponse {
  classes?: TeacherClass[];
}

interface RosterStudent {
  id: string;
  name: string;
  email: string;
  attendance: { id: string; status: string; note?: string | null } | null;
}

interface RosterResponse {
  class: {
    id: string;
    name: string;
    subject?: { id: string; name: string } | null;
  };
  date: string;
  students: RosterStudent[];
}

const STATUSES = ['present', 'absent', 'late', 'excused', 'sick', 'on_leave'] as const;
type MarkStatus = (typeof STATUSES)[number];

const TONE: Record<string, StatusTone> = {
  present: 'success',
  late: 'warning',
  absent: 'danger',
  excused: 'info',
  sick: 'warning',
  on_leave: 'neutral',
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function TeacherAttendanceClassPage() {
  const classes = useApi<ClassesResponse>('/api/classes/teacher/my-cohorts');
  const [classId, setClassId] = React.useState('');
  const [date, setDate] = React.useState(today);
  const [draft, setDraft] = React.useState<Record<string, MarkStatus>>({});
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const classList = classes.data?.classes ?? [];

  // Default to the first class once the list arrives.
  React.useEffect(() => {
    if (!classId && classList.length > 0) setClassId(classList[0].id);
  }, [classList, classId]);

  const roster = useApi<RosterResponse>(
    classId ? `/api/attendance/roster/${classId}?date=${date}` : '/api/attendance/roster/none',
    { onSuccess: () => setSaved(false) }
  );

  // Seed the draft from whatever is already marked, so re-marking one learner
  // does not clear the rest.
  React.useEffect(() => {
    if (!roster.data) return;
    const seeded: Record<string, MarkStatus> = {};
    for (const student of roster.data.students) {
      if (student.attendance?.status) seeded[student.id] = student.attendance.status as MarkStatus;
    }
    setDraft(seeded);
  }, [roster.data]);

  async function submit() {
    if (!classId) return;
    const records = Object.entries(draft).map(([studentId, status]) => ({
      studentId,
      status,
    }));
    if (records.length === 0) {
      setSaveError('Mark at least one learner before saving.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/attendance/mark', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId, date, records }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setSaveError(body?.error?.message ?? `The API rejected the mark (HTTP ${res.status}).`);
        return;
      }
      setSaved(true);
    } catch {
      setSaveError('Could not reach the API. Check that it is running.');
    } finally {
      setSaving(false);
    }
  }

  const columns: Array<DataTableColumn<RosterStudent>> = [
    {
      id: 'name',
      header: 'Learner',
      cell: (row) => (
        <span className="font-medium text-foreground">
          {row.name}
          <span className="mt-0.5 block text-xs text-muted-foreground">{row.email}</span>
        </span>
      ),
      sortValue: (row) => row.name,
    },
    {
      id: 'marked',
      header: 'Saved',
      hideBelow: 'md',
      cell: (row) =>
        row.attendance ? (
          <StatusPill
            label={row.attendance.status.replace(/_/g, ' ')}
            tone={TONE[row.attendance.status] ?? 'neutral'}
          />
        ) : (
          <span className="text-muted-foreground">Not marked</span>
        ),
    },
    {
      id: 'set',
      header: 'Mark as',
      align: 'right',
      cell: (row) => (
        <div className="flex flex-wrap justify-end gap-1">
          {STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              aria-pressed={draft[row.id] === status}
              onClick={() => {
                setSaved(false);
                setDraft((prev) => ({ ...prev, [row.id]: status }));
              }}
              className={`rounded-md border px-2 py-1 text-xs font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                draft[row.id] === status
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-background hover:bg-accent'
              }`}
            >
              {status.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      ),
    },
  ];

  if (classes.loading) return <LoadingState label="Loading your classes" />;

  if (classes.error) {
    return (
      <ErrorState
        title="Could not load your classes"
        message="GET /api/classes/teacher/my-cohorts requires cohorts.view. Confirm the API is running and that your session still holds the permission."
      />
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Mark Attendance"
        description="Record attendance for a class you teach. The API re-checks class ownership and enrolment on save."
        action={
          <button
            type="button"
            onClick={submit}
            disabled={saving || classList.length === 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save attendance'}
          </button>
        }
      />

      {classList.length === 0 ? (
        <EmptyState
          title="You are not assigned to any class"
          description="Class ownership is assigned from the admin portal. Once you own a class it appears here."
          icon="users-round"
        />
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
            <div className="min-w-[220px]">
              <label
                htmlFor="class"
                className="mb-1 block text-xs font-medium text-muted-foreground"
              >
                Class
              </label>
              <select
                id="class"
                value={classId}
                onChange={(event) => setClassId(event.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {classList.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {item.subject?.name ? ` - ${item.subject.name}` : ''}
                    {item.gradeLevel ? ` (${item.gradeLevel})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[160px]">
              <label
                htmlFor="date"
                className="mb-1 block text-xs font-medium text-muted-foreground"
              >
                Date
              </label>
              <input
                id="date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            {saved ? <StatusPill label="Saved" tone="success" className="ml-auto mb-1.5" /> : null}
          </div>

          {saveError ? (
            <div
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
            >
              {saveError}
            </div>
          ) : null}

          {roster.loading ? (
            <LoadingState label="Loading the roster" />
          ) : roster.error ? (
            <ErrorState
              title="Could not load the roster"
              message="GET /api/attendance/roster/:classId requires attendance.view. Confirm the API is running and that your session still holds the permission."
            />
          ) : (
            <DataTable
              caption={`Roster for ${roster.data?.class.name ?? 'the selected class'} on ${date}`}
              columns={columns}
              rows={roster.data?.students ?? []}
              rowKey={(row) => row.id}
              pageSize={20}
              empty={
                <EmptyState
                  title="No learners enrolled"
                  description="Add learners to this class from the admin portal before marking attendance."
                  icon="users-round"
                />
              }
            />
          )}
        </>
      )}
    </div>
  );
}
