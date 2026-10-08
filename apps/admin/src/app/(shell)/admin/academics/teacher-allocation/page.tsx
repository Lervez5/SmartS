'use client';

/**
 * Teacher Allocation - the administrative record of who is responsible for what.
 *
 * A class is divided into streams, and each stream carries its own teaching team:
 * one designated main class teacher, any number of assistants, and any number of
 * learning-area teachers. A class with three streams therefore has three teams,
 * which is why allocation hangs off the stream rather than the class.
 *
 * This screen reads and writes that record. It does not create accounts: a
 * teacher who has no account is provisioned through the invitations workflow,
 * because identity and teaching responsibility are separate concerns.
 *
 * Both directions of the relationship are shown, because a school administrator
 * asks questions in both: "who covers Stream A?" and "what does Ms Grace carry?".
 * The view toggle switches between them, and both come from the same API.
 *
 * Every option is read from the caller's own school, so the form can only offer a
 * session, stream, teacher or learning area they are entitled to allocate
 * against. Nothing here is hardcoded and no placeholder allocation is shown.
 */

import * as React from 'react';
import { useApi } from '@schoolos/hooks';
import { useAuth } from '@schoolos/auth';
import {
  ActionButtons,
  ContextFilterBar,
  DashboardCard,
  DataTable,
  EmptyState,
  ErrorState,
  FloatingFormModal,
  LoadingState,
  SectionHeader,
  StatusPill,
  notify,
  type DataTableColumn,
  type StatusTone,
} from '@schoolos/ui';

type Responsibility = 'main_class_teacher' | 'assistant_class_teacher' | 'subject_teacher';

interface Person {
  id: string;
  name: string | null;
  email: string;
}

interface SubjectRef {
  id: string;
  name: string;
  code: string | null;
}

interface StreamRef {
  id: string;
  name: string;
  code: string;
  class: { id: string; name: string; gradeLevel: string | null };
}

interface Allocation {
  id: string;
  responsibility: Responsibility;
  status: 'active' | 'inactive';
  canManage: boolean;
  canEnterResults: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  teacher: Person;
  subject: SubjectRef | null;
  academicSession: { id: string; name: string; label: string | null; status: string };
  stream: StreamRef;
}

interface Options {
  sessions: Array<{ id: string; name: string; label: string | null; status: string }>;
  activeSessionId: string | null;
  classes: Array<{
    id: string;
    name: string;
    gradeLevel: string | null;
    streams: Array<{ id: string; name: string; code: string }>;
  }>;
  subjects: SubjectRef[];
  teachers: Person[];
}

interface ListResponse {
  allocations?: Allocation[];
  total?: number;
  note?: string;
}

const RESPONSIBILITY_LABEL: Record<Responsibility, string> = {
  main_class_teacher: 'Main class teacher',
  assistant_class_teacher: 'Assistant class teacher',
  subject_teacher: 'Learning-area teacher',
};

const RESPONSIBILITY_TONE: Record<Responsibility, StatusTone> = {
  main_class_teacher: 'brand',
  assistant_class_teacher: 'info',
  subject_teacher: 'warning',
};

function formatDate(value?: string | null): string {
  if (!value) return '-';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? '-'
    : parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function personName(person: Person | null | undefined): string {
  if (!person) return 'Unassigned';
  return person.name ?? person.email;
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </span>
      <div className="mt-1.5">{children}</div>
      {hint ? <span className="mt-1 block text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

const selectClass =
  'h-10 w-full rounded-md border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export default function AdminTeacherAllocationPage() {
  const { can } = useAuth();
  const allowed = can('teaching.view');
  const canManage = can('teaching.manage');

  const [sessionId, setSessionId] = React.useState('');
  const [classId, setClassId] = React.useState('');
  const [streamId, setStreamId] = React.useState('');
  const [teacherId, setTeacherId] = React.useState('');
  const [subjectId, setSubjectId] = React.useState('');
  const [responsibility, setResponsibility] = React.useState('');
  const [status, setStatus] = React.useState('active');
  const [search, setSearch] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [showForm, setShowForm] = React.useState(false);

  // Form state, kept here so the panel and the filters agree about the session.
  const [formClassId, setFormClassId] = React.useState('');
  const [formStreamId, setFormStreamId] = React.useState('');
  const [formTeacherId, setFormTeacherId] = React.useState('');
  const [formResponsibility, setFormResponsibility] = React.useState<Responsibility>(
    'main_class_teacher'
  );
  const [formSubjectId, setFormSubjectId] = React.useState('');
  const [formCanManage, setFormCanManage] = React.useState(true);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const options = useApi<Options>(allowed ? '/api/teacher-allocation/options' : null);

  // Default to the school's active session, which is what allocation applies to.
  React.useEffect(() => {
    if (!sessionId && options.data?.activeSessionId) setSessionId(options.data.activeSessionId);
  }, [options.data?.activeSessionId, sessionId]);

  const params = new URLSearchParams();
  if (sessionId) params.set('academicYearId', sessionId);
  if (classId) params.set('classId', classId);
  if (streamId) params.set('streamId', streamId);
  if (teacherId) params.set('teacherId', teacherId);
  if (subjectId) params.set('subjectId', subjectId);
  if (responsibility) params.set('responsibility', responsibility);
  if (status) params.set('status', status);
  if (debounced) params.set('search', debounced);

  const list = useApi<ListResponse>(
    allowed ? `/api/teacher-allocation?${params.toString()}` : '/api/teacher-allocation?denied=1'
  );

  const rows = React.useMemo(() => list.data?.allocations ?? [], [list.data]);

  const classes = options.data?.classes ?? [];
  const streamsInFormClass = React.useMemo(
    () => classes.find((c) => c.id === formClassId)?.streams ?? [],
    [classes, formClassId]
  );

  // Narrowing the form to a class also pins the stream, because a stream only
  // exists inside a class.
  React.useEffect(() => {
    if (formStreamId && !streamsInFormClass.some((s) => s.id === formStreamId)) {
      setFormStreamId('');
    }
  }, [streamsInFormClass, formStreamId]);

  const filtered =
    Boolean(classId || streamId || teacherId || subjectId || responsibility || debounced) ||
    status !== 'active';

  const unstaffed = React.useMemo(() => {
    const seen = new Set<string>();
    const gaps: string[] = [];
    for (const row of rows) {
      if (row.responsibility !== 'main_class_teacher') continue;
      seen.add(row.stream.id);
    }
    for (const cls of classes) {
      for (const stream of cls.streams) {
        if (!seen.has(stream.id)) gaps.push(`${cls.name} ${stream.code}`);
      }
    }
    return gaps;
  }, [rows, classes]);

  async function endAllocation(row: Allocation) {
    const res = await fetch(`/api/teacher-allocation/${row.id}/end`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      notify.error(body?.error?.message ?? `Could not end the allocation (HTTP ${res.status}).`);
      return;
    }
    notify.success(`Ended ${personName(row.teacher)} on ${row.stream.code}`, {
      description: 'The allocation is kept as history, so past responsibility stays answerable.',
    });
    list.refetch();
  }

  async function createAllocation(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!sessionId) {
      setFormError('Choose an academic session first.');
      return;
    }
    if (!formStreamId) {
      setFormError('Choose the stream this allocation covers.');
      return;
    }
    if (!formTeacherId) {
      setFormError('Choose a teacher.');
      return;
    }
    if (formResponsibility === 'subject_teacher' && !formSubjectId) {
      setFormError('A learning-area teacher must be allocated to a learning area.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/teacher-allocation', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academicYearId: sessionId,
          streamId: formStreamId,
          teacherId: formTeacherId,
          responsibility: formResponsibility,
          subjectId: formResponsibility === 'subject_teacher' ? formSubjectId : undefined,
          canManage: formResponsibility === 'assistant_class_teacher' ? formCanManage : undefined,
        }),
      });
      const body = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;

      if (!res.ok) {
        setFormError(
          body?.error?.message ?? `The allocation could not be created (HTTP ${res.status}).`
        );
        return;
      }

      const created = (
        body as unknown as { allocation?: { teacher?: Person; stream?: { code?: string } } }
      )?.allocation;
      notify.success('Allocation recorded', {
        description: created?.teacher
          ? `${personName(created.teacher)} on stream ${created.stream?.code ?? ''}`
          : undefined,
      });
      setShowForm(false);
      setFormTeacherId('');
      setFormSubjectId('');
      list.refetch();
    } finally {
      setSaving(false);
    }
  }

  const columns: Array<DataTableColumn<Allocation>> = [
    {
      id: 'teacher',
      header: 'Teacher',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {personName(row.teacher)}
          </p>
          <p className="truncate text-xs text-muted-foreground">{row.teacher.email}</p>
        </div>
      ),
      sortValue: (row) => row.teacher.name ?? row.teacher.email,
    },
    {
      id: 'responsibility',
      header: 'Responsibility',
      cell: (row) => (
        <div className="min-w-0 space-y-1">
          <StatusPill
            label={RESPONSIBILITY_LABEL[row.responsibility]}
            tone={RESPONSIBILITY_TONE[row.responsibility]}
          />
          {row.responsibility === 'assistant_class_teacher' ? (
            <p className="truncate text-xs text-muted-foreground">
              {row.canManage ? 'May manage the stream' : 'View only'}
            </p>
          ) : null}
          {row.responsibility === 'subject_teacher' ? (
            <p className="truncate text-xs text-muted-foreground">
              {row.canEnterResults ? 'May enter results' : 'View only'}
            </p>
          ) : null}
        </div>
      ),
      sortValue: (row) => RESPONSIBILITY_LABEL[row.responsibility],
    },
    {
      id: 'stream',
      header: 'Stream / Class',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-foreground">
            {row.stream.class.name} · {row.stream.code}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {row.stream.class.gradeLevel ?? 'Grade not set'} · {row.academicSession.label ??
              row.academicSession.name}
          </p>
        </div>
      ),
      hideBelow: 'sm',
      sortValue: (row) => `${row.stream.class.name} ${row.stream.code}`,
    },
    {
      id: 'learning-area',
      header: 'Learning area',
      cell: (row) =>
        row.subject ? (
          <span className="text-sm text-foreground">{row.subject.name}</span>
        ) : (
          <span className="text-muted-foreground">Whole stream</span>
        ),
      hideBelow: 'md',
      sortValue: (row) => row.subject?.name ?? '',
    },
    {
      id: 'period',
      header: 'Period',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-foreground">{formatDate(row.effectiveFrom)}</p>
          <p className="truncate text-xs text-muted-foreground">
            {row.effectiveTo ? `until ${formatDate(row.effectiveTo)}` : 'ongoing'}
          </p>
        </div>
      ),
      hideBelow: 'lg',
      sortValue: (row) => row.effectiveFrom,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => (
        <StatusPill
          label={row.status === 'active' ? 'Active' : 'Ended'}
          tone={row.status === 'active' ? 'success' : 'neutral'}
        />
      ),
      sortValue: (row) => row.status,
    },
  ];

  if (!allowed) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Teacher Allocation" />
        <ErrorState
          title="You do not have access to teacher allocation"
          message="Viewing allocations requires teaching.view. Your role does not hold it, and the API refuses the request independently of this screen."
        />
      </div>
    );
  }

  const sessionOptions = (options.data?.sessions ?? []).map((s) => ({
    value: s.id,
    label: `${s.label ?? s.name} (${s.status})`,
  }));

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Teacher Allocation"
        description="Assign teachers to streams, classes and learning areas within an academic session. A stream has one main class teacher, any number of assistants, and any number of learning-area teachers."
        action={
          canManage ? (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              + Add Allocation
            </button>
          ) : null
        }
      />

      <FloatingFormModal
        isOpen={showForm && canManage}
        onClose={() => setShowForm(false)}
        title="New allocation"
        description={`Recorded against ${sessionOptions.find((s) => s.value === sessionId)?.label ?? 'the selected academic session'}. This assigns responsibility only; it does not create an account.`}
        icon="user-round-check"
        submitLabel="Create allocation"
        isSubmitting={saving}
        onSubmit={createAllocation}
        size="lg"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Class" required hint="The stream is chosen inside this class">
            <select
              value={formClassId}
              onChange={(event) => setFormClassId(event.target.value)}
              className={selectClass}
            >
              <option value="">Choose a class…</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {[cls.name, cls.gradeLevel].filter(Boolean).join(' - ')}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Stream"
            required
            hint="Each stream carries its own teaching team"
          >
            <select
              value={formStreamId}
              onChange={(event) => setFormStreamId(event.target.value)}
              disabled={!formClassId}
              className={selectClass}
            >
              <option value="">
                {formClassId ? 'Choose a stream…' : 'Choose a class first'}
              </option>
              {streamsInFormClass.map((stream) => (
                <option key={stream.id} value={stream.id}>
                  {stream.code} - {stream.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Teacher" required>
            <select
              value={formTeacherId}
              onChange={(event) => setFormTeacherId(event.target.value)}
              className={selectClass}
            >
              <option value="">Choose a teacher…</option>
              {(options.data?.teachers ?? []).map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {personName(teacher)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Responsibility" required>
            <select
              value={formResponsibility}
              onChange={(event) =>
                setFormResponsibility(event.target.value as Responsibility)
              }
              className={selectClass}
            >
              <option value="main_class_teacher">Main class teacher</option>
              <option value="assistant_class_teacher">Assistant class teacher</option>
              <option value="subject_teacher">Learning-area teacher</option>
            </select>
          </Field>

          {formResponsibility === 'subject_teacher' ? (
            <Field label="Learning area" required>
              <select
                value={formSubjectId}
                onChange={(event) => setFormSubjectId(event.target.value)}
                className={selectClass}
              >
                <option value="">Choose a learning area…</option>
                {(options.data?.subjects ?? []).map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}

          {formResponsibility === 'assistant_class_teacher' ? (
            <Field
              label="Assistant rights"
              hint="Management covers attendance and communication"
            >
              <select
                value={formCanManage ? 'manage' : 'view'}
                onChange={(event) => setFormCanManage(event.target.value === 'manage')}
                className={selectClass}
              >
                <option value="manage">May manage the stream</option>
                <option value="view">View only</option>
              </select>
            </Field>
          ) : null}
        </div>

        {formError ? (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-2 text-sm text-destructive font-medium"
          >
            {formError}
          </p>
        ) : null}
      </FloatingFormModal>

      {options.loading ? (
        <LoadingState label="Loading allocation options" />
      ) : list.loading ? (
        <LoadingState label="Loading allocations" />
      ) : list.error ? (
        <ErrorState
          title="Could not load allocations"
          message="GET /api/teacher-allocation requires teaching.view. Confirm the API is running and that your session still holds the permission."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <DashboardCard
              title="Allocations"
              value={list.data?.total ?? rows.length}
              icon="user-round-check"
              tone="accent"
              description={filtered ? 'Matching the current filters' : 'In the selected session'}
            />
            <DashboardCard
              title="Teachers allocated"
              value={new Set(rows.map((r) => r.teacher.id)).size}
              icon="users"
              description="Distinct people carrying an allocation"
            />
            <DashboardCard
              title="Streams covered"
              value={new Set(rows.map((r) => r.stream.id)).size}
              icon="split"
              description="Streams with at least one allocation"
            />
            <DashboardCard
              title="Learning areas"
              value={new Set(rows.filter((r) => r.subject).map((r) => r.subject!.id)).size}
              icon="book-open"
              tone="warning"
              description="Taught by an allocated learning-area teacher"
            />
          </div>

          <DataTable
            caption="Teaching allocations"
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
            pageSize={25}
            toolbar={
              <ContextFilterBar
                filters={[
                  {
                    id: 'session',
                    label: 'Academic session',
                    value: sessionId,
                    options: sessionOptions,
                    onChange: setSessionId,
                    allLabel: 'All sessions',
                  },
                  {
                    id: 'class',
                    label: 'Class',
                    value: classId,
                    options: classes.map((cls) => ({
                      value: cls.id,
                      label: [cls.name, cls.gradeLevel].filter(Boolean).join(' - '),
                    })),
                    onChange: setClassId,
                    allLabel: 'All classes',
                  },
                  {
                    id: 'stream',
                    label: 'Stream',
                    value: streamId,
                    options: classes
                      .filter((cls) => !classId || cls.id === classId)
                      .flatMap((cls) =>
                        cls.streams.map((stream) => ({
                          value: stream.id,
                          label: `${cls.name} ${stream.code}`,
                        }))
                      ),
                    onChange: setStreamId,
                    allLabel: 'All streams',
                  },
                  {
                    id: 'teacher',
                    label: 'Teacher',
                    value: teacherId,
                    options: (options.data?.teachers ?? []).map((teacher) => ({
                      value: teacher.id,
                      label: personName(teacher),
                    })),
                    onChange: setTeacherId,
                    allLabel: 'All teachers',
                  },
                  {
                    id: 'responsibility',
                    label: 'Responsibility',
                    value: responsibility,
                    options: [
                      { value: 'main_class_teacher', label: 'Main class teacher' },
                      { value: 'assistant_class_teacher', label: 'Assistant class teacher' },
                      { value: 'subject_teacher', label: 'Learning-area teacher' },
                    ],
                    onChange: setResponsibility,
                    allLabel: 'All responsibilities',
                  },
                  {
                    id: 'subject',
                    label: 'Learning area',
                    value: subjectId,
                    options: (options.data?.subjects ?? []).map((subject) => ({
                      value: subject.id,
                      label: subject.name,
                    })),
                    onChange: setSubjectId,
                    allLabel: 'All learning areas',
                  },
                  {
                    id: 'status',
                    label: 'Status',
                    value: status,
                    options: [
                      { value: 'active', label: 'Active' },
                      { value: 'inactive', label: 'Ended' },
                    ],
                    onChange: setStatus,
                    allLabel: 'Any status',
                  },
                ]}
              />
            }
            renderRowActions={(row) =>
              canManage && row.status === 'active' ? (
                <ActionButtons
                  items={[
                    {
                      id: 'end',
                      label: `End ${personName(row.teacher)}'s allocation on ${row.stream.code}`,
                      icon: 'x',
                      tone: 'danger',
                      onClick: () => endAllocation(row),
                    },
                  ]}
                />
              ) : null
            }
            empty={
              <EmptyState
                title={
                  (options.data?.teachers ?? []).length === 0
                    ? 'No teachers to allocate'
                    : 'No allocations in this view'
                }
                description={
                  list.data?.note ??
                  ((options.data?.teachers ?? []).length === 0
                    ? 'This school has no teachers yet. Provision a teacher account through the invitations workflow first; allocation assigns responsibility and does not create accounts.'
                    : filtered
                      ? 'No allocation matches these filters. Widen the filters, or record one.'
                      : 'No teacher has been allocated yet. Record an allocation to give a stream its main class teacher, assistants or learning-area teachers.')
                }
                icon="user-round-check"
                action={
                  canManage && (options.data?.teachers ?? []).length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setShowForm(true)}
                      className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                      Add Allocation
                    </button>
                  ) : null
                }
              />
            }
          />

          {unstaffed.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              No main class teacher is allocated for{' '}
              <span className="font-medium text-foreground">{unstaffed.join(', ')}</span> in the
              selected session. Those streams are not covered for attendance or class management.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
