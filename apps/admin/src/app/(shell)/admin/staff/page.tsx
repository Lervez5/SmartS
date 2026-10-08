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
  initialsOf,
  roleLabel,
  type DataTableColumn,
  type StatusTone,
} from '@schoolos/ui';

/**
 * School Staff - the faculty and administrative directory.
 *
 * Reads `GET /api/staff`, which is gated by `staff.view` and returns
 * StaffProfile joined to User. Two independent states come back and are shown
 * as two independent things, because they are:
 *
 *  - `status`     is the employment state (StaffStatus): active, on_leave,
 *                 terminated, archived.
 *  - `userStatus` is the account state (UserStatus): pending, active,
 *                 suspended, archived. A staff member can be employed and still
 *                 unable to sign in.
 *
 * Collapsing these into one status would hide exactly the distinction an
 * administrator needs when someone "cannot log in".
 *
 * When `include=assignments` is requested, the API also returns each member's
 * current academic allocations from the authoritative StreamAllocation model,
 * so the directory can show who is teaching what without inventing data.
 */
interface StaffRoleRef {
  id: string;
  name: string;
}

interface StaffMember {
  id: string;
  userId: string;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  phone?: string | null;
  avatar?: string | null;
  /** Account / login state. */
  userStatus: 'pending' | 'active' | 'suspended' | 'archived';
  roles: StaffRoleRef[];
  position?: string | null;
  department?: string | null;
  employeeId?: string | null;
  hireDate?: string | null;
  /** Employment state. */
  status: 'active' | 'on_leave' | 'terminated' | 'archived';
  assignmentsSummary?: {
    total: number;
    mainTeacherStreams: number;
    assistantTeacherStreams: number;
    subjectTeacherStreams: number;
    learningAreas: number;
  };
}

interface StaffResponse {
  staff?: StaffMember[];
}

const EMPLOYMENT_TONE: Record<string, StatusTone> = {
  active: 'success',
  on_leave: 'warning',
  terminated: 'danger',
  archived: 'neutral',
};

const ACCOUNT_TONE: Record<string, StatusTone> = {
  active: 'success',
  pending: 'info',
  suspended: 'danger',
  archived: 'neutral',
};

const SORTS = [
  { value: 'name_asc', label: 'Name (A–Z)' },
  { value: 'name_desc', label: 'Name (Z–A)' },
  { value: 'hired_asc', label: 'Hire date (oldest first)' },
  { value: 'hired_desc', label: 'Hire date (newest first)' },
  { value: 'newest', label: 'Recently added' },
  { value: 'oldest', label: 'First added' },
];

function displayName(member: StaffMember): string {
  return member.name ?? [member.firstName, member.lastName].filter(Boolean).join(' ') ?? '';
}

export default function AdminSchoolStaffPage() {
  const { can } = useAuth();
  const allowed = can('staff.view');

  const [query, setQuery] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [role, setRole] = React.useState('');
  const [employment, setEmployment] = React.useState('');
  const [account, setAccount] = React.useState('');
  const [sort, setSort] = React.useState('name_asc');

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const params = new URLSearchParams({ sort, include: 'assignments' });
  if (debounced) params.set('search', debounced);
  if (role) params.set('role', role);
  if (employment) params.set('status', employment);
  if (account) params.set('accountStatus', account);
  params.set('limit', '200');

  const { data, loading, error } = useApi<StaffResponse>(
    allowed ? `/api/staff?${params.toString()}` : '/api/staff?denied=1'
  );

  const staff = React.useMemo(() => data?.staff ?? [], [data]);

  const roleOptions = React.useMemo(() => {
    const seen = new Map<string, string>();
    for (const member of staff) {
      for (const r of member.roles) seen.set(r.name, roleLabel(r.name));
    }
    return [...seen.entries()].map(([value, label]) => ({ value, label }));
  }, [staff]);

  const total = staff.length;
  const employed = staff.filter((m) => m.status === 'active').length;
  const onLeave = staff.filter((m) => m.status === 'on_leave').length;
  const canSignIn = staff.filter((m) => m.userStatus === 'active').length;
  const blocked = staff.filter((m) => m.userStatus === 'suspended').length;
  const withAssignments = staff.filter((m) => (m.assignmentsSummary?.total ?? 0) > 0).length;

  const filtered = debounced || role || employment || account ? staff.length : staff.length;

  const columns: Array<DataTableColumn<StaffMember>> = [
    {
      id: 'profile',
      header: 'Staff Profile',
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
                {row.employeeId ? (
                  <span className="font-mono">{row.employeeId}</span>
                ) : (
                  <span>No employee ID</span>
                )}
                {row.position ? ` · ${row.position}` : ''}
              </p>
            </div>
          </div>
        );
      },
      sortValue: (row) => displayName(row),
    },
    {
      id: 'role',
      header: 'Role',
      cell: (row) =>
        row.roles.length === 0 ? (
          <span className="text-muted-foreground">-</span>
        ) : (
          <div className="flex flex-wrap items-center gap-1">
            {row.roles.map((r) => (
              <StatusPill key={r.id} label={roleLabel(r.name)} tone="brand" />
            ))}
          </div>
        ),
      sortValue: (row) => row.roles.map((r) => r.name).join(','),
    },
    {
      id: 'assignments',
      header: 'Academic Assignments',
      cell: (row) => {
        const summary = row.assignmentsSummary;
        if (!summary || summary.total === 0) {
          return <span className="text-xs text-muted-foreground">No allocations</span>;
        }
        return (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-foreground">
              {summary.mainTeacherStreams > 0 && `${summary.mainTeacherStreams} main`}
              {summary.mainTeacherStreams > 0 && summary.assistantTeacherStreams > 0 && ' · '}
              {summary.assistantTeacherStreams > 0 && `${summary.assistantTeacherStreams} asst`}
              {summary.assistantTeacherStreams > 0 && summary.subjectTeacherStreams > 0 && ' · '}
              {summary.subjectTeacherStreams > 0 && `${summary.subjectTeacherStreams} subject`}
            </span>
            {summary.learningAreas > 0 && (
              <span className="text-xs text-muted-foreground">
                {summary.learningAreas} learning area{summary.learningAreas !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        );
      },
      sortValue: (row) => row.assignmentsSummary?.total ?? 0,
    },
    {
      id: 'contact',
      header: 'Contact Info',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-foreground">{row.email}</p>
          {row.phone ? (
            <p className="truncate text-xs text-muted-foreground">{row.phone}</p>
          ) : (
            <p className="truncate text-xs text-muted-foreground">No phone on file</p>
          )}
        </div>
      ),
      sortValue: (row) => row.email,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => (
        <div className="flex flex-col items-end gap-1">
          <StatusPill
            label={row.status.replace(/_/g, ' ')}
            tone={EMPLOYMENT_TONE[row.status] ?? 'neutral'}
          />
          <StatusPill
            label={`login: ${row.userStatus}`}
            tone={ACCOUNT_TONE[row.userStatus] ?? 'neutral'}
          />
        </div>
      ),
      sortValue: (row) => `${row.status}/${row.userStatus}`,
    },
  ];

  if (!allowed) {
    return (
      <div className="space-y-6">
        <SectionHeader title="School Staff" />
        <ErrorState
          title="You do not have access to staff records"
          message="Viewing staff requires staff.view. Your role does not hold it, and the API refuses the request independently of this screen."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="School Staff"
        description={`Faculty, administrative staff and their system access. ${total === 1 ? '1 member' : `${total} members`} on the directory.`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {can('teaching.view') ? (
              <PrimaryActionButton
                href="/admin/academics/teacher-allocation"
                label="View Teaching Teams"
                icon="users"
                variant="outline"
                title="Open the Teacher Allocation page to see who covers each stream."
              />
            ) : null}
            {can('staff.manage') ? (
              <PrimaryActionButton
                href="/admin/staff/new"
                label="Add Staff"
                icon="user-plus"
                title="Creates a staff profile for an existing account via POST /api/staff."
              />
            ) : null}
          </div>
        }
      />

      {loading ? (
        <LoadingState label="Loading the staff directory" />
      ) : error ? (
        <ErrorState
          title="Could not load the staff directory"
          message="GET /api/staff requires staff.view. Confirm the API is running and that your session still holds the permission."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <DashboardCard
              title="Staff on directory"
              value={filtered}
              icon="graduation-cap"
              tone="accent"
              description={
                debounced || role || employment || account
                  ? 'Matching the current filters'
                  : 'Everyone the directory returns'
              }
            />
            <DashboardCard
              title="Employed"
              value={employed}
              icon="check"
              tone="success"
              description={`${onLeave} on leave`}
            />
            <DashboardCard
              title="Can sign in"
              value={canSignIn}
              icon="shield-check"
              tone="success"
              description="Account state is active"
            />
            <DashboardCard
              title="Access suspended"
              value={blocked}
              icon="triangle-alert"
              tone={blocked > 0 ? 'danger' : 'success'}
              description="Employed but unable to sign in"
            />
            <DashboardCard
              title="With assignments"
              value={withAssignments}
              icon="book-open"
              tone="default"
              description="Teaching allocations active"
            />
          </div>

          <DataTable
            caption="Faculty and administrative staff"
            columns={columns}
            rows={staff}
            rowKey={(row) => row.id}
            pageSize={15}
            onRowClick={(row) => {
              window.location.href = `/admin/staff/${row.id}`;
            }}
            renderRowActions={(row) => {
              const name = displayName(row) || row.email;
              return (
                <ActionButtons
                  items={[
                    {
                      id: 'view',
                      label: `View profile for ${name}`,
                      href: `/admin/staff/${row.id}`,
                      icon: 'eye',
                    },
                    ...(can('teaching.view')
                      ? [
                          {
                            id: 'assignments',
                            label: `Manage academic assignments for ${name}`,
                            href: `/admin/staff/${row.id}/assignments`,
                            icon: 'book-open',
                          },
                        ]
                      : []),
                    ...(can('staff.manage')
                      ? [
                          {
                            id: 'edit',
                            label: `Edit ${name}`,
                            href: `/admin/staff/${row.id}/edit`,
                            icon: 'pencil',
                          },
                        ]
                      : []),
                    ...(can('roles.manage')
                      ? [
                          {
                            id: 'access',
                            label: `Manage portal access for ${name}`,
                            href: `/admin/staff/${row.id}/access`,
                            icon: 'key-round',
                          },
                        ]
                      : []),
                  ]}
                />
              );
            }}
            toolbar={
              <ContextFilterBar
                search={{
                  value: query,
                  onChange: setQuery,
                  placeholder: 'Search by name, email, phone or employee ID…',
                }}
                filters={[
                  {
                    id: 'role',
                    label: 'Role',
                    value: role,
                    options: roleOptions,
                    onChange: setRole,
                    allLabel: 'All roles',
                  },
                  {
                    id: 'employment',
                    label: 'Employment',
                    value: employment,
                    options: [
                      { value: 'active', label: 'Active' },
                      { value: 'on_leave', label: 'On leave' },
                      { value: 'terminated', label: 'Terminated' },
                      { value: 'archived', label: 'Archived' },
                    ],
                    onChange: setEmployment,
                    allLabel: 'All employment',
                  },
                  {
                    id: 'account',
                    label: 'Login / Account Access',
                    value: account,
                    options: [
                      { value: 'active', label: 'Active' },
                      { value: 'pending', label: 'Pending' },
                      { value: 'suspended', label: 'Suspended' },
                      { value: 'archived', label: 'Archived' },
                    ],
                    onChange: setAccount,
                    allLabel: 'All access',
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
              />
            }
            empty={
              <EmptyState
                title={
                  total === 0 && !debounced && !role && !employment && !account
                    ? 'No staff on the directory'
                    : 'No staff match these filters'
                }
                description={
                  total === 0 && !debounced && !role && !employment && !account
                    ? 'Add a staff member, or filter the directory.'
                    : 'Adjust the search, filters or sorting above.'
                }
                icon="graduation-cap"
              />
            }
          />

          <p className="text-xs text-muted-foreground">
            Employment and account access are separate: employment comes from the staff record,
            access from the Central Auth account. Account activation and deactivation have no
            endpoint yet, so access can be read here but not changed from this screen - the role
            action changes what the member can do, not whether they can sign in.
          </p>
        </>
      )}
    </div>
  );
}
