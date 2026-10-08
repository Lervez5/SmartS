'use client';

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
  LoadingState,
  PrimaryActionButton,
  SectionHeader,
  StatusPill,
  notify,
  type DataTableColumn,
} from '@schoolos/ui';

/**
 * Streams - the subdivisions of a class.
 *
 * A stream never replaces its class: attendance, timetabling and assessment stay
 * anchored to the class, and a stream is how one class is split into teaching
 * groups inside it. So the table reports the parent class, the grade level within
 * it, and the people responsible for that class - the main class teacher and any
 * assistants, with the rights each assignment grants. No stream carries a teacher
 * of its own, because that would compete with the class-level responsibility
 * rather than extend it.
 */
interface Responsible {
  mainTeacher: { id: string; name: string | null; email: string } | null;
  assistantTeachers: Array<{
    id: string;
    name: string | null;
    email: string;
    canManage: boolean;
  }>;
}

interface StreamRecord {
  id: string;
  classId: string;
  name: string;
  code: string;
  capacity: number | null;
  status: 'active' | 'inactive' | 'archived';
  createdAt: string;
  learnerCount: number;
  parentClass: { id: string; name: string; gradeLevel: string | null } | null;
  responsible: Responsible | null;
}

interface StreamsResponse {
  streams?: StreamRecord[];
}

const STATUS_TONE = {
  active: 'success',
  inactive: 'warning',
  archived: 'neutral',
} as const;

function formatDate(value?: string | null): string {
  if (!value) return '-';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? '-'
    : parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function describeResponsible(responsible: Responsible | null): string {
  if (!responsible) return 'No teacher assigned';
  const main = responsible.mainTeacher?.name ?? 'Unassigned';
  const assistants = responsible.assistantTeachers.length;
  if (assistants === 0) return main;
  return `${main} +${assistants} assistant${assistants === 1 ? '' : 's'}`;
}

export default function AdminStreamsPage() {
  const { can } = useAuth();
  const allowed = can('academics.view');
  const canManage = can('academics.manage');

  const [query, setQuery] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [classId, setClassId] = React.useState('');
  const [status, setStatus] = React.useState('');

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const params = new URLSearchParams();
  if (debounced) params.set('search', debounced);
  if (classId) params.set('classId', classId);
  if (status) params.set('status', status);
  const qs = params.toString();

  const streams = useApi<StreamsResponse>(
    allowed ? `/api/streams${qs ? `?${qs}` : ''}` : '/api/streams?denied=1'
  );

  // Classes come from the caller's own school, so the filter can only ever
  // offer a class they are allowed to see.
  const classes = useApi<Array<{ id: string; name: string; gradeLevel?: string | null }>>(
    allowed ? '/api/classes' : null
  );

  const rows = React.useMemo(() => streams.data?.streams ?? [], [streams.data]);

  const classOptions = React.useMemo(
    () =>
      (classes.data ?? []).map((cls) => ({
        value: cls.id,
        label: [cls.name, cls.gradeLevel].filter(Boolean).join(' - '),
      })),
    [classes.data]
  );

  const active = rows.filter((s) => s.status === 'active').length;
  const archived = rows.filter((s) => s.status === 'archived').length;
  const learners = rows.reduce((sum, s) => sum + s.learnerCount, 0);
  const unstaffed = rows.filter((s) => !s.responsible?.mainTeacher).length;

  async function archive(row: StreamRecord) {
    const res = await fetch(`/api/streams/${row.id}/archive`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      notify.error(body?.error?.message ?? `Could not archive ${row.name} (HTTP ${res.status}).`);
      return;
    }
    notify.success(`${row.name} archived`, {
      description:
        'Enrolments, attendance and results are retained; the stream is retired, not deleted.',
    });
    streams.refetch();
  }

  const columns: Array<DataTableColumn<StreamRecord>> = [
    {
      id: 'stream',
      header: 'Stream',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{row.name}</p>
          <p className="truncate font-mono text-xs text-muted-foreground">{row.code}</p>
        </div>
      ),
      sortValue: (row) => row.name,
    },
    {
      id: 'class',
      header: 'Class / Grade',
      cell: (row) =>
        row.parentClass ? (
          <div className="min-w-0">
            <p className="truncate text-sm text-foreground">{row.parentClass.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {row.parentClass.gradeLevel ?? 'Grade not set'}
            </p>
          </div>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
      sortValue: (row) => row.parentClass?.gradeLevel ?? row.parentClass?.name ?? '',
    },
    {
      id: 'responsible',
      header: 'Responsible',
      // The class's main teacher and assistants, not a stream owner: the stream
      // has none, by design.
      cell: (row) => {
        const main = row.responsible?.mainTeacher;
        return (
          <div className="min-w-0">
            <p className="truncate text-sm text-foreground">
              {main?.name ?? <span className="text-muted-foreground">Unassigned</span>}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {describeResponsible(row.responsible)}
            </p>
          </div>
        );
      },
      hideBelow: 'md',
      sortValue: (row) => describeResponsible(row.responsible),
    },
    {
      id: 'learners',
      header: 'Learners',
      align: 'right',
      cell: (row) => row.learnerCount.toLocaleString(),
      hideBelow: 'sm',
      sortValue: (row) => row.learnerCount,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => <StatusPill label={row.status} tone={STATUS_TONE[row.status] ?? 'neutral'} />,
      sortValue: (row) => row.status,
    },
  ];

  if (!allowed) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Streams" />
        <ErrorState
          title="You do not have access to streams"
          message="Viewing streams requires academics.view. Your role does not hold it, and the API refuses the request independently of this screen."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Streams"
        description="Manage school streams within classes and grade levels."
        action={
          canManage ? (
            <PrimaryActionButton
              href="/admin/academics/streams/new"
              label="Add Stream"
              icon="plus"
              title="Creates a stream within one of your classes."
            />
          ) : null
        }
      />

      {streams.loading ? (
        <LoadingState label="Loading streams" />
      ) : streams.error ? (
        <ErrorState
          title="Could not load streams"
          message="GET /api/streams requires academics.view. Confirm the API is running and that your session still holds the permission."
        />
      ) : rows.length === 0 && !debounced && !classId && !status ? (
        <EmptyState
          title="No streams found"
          description="Create your first stream to get started"
          icon="split"
          action={
            canManage ? (
              <a
                href="/admin/academics/streams/new"
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Add Stream
              </a>
            ) : null
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <DashboardCard
              title="Streams"
              value={rows.length}
              icon="split"
              tone="accent"
              description={
                debounced || classId || status
                  ? 'Matching the current filters'
                  : 'Across your classes'
              }
            />
            <DashboardCard
              title="Active"
              value={active}
              icon="check"
              tone="success"
              description={`${archived} archived`}
            />
            <DashboardCard
              title="Learners in streams"
              value={learners}
              icon="graduation-cap"
              description="Placed in a stream"
            />
            <DashboardCard
              title="Classes without a teacher"
              value={unstaffed}
              icon="triangle-alert"
              tone={unstaffed > 0 ? 'warning' : 'success'}
              description="No main class teacher assigned"
            />
          </div>

          <DataTable
            caption="Streams within classes"
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
            renderRowActions={(row) => (
              <ActionButtons
                items={[
                  ...(canManage
                    ? [
                        {
                          id: 'edit',
                          label: `Edit ${row.name}`,
                          href: `/admin/academics/streams/${row.id}/edit`,
                          icon: 'pencil',
                        },
                      ]
                    : []),
                  // Archive rather than delete: a stream holds enrolments,
                  // attendance and results that must remain readable.
                  ...(canManage && row.status !== 'archived'
                    ? [
                        {
                          id: 'archive',
                          label: `Archive ${row.name}`,
                          href: `#archive-${row.id}`,
                          icon: 'archive',
                          onClick: () => archive(row),
                        },
                      ]
                    : []),
                ]}
              />
            )}
            toolbar={
              <ContextFilterBar
                search={{ value: query, onChange: setQuery, placeholder: 'Search streams...' }}
                filters={[
                  {
                    id: 'class',
                    label: 'Class',
                    value: classId,
                    options: classOptions,
                    onChange: setClassId,
                    allLabel: 'All classes',
                  },
                  {
                    id: 'status',
                    label: 'Status',
                    value: status,
                    options: [
                      { value: 'active', label: 'Active' },
                      { value: 'inactive', label: 'Inactive' },
                      { value: 'archived', label: 'Archived' },
                    ],
                    onChange: setStatus,
                    allLabel: 'All statuses',
                  },
                ]}
              />
            }
            empty={
              <EmptyState
                title="No streams found"
                description={
                  debounced || classId || status
                    ? 'No streams match these filters.'
                    : 'Create your first stream to get started'
                }
                icon="split"
              />
            }
          />

          <p className="text-xs text-muted-foreground">
            A stream subdivides a class; it does not replace one, so attendance, timetabling and
            assessment stay with the class. Responsibility is the parent class&rsquo;s main teacher
            and assistants, recorded on the assignment - never inferred from a role, so a teacher
            who is not assigned to a class has no access to it.
          </p>
        </>
      )}
    </div>
  );
}
