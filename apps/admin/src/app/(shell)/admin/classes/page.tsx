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
  useAcademicSession,
  type DataTableColumn,
  type StatusTone,
} from '@schoolos/ui';

/**
 * Classes - the authoritative academic-structure management page.
 *
 * A class (also called a "grade") is the parent academic unit. Streams subdivide
 * it. This screen shows the class record, its child streams, learner counts,
 * and the class-level teaching team (main teacher + assistants). Stream-level
 * teaching team detail is surfaced through the Teacher Allocation page, so this
 * screen does not duplicate that allocation model.
 *
 * The list is scoped to the navbar-selected academic session: changing the
 * session reloads the corresponding classes rather than mixing structures from
 * different academic years.
 */

interface StreamRecord {
  id: string;
  name: string;
  code: string;
  capacity: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  learnerCount: number;
  allocations: Array<{
    id: string;
    responsibility: string;
    status: string;
    teacher: { id: string; name: string | null; email: string };
    subject: { id: string; name: string; code: string | null } | null;
  }>;
}

interface ClassRecord {
  id: string;
  name: string;
  classCode: string | null;
  gradeLevel: string | null;
  description: string | null;
  academicYearId: string | null;
  status: 'active' | 'inactive' | 'archived';
  subject: { id: string; name: string } | null;
  teacher: { id: string; name: string | null; email: string } | null;
  academicYear: { id: string; name: string; label: string | null; status: string } | null;
  assistants: Array<{
    canManage: boolean;
    assistant: { id: string; name: string | null; email: string };
  }>;
  _count: { enrollments: number };
  streamCount: number;
  activeStreamCount: number;
  createdAt: string;
  updatedAt: string;
  streams: StreamRecord[];
}

interface ClassesResponse {
  classes?: ClassRecord[];
}

const STATUS_TONE: Record<string, StatusTone> = {
  active: 'success',
  inactive: 'warning',
  archived: 'neutral',
};

export default function AdminClassesPage() {
  const { can } = useAuth();
  const allowed = can('cohorts.view');
  const canManage = can('cohorts.manage');
  const { sessionId, current: session, ready } = useAcademicSession();

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
  if (gradeLevel) params.set('gradeLevel', gradeLevel);
  if (status) params.set('status', status);
  if (sessionId && sessionId.trim()) params.set('academicYearId', sessionId);
  const qs = params.toString();

  const classes = useApi<ClassesResponse>(
    allowed && ready ? `/api/classes${qs ? `?${qs}` : ''}` : '/api/classes?denied=1'
  );

  React.useEffect(() => {
    if (!ready) return;
    classes.refetch();
  }, [sessionId, ready, gradeLevel, status, debounced]);

  const rows = React.useMemo(() => classes.data?.classes ?? [], [classes.data]);

  const gradeLevels = React.useMemo(() => {
    const seen = new Map<string, string>();
    for (const cls of rows) {
      if (cls.gradeLevel) seen.set(cls.gradeLevel, cls.gradeLevel);
    }
    return [...seen.entries()].map(([value, label]) => ({ value, label }));
  }, [rows]);

  const activeClasses = rows.filter((c) => c.status === 'active').length;
  const archivedClasses = rows.filter((c) => c.status === 'archived').length;
  const totalStreams = rows.reduce((sum, c) => sum + c.streamCount, 0);
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
      cell: (row) => <span className="text-sm text-foreground">{row.gradeLevel ?? '-'}</span>,
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
      cell: (row) => (
        <div className="flex flex-col items-end">
          <span className="text-sm font-medium text-foreground">{row.streamCount}</span>
          {row.activeStreamCount > 0 && (
            <span className="text-xs text-muted-foreground">{row.activeStreamCount} active</span>
          )}
        </div>
      ),
      sortValue: (row) => row.streamCount,
    },
    {
      id: 'learners',
      header: 'Learners',
      align: 'right',
      cell: (row) => row._count.enrollments.toLocaleString(),
      sortValue: (row) => row._count.enrollments,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => <StatusPill label={row.status} tone={STATUS_TONE[row.status] ?? 'neutral'} />,
      sortValue: (row) => row.status,
    },
    {
      id: 'subject',
      header: 'Subject',
      cell: (row) => <span className="text-sm text-foreground">{row.subject?.name ?? '-'}</span>,
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

  const sessionDescription = session
    ? `Session: ${session.label}`
    : ready
      ? 'No session selected'
      : 'Loading session…';

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Classes"
        description={
          <>
            Academic classes (grades) and their child streams. A class is the academic unit; streams
            subdivide it for teaching groups. {sessionDescription}
          </>
        }
        action={
          canManage ? (
            <PrimaryActionButton
              href="/admin/classes/new"
              label="Create Class"
              icon="plus"
              title="Create a new class for the selected academic session"
            />
          ) : null
        }
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
          title={sessionId && ready ? 'No classes in this session' : 'No classes found'}
          description={
            canManage
              ? 'Create your first class to get started. Streams can be added after the class is created.'
              : 'No classes are available for your role.'
          }
          icon="users-round"
          action={
            canManage ? (
              <a
                href="/admin/classes/new"
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Create Class
              </a>
            ) : null
          }
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
                  : session
                    ? `In ${session.label}`
                    : 'Total classes'
              }
            />
            <DashboardCard
              title="Active"
              value={activeClasses}
              icon="check-circle"
              description={`${archivedClasses} archived`}
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
