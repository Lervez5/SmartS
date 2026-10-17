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
 * `GET /api/classes/teacher/my-cohorts` returns only classes the teacher owns
 * or assists with management rights. `POST /api/attendance/mark` re-checks that
 * on the server and rejects any student not enrolled in the class.
 */
interface TeacherClass {
  id: string;
  name: string;
  gradeLevel?: string | null;
  subject?: { id: string; name: string } | null;
  _count?: { enrollments?: number } | null;
  isAssistant?: boolean;
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

const STATUSES = ['present', 'absent', 'excused', 'sick'] as const;
type MarkStatus = (typeof STATUSES)[number];

const TONE: Record<string, StatusTone> = {
  present: 'success',
  late: 'warning',
  absent: 'danger',
  excused: 'info',
  sick: 'warning',
  on_leave: 'neutral',
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL_DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

function dateStr(d: Date): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function isWeekend(dateStr: string): boolean {
  const d = new Date(dateStr);
  const day = d.getDay();
  return day === 0 || day === 6;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const isToday_ = dateStr === dateStr;
  const dayName = FULL_DAY_NAMES[d.getDay()];
  return isToday_
    ? `Today, ${dayName}`
    : `${dayName}, ${d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
}

function thisWeekDays(): Array<{ date: string; label: string }> {
  const d = new Date();
  const dayOfWeek = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const days: Array<{ date: string; label: string }> = [];
  for (let i = 0; i < 5; i++) {
    const dt = new Date(monday);
    dt.setDate(monday.getDate() + i);
    days.push({ date: dateStr(dt), label: DAY_NAMES[dt.getDay()] });
  }
  return days;
}

export default function TeacherAttendanceClassPage() {
  const classes = useApi<ClassesResponse>('/api/classes/teacher/my-cohorts');
  const [classId, setClassId] = React.useState('');
  const [date, setDate] = React.useState(() => {
    const d = new Date();
    if (d.getDay() === 0) d.setDate(d.getDate() - 2);
    else if (d.getDay() === 6) d.setDate(d.getDate() - 1);
    return dateStr(d);
  });
  const [draft, setDraft] = React.useState<Record<string, MarkStatus>>({});
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const classList = classes.data?.classes ?? [];
  const markedCount = Object.keys(draft).length;

  React.useEffect(() => {
    if (!classId && classList.length > 0) setClassId(classList[0].id);
  }, [classList, classId]);

  const roster = useApi<RosterResponse>(
    classId ? `/api/attendance/roster/${classId}?date=${date}` : '/api/attendance/roster/none',
    { onSuccess: () => setSaved(false) }
  );

  React.useEffect(() => {
    if (!roster.data) return;
    const seeded: Record<string, MarkStatus> = {};
    for (const student of roster.data.students) {
      if (student.attendance?.status) seeded[student.id] = student.attendance.status as MarkStatus;
    }
    setDraft(seeded);
  }, [roster.data]);

  function setAll(status: MarkStatus) {
    if (!roster.data?.students) return;
    const next: Record<string, MarkStatus> = {};
    for (const student of roster.data.students) {
      next[student.id] = status;
    }
    setDraft(next);
    setSaved(false);
  }

  async function submit() {
    if (!classId) return;
    if (isWeekend(date)) {
      setSaveError('Attendance can only be recorded on school days (Monday–Friday).');
      return;
    }
    const records = Object.entries(draft).map(([studentId, status]) => ({ studentId, status }));
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
         const body = (await res.json().catch(() => null)) as
           | { saved?: number; rejected?: string[]; error?: { message?: string } }
           | null;
         if (!res.ok) {
           setSaveError(body?.error?.message ?? `The API rejected the mark (HTTP ${res.status}).`);
           return;
         }
         if ((body?.saved ?? 0) === 0) {
           setSaveError(
             'No attendance was saved — the students in your roster may have changed. Try picking another date or refreshing the page.'
           );
           return;
         }
         setSaved(true);
         setDraft({});
         await roster.refetch();
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
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
            {row.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .slice(0, 2)}
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">{row.name}</p>
            <p className="text-xs text-muted-foreground">{row.email}</p>
          </div>
        </div>
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
          <span className="text-xs text-muted-foreground">Not marked</span>
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
              className={`
                rounded-md border px-2 py-1 text-xs font-medium capitalize
                transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                ${
                  draft[row.id] === status
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-background hover:bg-accent'
                }
              `}
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
      />

      {classList.length === 0 ? (
        <EmptyState
          title="You are not assigned to any class"
          description="Class ownership is assigned from the admin portal. Once you own a class it appears here."
          icon="users-round"
        />
      ) : (
        <>
          {/* Class + Date selectors */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[200px_180px]">
            <div>
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
                    {item.subject?.name ? ` · ${item.subject.name}` : ''}
                    {` (${item._count?.enrollments ?? 0} learners)`}
                    {item.isAssistant ? ' (Assistant)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
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
              <p className="mt-1 text-xs text-muted-foreground">
                {isWeekend(date)
                  ? 'Weekends are not school days — pick a weekday to mark attendance.'
                  : `${formatDateLabel(date)} · School days only (Mon–Fri)`}
              </p>
            </div>
          </div>

          {/* Quick Week navigator */}
          {classId && (
            <div className="rounded-lg border bg-card p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">This week</p>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    if (d.getDay() === 0) d.setDate(d.getDate() - 2);
                    else if (d.getDay() === 6) d.setDate(d.getDate() - 1);
                    setDate(dateStr(d));
                  }}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Jump to today
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                {thisWeekDays().map((day) => {
                  const isMarked = roster.data?.students.some((s) => s.attendance?.status);
                  const isActive = date === day.date;
                  const isToday_ = day.date === dateStr(new Date());
                  const isWeekend_ = isWeekend(day.date);
                  return (
                    <button
                      key={day.date}
                      type="button"
                      disabled={isWeekend_}
                      onClick={() => setDate(day.date)}
                      className={`
                        flex flex-col items-center gap-0.5 rounded-md border px-2.5 py-1.5 text-xs font-medium
                        transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                        ${
                          isWeekend_
                            ? 'cursor-not-allowed border-border bg-muted/30 text-muted-foreground/40'
                            : isActive
                            ? 'border-primary bg-primary text-primary-foreground'
                            : isMarked
                            ? 'border-success/30 bg-success/5 text-success-foreground'
                            : 'border-input bg-background text-foreground hover:bg-accent'
                        }
                      `}
                    >
                      <span>{day.label}</span>
                      <span className="text-xs">
                        {new Date(day.date).getDate()}
                      </span>
                      {isToday_ && !isWeekend_ && (
                        <span className="rounded-full bg-primary/20 px-1 py-0.25 text-[0.6rem] font-bold">
                          Today
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick actions */}
          {roster.data?.students && roster.data.students.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAll('present')}
                disabled={saving || isWeekend(date)}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
              >
                Mark all present
              </button>
              <button
                type="button"
                onClick={() => setAll('absent')}
                disabled={saving || isWeekend(date)}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
              >
                Mark all absent
              </button>
            </div>
          )}

          {saveError ? (
            <div
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
            >
              {saveError}
            </div>
          ) : null}

          {/* Roster */}
          {roster.loading ? (
            <LoadingState label="Loading the roster" />
          ) : roster.error ? (
            <ErrorState
              title="Could not load the roster"
              message="GET /api/attendance/roster/:classId requires attendance.view. Confirm the API is running and that your session still holds the permission."
            />
          ) : (
            <>
              {roster.data?.students.length ? (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Roster for {roster.data.class.name} — {markedCount} of {roster.data.students.length} marked
                  </p>
                  <div className="flex items-center gap-3">
                    {saved && (
                      <StatusPill label="Saved" tone="success" />
                    )}
                    <button
                      type="button"
                      onClick={submit}
                      disabled={saving || isWeekend(date) || markedCount === 0}
                      className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                    >
                      {saving ? 'Saving…' : `Save (${markedCount} marked)`}
                    </button>
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="No learners enrolled"
                  description="Add learners to this class from the admin portal before marking attendance."
                  icon="users-round"
                />
              )}
              <DataTable
                caption={
                  roster.data?.students.length
                    ? `Roster for ${roster.data.class.name} on ${date}`
                    : undefined
                }
                columns={columns}
                rows={roster.data?.students ?? []}
                rowKey={(row) => row.id}
                pageSize={20}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
