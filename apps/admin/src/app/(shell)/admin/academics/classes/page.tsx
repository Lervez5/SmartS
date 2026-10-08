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
  type DataTableColumn,
} from '@schoolos/ui';

/**
 * Classes - the authoritative academic-structure management page.
 *
 * A class is the academic unit, and streams subdivide it. This screen shows
 * the class record, its streams, learner count, and the teaching team as
 * reported by the class-level teacher and assistants. Stream-level teaching
 * team detail is surfaced through the existing Teacher Allocation page, so
 * this screen does not duplicate that allocation model.
 */

interface ClassRecord {
  id: string;
  name: string;
  classCode: string | null;
  gradeLevel: string | null;
  description: string | null;
  subject: { id: string; name: string } | null;
  teacher: { id: string; name: string | null; email: string } | null;
  assistants: Array<{
    canManage: boolean;
    assistant: { id: string; name: string | null; email: string };
  }>;
  _count: { enrollments: number };
  streams: Array<{
    id: string;
    name: string;
    code: string;
    status: string;
    _count: { enrollments: number };
    allocations: Array<{
      id: string;
      responsibility: string;
      status: string;
      teacher: { id: string; name: string | null; email: string };
      subject: { id: string; name: string; code: string | null } | null;
    }>;
  }>;
}

interface ClassesResponse {
  classes?: ClassRecord[];
}

const STATUS_TONE: Record<string, string> = {
  active: 'success',
  inactive: 'warning',
  archived: 'neutral',
};

export default function AdminClassesPage() {
  const { can } = useAuth();
  const allowed = can('cohorts.view');
  const canManage = can('cohorts.manage');

  const [query, setQuery] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [gradeLevel, setGradeLevel] = React.useState('');
  const [status, setStatus] = React.useState('');

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const params = new URLSearchParams();
  if (debounced) params.set('search', debounced);
  const qs = params.toString();

  const classes = useApi<ClassesResponse>(allowed ? `/api/classes${qs ? `?${qs}` : ''}` : '/api/classes?denied=1');

  const rows = React.useMemo(() => classes.data?.classes ?? [], [classes.data]);

  const gradeLevels = React.useMemo(() => {
    const seen = new Map<string, string>();
    for (const cls of rows) {
      if (cls.gradeLevel) seen.set(cls.gradeLevel, cls.gradeLevel);
    }
    return [...seen.entries()].map(([value, label]) => ({ value, label }));
  }, [rows]);

  const active = rows.filter((c) => c.streams.some((s) => s.status === 'active')).length;
  const totalStreams = rows.reduce((sum, c) => sum + c.streams.length, 0);
  const totalLearners = rows.reduce((sum, c) => sum + c._count.enrollments, 0);

  const columns: Array<DataTableColumn<ClassRecord>> = [
    {
      id: 'class',
      header: 'Class',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{row.name}</p>
          <p className="truncate font-mono text-xs text-muted-foreground">
            {row.classCode ?? 'No code'}
          </p>
        </div>
      ),
      sortValue: (row) => row.name,
    },
    {
      id: 'gradeLevel',
      header: 'Grade / Level',
      cell: (row) => (
        <span className="text-sm text-foreground">{row.gradeLevel ?? '-'}</span>
      ),
      sortValue: (row) => row.gradeLevel ?? '',
    },
    {
      id: 'teacher',
      header: 'Class Teacher',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-foreground">
            {row.teacher?.name ?? <span className="text-muted-foreground">Unassigned</span>}
          </p>
          {row.assistants.length > 0 && (
            <p className="truncate text-xs text-muted-foreground">
              +{row.assistants.length} assistant{row.assistants.length === 1 ? '' : 's'}
            </p>
          )}
        </div>
      ),
      sortValue: (row) => row.teacher?.name ?? '',
    },
    {
      id: 'streams',
      header: 'Streams',
      cell: (row) => {
        const activeStreams = row.streams.filter((s) => s.status === 'active').length;
        return (
          <div className="flex flex-col items-end">
            <span className="text-sm font-medium text-foreground">{row.streams.length}</span>
            {row.streams.length > 0 && (
              <span className="text-xs text-muted-foreground">{activeStreams} active</span>
            )}
          </div>
        );
      },
      sortValue: (row) => row.streams.length,
    },
    {
      id: 'learners',
      header: 'Learners',
      align: 'right',
      cell: (row) => row._count.enrollments.toLocaleString(),
      sortValue: (row) => row._count.enrollments,
    },
    {
      id: 'subject',
      header: 'Subject',
      cell: (row) => (
        <span className="text-sm text-foreground">{row.subject?.name ?? '-'}</span>
      ),
      sortValue: (row) => row.subject?.name ?? '',
    },
  ];

  if (!allowed) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Classes" />
        <ErrorState
          title="You do not have access to classes"
          message="Viewing classes requires cohorts.view. Your role does not hold it, and the API refuses the request independently of this screen."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Classes"
        description="Academic classes and their streams. A class is the academic unit; streams subdivide it for teaching groups."
        action={
          canManage ? (
            <PrimaryActionButton
              href="/admin/classes/new"
              label="Create Class"
              icon="plus"
            />
          ) : null}
      />

      {classes.loading ? (
        <LoadingState label="Loading classes" />
      ) : classes.error ? (
        <ErrorState
          title="Could not load classes"
          message="GET /api/classes requires cohorts.view. Confirm the API is running and that your session still holds the permission."
        />
      ) : rows.length === 0 && !debounced && !gradeLevel && !status ? (
        <EmptyState
          title="No classes found"
          description="Create your first class to get started"
          icon="users-round"
          action={
            canManage ? (
              <a
                href="/admin/classes/new"
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Create Class
              </a>
            ) : null}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <DashboardCard
              title="Classes"
              value={rows.length}
              icon="users-round"
              tone="accent"
              description={
                debounced || gradeLevel || status
                  ? 'Matching the current filters'
                  : 'Total classes'
              }
            />
            <DashboardCard
              title="Streams"
              value={totalStreams}
              icon="split"
              tone="default"
              description="Across all classes"
            />
            <DashboardCard
              title="Learners enrolled"
              value={totalLearners}
              icon="graduation-cap"
              description="In a class"
            />
            <DashboardCard
              title="With active streams"
              value={active}
              icon="check"
              tone="success"
              description="Classes with at least one active stream"
            />
          </div>

          <DataTable
            caption="Classes"
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
            onRowClick={(row) => {
              window.location.href = `/admin/classes/${row.id}`;
            }}
            renderRowActions={(row) => (
              <ActionButtons
                items={[
                  {
                    id: 'view',
                    label: `View ${row.name}`,
                    href: `/admin/classes/${row.id}`,
                    icon: 'eye',
                  },
                  ...(canManage
                    ? [
                        {
                          id: 'edit',
                          label: `Edit ${row.name}`,
                          href: `/admin/classes/${row.id}/edit`,
                          icon: 'pencil',
                        },
                      ]
                    : []),
                ]}
              />
            )}
            toolbar={
              <ContextFilterBar
                search={{ value: query, onChange: setQuery, placeholder: 'Search classes...' }}
                filters={[
                  {
                    id: 'gradeLevel',
                    label: 'Grade / Level',
                    value: gradeLevel,
                    options: gradeLevels,
                    onChange: setGradeLevel,
                    allLabel: 'All grades',
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
                title="No classes found"
                description={
                  debounced || gradeLevel || status
                    ? 'No classes match these filters.'
                    : 'Create your first class to get started'
                }
                icon="users-round"
              />
            }
          />
        </>
      )}
    </div>
  );
}
