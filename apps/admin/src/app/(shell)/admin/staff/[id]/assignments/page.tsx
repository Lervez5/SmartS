'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useApi } from '@schoolos/hooks';
import { useAuth } from '@schoolos/auth';
import {
  ActionButtons,
  ContextFilterBar,
  DataTable,
  DashboardCard,
  EmptyState,
  ErrorState,
  LoadingState,
  PrimaryActionButton,
  SectionHeader,
  SettingsCard,
  StatusPill,
  type DataTableColumn,
  type StatusTone,
  notify,
} from '@schoolos/ui';

/**
 * Staff academic assignments.
 *
 * Reads `GET /api/staff/:userId/assignments` for the staff member's current
 * allocations and uses the existing Teacher Allocation endpoints for creates
 * and endings, so this page never duplicates the authoritative allocation
 * model. The form choices come from `GET /api/teacher-allocation/options`,
 * which is scoped to the caller's school.
 */
interface StaffAssignment {
  id: string;
  responsibility: string;
  status: string;
  canManage: boolean;
  canEnterResults: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  teacher: {
    id: string;
    name: string | null;
    email: string;
  };
  subject: {
    id: string;
    name: string;
    code: string | null;
  } | null;
  academicSession: {
    id: string;
    name: string;
    label: string | null;
    status: string;
  };
  stream: {
    id: string;
    name: string;
    code: string;
    class: {
      id: string;
      name: string;
      gradeLevel: string | null;
    };
  };
}

interface AssignmentsResponse {
  teacher?: {
    id: string;
    name: string | null;
    email: string;
  };
  assignments?: StaffAssignment[];
}

interface OptionsResponse {
  sessions: Array<{ id: string; name: string; label: string | null; status: string }>;
  activeSessionId: string | null;
  classes: Array<{
    id: string;
    name: string;
    gradeLevel: string | null;
    streams: Array<{ id: string; name: string; code: string }>;
  }>;
  subjects: Array<{ id: string; name: string; code: string | null }>;
  teachers: Array<{ id: string; name: string; email: string }>;
}

interface ClassOption {
  id: string;
  name: string;
  gradeLevel: string | null;
  streams: Array<{ id: string; name: string; code: string }>;
}

const EMPLOYMENT_TONE: Record<string, StatusTone> = {
  active: 'success',
  on_leave: 'warning',
  terminated: 'danger',
  archived: 'neutral',
};

const RESPONSIBILITY_TONE: Record<string, StatusTone> = {
  main_class_teacher: 'success',
  assistant_class_teacher: 'info',
  subject_teacher: 'brand',
};

const RESPONSIBILITY_LABEL: Record<string, string> = {
  main_class_teacher: 'Main class teacher',
  assistant_class_teacher: 'Assistant teacher',
  subject_teacher: 'Subject teacher',
};

export default function AdminStaffAssignmentsPage() {
  const params = useParams();
  const staffId = params?.id as string | undefined;
  const router = useRouter();
  const { can, user } = useAuth();
  const allowed = can('staff.view');
  const canCreate = can('teaching.manage');

  const { data, loading, error, refetch } = useApi<AssignmentsResponse>(
    allowed && staffId ? `/api/staff/${staffId}/assignments` : '/api/staff?denied=1'
  );

  const { data: optionsData } = useApi<OptionsResponse>(
    canCreate ? '/api/teacher-allocation/options' : '/api/teacher-allocation/options?denied=1'
  );

  const assignments = React.useMemo(() => data?.assignments ?? [], [data]);
  const teacher = data?.teacher;

  const [sessionId, setSessionId] = React.useState('');
  const [classId, setClassId] = React.useState('');
  const [streamId, setStreamId] = React.useState('');
  const [responsibility, setResponsibility] = React.useState<
    'main_class_teacher' | 'assistant_class_teacher' | 'subject_teacher'
  >('main_class_teacher');
  const [subjectId, setSubjectId] = React.useState('');
  const [canManage, setCanManage] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const sessions = React.useMemo(() => optionsData?.sessions ?? [], [optionsData]);
  const classes = React.useMemo(() => optionsData?.classes ?? [], [optionsData]);
  const subjects = React.useMemo(() => optionsData?.subjects ?? [], [optionsData]);

  React.useEffect(() => {
    if (!sessionId && optionsData?.activeSessionId) {
      setSessionId(optionsData.activeSessionId);
    }
  }, [optionsData?.activeSessionId, sessionId]);

  const classOptions = React.useMemo(() => classes, [classes]);

  const streamsForSelectedClass = React.useMemo(() => {
    if (!classId) return [];
    const cls = classes.find((c) => c.id === classId);
    return cls?.streams ?? [];
  }, [classId, classes]);

  const subjectRequired = responsibility === 'subject_teacher';
  const assistantCanManage = responsibility === 'assistant_class_teacher';

  React.useEffect(() => {
    if (!assistantCanManage) setCanManage(false);
  }, [assistantCanManage]);

  const activeAssignments = React.useMemo(
    () => assignments.filter((a) => a.status === 'active'),
    [assignments]
  );

  const mainTeacherCount = activeAssignments.filter(
    (a) => a.responsibility === 'main_class_teacher'
  ).length;
  const assistantTeacherCount = activeAssignments.filter(
    (a) => a.responsibility === 'assistant_class_teacher'
  ).length;
  const subjectTeacherCount = activeAssignments.filter(
    (a) => a.responsibility === 'subject_teacher'
  ).length;

  async function createAllocation() {
    if (!teacher || !sessionId || !streamId) {
      setFormError('Select a session and a stream before saving.');
      return;
    }
    if (subjectRequired && !subjectId) {
      setFormError('Select a learning area for a subject teacher assignment.');
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        academicYearId: sessionId,
        streamId,
        teacherId: teacher.id,
        responsibility,
        canManage: assistantCanManage ? canManage : undefined,
        canEnterResults: true,
      };
      if (subjectRequired && subjectId) body.subjectId = subjectId;

      const res = await fetch('/api/teacher-allocation', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setFormError(body?.error?.message ?? `The API refused the change (HTTP ${res.status}).`);
        return;
      }

      notify.success('Assignment created');
      setStreamId('');
      setSubjectId('');
      setResponsibility('main_class_teacher');
      setCanManage(false);
      refetch();
    } catch {
      notify.error('Could not reach the API. Check that it is running.');
    } finally {
      setSaving(false);
    }
  }

  async function endAssignment(allocationId: string) {
    if (!confirm('End this allocation? The record is preserved as history.')) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/teacher-allocation/${allocationId}/end`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        notify.error(body?.error?.message ?? `The API refused the change (HTTP ${res.status}).`);
        return;
      }

      notify.success('Allocation ended');
      refetch();
    } catch {
      notify.error('Could not reach the API.');
    } finally {
      setSaving(false);
    }
  }

  if (!allowed) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Academic assignments" />
        <ErrorState
          title="You do not have access to staff records"
          message="Viewing staff requires staff.view. Your role does not hold it, and the API refuses the request independently of this screen."
        />
      </div>
    );
  }

  if (loading) return <LoadingState label="Loading academic assignments" />;

  if (error || !teacher) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Academic assignments" />
        <ErrorState
          title="Could not load assignments"
          message="The staff record or its assignments could not be loaded. Confirm the API is running and that your session still holds the permission."
        />
      </div>
    );
  }

  const name = teacher.name ?? teacher.email;

  const assignmentColumns: Array<DataTableColumn<StaffAssignment>> = [
    {
      id: 'session',
      header: 'Session',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{row.academicSession.name}</p>
          {row.academicSession.label && (
            <p className="truncate text-xs text-muted-foreground">{row.academicSession.label}</p>
          )}
        </div>
      ),
      sortValue: (row) => row.academicSession.name,
    },
    {
      id: 'stream',
      header: 'Stream',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {row.stream.class.name} / {row.stream.name}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            Grade {row.stream.class.gradeLevel || '-'} · Stream {row.stream.code}
          </p>
        </div>
      ),
      sortValue: (row) => `${row.stream.class.name} ${row.stream.code}`,
    },
    {
      id: 'responsibility',
      header: 'Responsibility',
      cell: (row) => (
        <div className="flex flex-col gap-1">
          <StatusPill
            label={RESPONSIBILITY_LABEL[row.responsibility] ?? row.responsibility}
            tone={RESPONSIBILITY_TONE[row.responsibility] ?? 'neutral'}
          />
          {row.responsibility === 'assistant_class_teacher' && (
            <span className="text-xs text-muted-foreground">
              {row.canManage ? 'Can manage stream' : 'View only'}
            </span>
          )}
          {row.subject && <span className="text-xs text-muted-foreground">{row.subject.name}</span>}
        </div>
      ),
      sortValue: (row) => row.responsibility,
    },
    {
      id: 'period',
      header: 'Period',
      cell: (row) => (
        <div className="text-xs">
          <p>{row.effectiveFrom}</p>
          {row.effectiveTo && <p className="text-muted-foreground">to {row.effectiveTo}</p>}
        </div>
      ),
      sortValue: (row) => row.effectiveFrom,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => (
        <StatusPill label={row.status} tone={row.status === 'active' ? 'success' : 'neutral'} />
      ),
      sortValue: (row) => row.status,
    },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        title={`Academic assignments: ${name}`}
        description="Teaching allocations for this staff member, from the authoritative StreamAllocation model."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {can('teaching.view') ? (
              <PrimaryActionButton
                href="/admin/academics/teacher-allocation"
                label="View Teaching Teams"
                icon="users"
                variant="outline"
              />
            ) : null}
            <a
              href={`/admin/staff/${staffId}`}
              className="rounded-md border border-input bg-background px-3.5 py-2 text-sm font-semibold transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Back to profile
            </a>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardCard
          title="Main teacher"
          value={mainTeacherCount}
          icon="user-round-check"
          tone="success"
          description="Active streams led"
        />
        <DashboardCard
          title="Assistant teacher"
          value={assistantTeacherCount}
          icon="user-round"
          tone="accent"
          description="Active streams supported"
        />
        <DashboardCard
          title="Subject teacher"
          value={subjectTeacherCount}
          icon="book-open"
          tone="default"
          description="Active learning areas"
        />
        <DashboardCard
          title="Total active"
          value={activeAssignments.length}
          icon="graduation-cap"
          tone="accent"
          description="Across all sessions"
        />
      </div>

      {canCreate && (
        <SettingsCard
          title="New assignment"
          description="Assign this staff member to a stream for the selected academic session. The form options come from the caller's own school."
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Academic session
              </label>
              <select
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select session…</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.label ? `(${s.label})` : ''} [{s.status}]
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Grade / Class
              </label>
              <select
                value={classId}
                onChange={(e) => {
                  setClassId(e.target.value);
                  setStreamId('');
                }}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select class…</option>
                {classOptions.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name} {cls.gradeLevel ? `(Grade ${cls.gradeLevel})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Stream</label>
              <select
                value={streamId}
                onChange={(e) => setStreamId(e.target.value)}
                disabled={!classId || streamsForSelectedClass.length === 0}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
              >
                <option value="">Select stream…</option>
                {streamsForSelectedClass.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Responsibility
              </label>
              <select
                value={responsibility}
                onChange={(e) => setResponsibility(e.target.value as typeof responsibility)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="main_class_teacher">Main class teacher</option>
                <option value="assistant_class_teacher">Assistant teacher</option>
                <option value="subject_teacher">Subject / Learning area teacher</option>
              </select>
            </div>

            {subjectRequired && (
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Learning area / Subject
                </label>
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select subject…</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.code ? `(${s.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {assistantCanManage && (
              <div className="flex items-center gap-2">
                <input
                  id="canManage"
                  type="checkbox"
                  checked={canManage}
                  onChange={(e) => setCanManage(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <label htmlFor="canManage" className="text-sm text-foreground">
                  May manage this stream (attendance, learners, class communication)
                </label>
              </div>
            )}

            <div className="flex items-end">
              <button
                onClick={createAllocation}
                disabled={saving}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Create assignment'}
              </button>
            </div>

            {formError && <p className="text-xs text-danger">{formError}</p>}
          </div>
        </SettingsCard>
      )}

      <SettingsCard
        title="Current assignments"
        description="Active academic allocations. Ended allocations are preserved as history and do not appear here."
      >
        <DataTable
          caption="Academic assignments"
          columns={assignmentColumns}
          rows={activeAssignments}
          rowKey={(row) => row.id}
          pageSize={20}
          renderRowActions={(row) => (
            <ActionButtons
              items={[
                {
                  id: 'end',
                  label: `End ${RESPONSIBILITY_LABEL[row.responsibility] ?? row.responsibility} for ${row.stream.class.name} / ${row.stream.name}`,
                  onClick: () => endAssignment(row.id),
                  icon: 'archive',
                },
              ]}
            />
          )}
          empty={
            <EmptyState
              title="No active assignments"
              description="This staff member has no active teaching allocations."
              icon="book-open"
            />
          }
        />
      </SettingsCard>
    </div>
  );
}
