'use client';

import * as React from 'react';
import { useApi } from '@schoolos/hooks';
import { useAuth } from '@schoolos/auth';
import {
  ActionMenu,
  ContextFilterBar,
  DataTable,
  DashboardCard,
  EmptyState,
  ErrorState,
  LoadingState,
  PrimaryActionButton,
  SectionHeader,
  StatusPill,
  initialsOf,
  type DataTableColumn,
  type StatusTone,
} from '@schoolos/ui';

/**
 * Active Learners - the learner directory.
 *
 * Data comes from `GET /api/students`, which is gated by `students.view` and
 * returns StudentProfile joined to User plus the learner's class placement via
 * Enrollment. Nothing here is invented:
 *
 *  - `admissionId` is the only admission identifier the schema carries. It is a
 *    bare ObjectId with no relation and no human-readable form, so it is shown
 *    verbatim rather than formatted as an admission number it is not.
 *  - There is no stream anywhere in the model, so a learner without a stream is
 *    represented by saying so instead of showing an empty cell.
 *  - `User.status` is the only lifecycle field a learner has; there is no
 *    separate enrolment status.
 */
interface Placement {
  id: string;
  name: string;
  classCode?: string | null;
  gradeLevel?: string | null;
}

interface Learner {
  id: string;
  userId: string;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  phone?: string | null;
  avatar?: string | null;
  status: 'pending' | 'active' | 'suspended' | 'archived';
  gradeLevel?: string | null;
  admissionId?: string | null;
  dateOfBirth?: string | null;
  gender?: 'male' | 'female' | 'other' | 'unspecified' | null;
  enrollmentDate?: string | null;
  guardians: number;
  class: Placement | null;
}

interface StudentsResponse {
  students?: Learner[];
}

const STATUS_TONE: Record<string, StatusTone> = {
  active: 'success',
  pending: 'warning',
  suspended: 'danger',
  archived: 'neutral',
};

function displayName(learner: Learner): string {
  return learner.name ?? [learner.firstName, learner.lastName].filter(Boolean).join(' ') ?? '';
}

function formatDate(value?: string | null): string {
  if (!value) return '-';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? '-'
    : parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminActiveLearnersPage() {
  const { can } = useAuth();
  const allowed = can('students.view');

  // The search and filters are applied server-side so the directory stays
  // authoritative; the table paginates what the API returns.
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
  params.set('limit', '200');

  const { data, loading, error } = useApi<StudentsResponse>(
    allowed ? `/api/students?${params.toString()}` : '/api/students?denied=1'
  );

  const learners = React.useMemo(() => data?.students ?? [], [data]);

  // Grade options come from the records actually returned, so the filter never
  // offers a grade the school has not used.
  const gradeOptions = React.useMemo(() => {
    const seen = new Set<string>();
    for (const learner of learners) {
      const grade = learner.class?.gradeLevel ?? learner.gradeLevel;
      if (grade) seen.add(grade);
    }
    return [...seen].sort().map((grade) => ({ value: grade, label: grade }));
  }, [learners]);

  const total = learners.length;
  const active = learners.filter((learner) => learner.status === 'active').length;
  const pending = learners.filter((learner) => learner.status === 'pending').length;
  const unplaced = learners.filter((learner) => !learner.class).length;

  const columns: Array<DataTableColumn<Learner>> = [
    {
      id: 'info',
      header: 'Student Info',
      cell: (row) => {
        const name = displayName(row);
        return (
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-xs font-bold text-primary">
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
                {row.email}
                {row.dateOfBirth ? ` · b. ${formatDate(row.dateOfBirth)}` : ''}
              </p>
            </div>
          </div>
        );
      },
      sortValue: (row) => displayName(row),
    },
    {
      id: 'class',
      header: 'Class',
      cell: (row) => {
        if (!row.class) {
          return (
            <span className="text-sm text-muted-foreground">
              Unplaced
              {row.gradeLevel ? (
                <span className="block text-xs">Grade {row.gradeLevel}</span>
              ) : null}
            </span>
          );
        }
        return (
          <div className="min-w-0">
            <p className="truncate text-sm text-foreground">{row.class.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {[
                row.class.gradeLevel ? `Grade ${row.class.gradeLevel}` : null,
                row.class.classCode,
                // There is no stream in the data model, so this says so once
                // rather than implying an empty assignment.
                'No stream',
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        );
      },
      sortValue: (row) => row.class?.name ?? 'zzz',
    },
    {
      id: 'admission',
      header: 'Admission No.',
      // The identifier is a raw ObjectId, so it is monospaced and left-truncated
      // rather than formatted as something it is not.
      cell: (row) =>
        row.admissionId ? (
          <span className="font-mono text-xs text-foreground" title={row.admissionId}>
            {row.admissionId.slice(-8)}
          </span>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
      sortValue: (row) => row.admissionId ?? '',
    },
    {
      id: 'gender',
      header: 'Gender',
      cell: (row) =>
        row.gender && row.gender !== 'unspecified' ? (
          <span className="text-sm capitalize text-foreground">{row.gender}</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
      sortValue: (row) => row.gender ?? '',
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
        <SectionHeader title="Active Learners" />
        <ErrorState
          title="You do not have access to the learner directory"
          message="Viewing learners requires students.view. Your role does not hold it, and the API refuses the request independently of this screen."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Active Learners"
        description={`Learners currently enrolled in the school. ${total === 1 ? '1 learner' : `${total} learners`} returned by the directory, ${active} active and ${pending} awaiting activation.`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {can('users.import') ? (
              <PrimaryActionButton
                href="/admin/imports"
                label="Import"
                icon="file-up"
                variant="outline"
                title="Bulk provisioning of learner records is not implemented. This screen states what is missing."
              />
            ) : null}
            {can('students.manage') ? (
              <PrimaryActionButton
                href="/admin/students/new"
                label="Enroll New"
                icon="user-plus"
                title="Enrols an existing account as a learner via POST /api/students."
              />
            ) : null}
          </div>
        }
      />

      {loading ? (
        <LoadingState label="Loading the learner directory" />
      ) : error ? (
        <ErrorState
          title="Could not load the learner directory"
          message="GET /api/students requires students.view. Confirm the API is running and that your session still holds the permission."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <DashboardCard
              title="Learners listed"
              value={total}
              icon="graduation-cap"
              tone="accent"
              description={
                debounced || gradeLevel || status
                  ? 'Matching the current filters'
                  : 'Everything the directory returns'
              }
            />
            <DashboardCard
              title="Active"
              value={active}
              icon="check"
              tone="success"
              description="Account state is active"
            />
            <DashboardCard
              title="Awaiting activation"
              value={pending}
              icon="mail-plus"
              tone={pending > 0 ? 'warning' : 'default'}
              description="Invited but not yet activated"
            />
            <DashboardCard
              title="Unplaced"
              value={unplaced}
              icon="triangle-alert"
              tone={unplaced > 0 ? 'warning' : 'success'}
              description="No class enrolment recorded"
            />
          </div>

          <DataTable
            caption="Learners currently enrolled in the school"
            columns={columns}
            rows={learners}
            rowKey={(row) => row.id}
            pageSize={15}
            onRowClick={(row) => {
              window.location.href = `/admin/students/${row.id}`;
            }}
            renderRowActions={(row) => (
              <ActionMenu
                label={`Actions for ${displayName(row) || row.email}`}
                items={[
                  {
                    id: 'view',
                    label: 'View profile',
                    href: `/admin/students/${row.id}`,
                    icon: 'eye',
                  },
                  // Only a holder of students.manage is offered editing, and
                  // the endpoint enforces the same permission server-side.
                  ...(can('students.manage')
                    ? [
                        {
                          id: 'edit',
                          label: 'Edit details',
                          href: `/admin/students/${row.id}/edit`,
                          icon: 'pencil',
                        },
                      ]
                    : []),
                  {
                    id: 'id-card',
                    label: 'ID card',
                    href: `/admin/students/${row.id}/id-card`,
                    icon: 'credit-card',
                  },
                  ...(can('reports.view')
                    ? [
                        {
                          id: 'reports',
                          label: 'Academic reports',
                          href: '/admin/reports',
                          icon: 'file-bar-chart',
                        },
                      ]
                    : []),
                  ...(can('reports.finance')
                    ? [
                        {
                          id: 'finance',
                          label: 'Fees and invoices',
                          href: '/admin/finance',
                          icon: 'receipt',
                        },
                      ]
                    : []),
                ]}
              />
            )}
            toolbar={
              <ContextFilterBar
                search={{
                  value: query,
                  onChange: setQuery,
                  placeholder: 'Search by name, email or admission no.…',
                }}
                filters={[
                  {
                    id: 'grade',
                    label: 'Grade',
                    value: gradeLevel,
                    options: gradeOptions,
                    onChange: setGradeLevel,
                    allLabel: 'All grades',
                  },
                  {
                    id: 'status',
                    label: 'Status',
                    value: status,
                    options: [
                      { value: 'active', label: 'Active' },
                      { value: 'pending', label: 'Pending' },
                      { value: 'suspended', label: 'Suspended' },
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
                title={
                  total === 0 && !debounced && !gradeLevel && !status
                    ? 'No learners yet'
                    : 'No learners match these filters'
                }
                description={
                  total === 0 && !debounced && !gradeLevel && !status
                    ? 'Enrol a learner to start the directory.'
                    : 'Adjust the search, grade or status filter above.'
                }
                icon="graduation-cap"
              />
            }
          />

          <p className="text-xs text-muted-foreground">
            Admission numbers are stored as raw record identifiers, so the last eight characters are
            shown. The schema has no human-readable admission number and no stream, and there is no
            edit endpoint for a learner, so this directory is read-only.
          </p>
        </>
      )}
    </div>
  );
}
