'use client';

import * as React from 'react';
import { useApi } from '@schoolos/hooks';
import { useAuth } from '@schoolos/auth';
import {
  ContextFilterBar,
  DashboardCard,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  SectionHeader,
  StatusPill,
  roleLabel,
  type DataTableColumn,
} from '@schoolos/ui';

/**
 * `GET /api/users` - gated by `users.view`. A role without that permission
 * cannot reach the route at all: the API answers 403 and the page shows the
 * refusal rather than redirecting, so the reason is visible rather than silent.
 *
 * `listUsersService` flattens each account to a stable shape, so the role
 * arrives as a single string rather than a membership list.
 */
interface UserRow {
  id: string;
  email: string;
  name?: string | null;
  role: string;
  isActive: boolean;
  invitationStatus: 'pending' | 'accepted';
}

interface UsersResponse {
  users?: UserRow[];
}

function displayName(row: UserRow): string {
  return row.name ?? '';
}

/** Maps the flattened account onto the status vocabulary the UI shows. */
function statusOf(row: UserRow): 'active' | 'pending' | 'inactive' {
  if (row.invitationStatus === 'pending') return 'pending';
  return row.isActive ? 'active' : 'inactive';
}

const STATUS_TONE = {
  active: 'success',
  pending: 'warning',
  inactive: 'neutral',
} as const;

export default function AdminUsersPage() {
  const { can, permissions } = useAuth();
  const allowed = can('users.view');

  const [query, setQuery] = React.useState('');
  const [roleFilter, setRoleFilter] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');

  const { data, loading, error } = useApi<UsersResponse>(
    allowed ? '/api/users' : '/api/users?denied=1'
  );

  const users = data?.users ?? [];

  const roleOptions = React.useMemo(() => {
    const seen = new Map<string, string>();
    for (const user of users) {
      if (user.role) seen.set(user.role, roleLabel(user.role));
    }
    return [...seen.entries()].map(([value, label]) => ({ value, label }));
  }, [users]);

  const filtered = users.filter((row) => {
    const name = displayName(row);
    if (query) {
      const needle = query.toLowerCase();
      if (!row.email.toLowerCase().includes(needle) && !name.toLowerCase().includes(needle)) {
        return false;
      }
    }
    if (roleFilter && row.role !== roleFilter) return false;
    if (statusFilter && statusOf(row) !== statusFilter) return false;
    return true;
  });

  const columns: Array<DataTableColumn<UserRow>> = [
    {
      id: 'name',
      header: 'Name',
      cell: (row) => (
        <span className="font-medium text-foreground">
          {displayName(row) || <span className="text-muted-foreground">Unnamed</span>}
        </span>
      ),
      sortValue: (row) => displayName(row),
    },
    { id: 'email', header: 'Email', cell: (row) => row.email, hideBelow: 'sm' },
    {
      id: 'role',
      header: 'Role',
      cell: (row) => <StatusPill label={roleLabel(row.role)} tone="brand" />,
    },
    {
      id: 'status',
      header: 'Status',
      align: 'right',
      cell: (row) => {
        const status = statusOf(row);
        return <StatusPill label={status} tone={STATUS_TONE[status]} />;
      },
      sortValue: (row) => statusOf(row),
    },
  ];

  if (!allowed) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Users" />
        <ErrorState
          title="You do not have access to this area"
          message="Viewing the user register requires users.view. Your role does not hold it, and the API independently refuses the request."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Users"
        description="Every account in the school. Accounts are provisioned by invitation; there is no public registration."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <DashboardCard title="Total accounts" value={users.length} icon="users" tone="accent" />
        <DashboardCard
          title="Active"
          value={users.filter((u) => statusOf(u) === 'active').length}
          icon="check"
          tone="success"
        />
        <DashboardCard
          title="Pending activation"
          value={users.filter((u) => statusOf(u) === 'pending').length}
          icon="mail-plus"
          tone={users.some((u) => statusOf(u) === 'pending') ? 'warning' : 'default'}
          href="/admin/invitations"
        />
      </div>

      {loading ? (
        <LoadingState label="Loading accounts" />
      ) : error ? (
        <ErrorState
          title="Could not load accounts"
          message="GET /api/users requires users.view. Confirm the API is running and that your session still holds the permission."
        />
      ) : (
        <DataTable
          caption="User register for the signed-in administrator"
          columns={columns}
          rows={filtered}
          rowKey={(row) => row.id}
          pageSize={15}
          toolbar={
            <ContextFilterBar
              search={{
                value: query,
                onChange: setQuery,
                placeholder: 'Search by name or email…',
              }}
              filters={[
                {
                  id: 'role',
                  label: 'Role',
                  value: roleFilter,
                  options: roleOptions,
                  onChange: setRoleFilter,
                  allLabel: 'All roles',
                },
                {
                  id: 'status',
                  label: 'Status',
                  value: statusFilter,
                  options: [
                    { value: 'active', label: 'Active' },
                    { value: 'pending', label: 'Pending' },
                    { value: 'inactive', label: 'Inactive' },
                  ],
                  onChange: setStatusFilter,
                  allLabel: 'All statuses',
                },
              ]}
            />
          }
          empty={
            <EmptyState
              title={users.length === 0 ? 'No accounts yet' : 'No accounts match your filters'}
              description={
                users.length === 0
                  ? 'Invite the first user to get started.'
                  : 'Adjust the search or filters above.'
              }
              icon="users"
            />
          }
        />
      )}

      <p className="text-xs text-muted-foreground">
        You hold {permissions.length} permissions. Row-level actions appear only where your role
        grants them, and the API re-authorizes every call regardless of what the interface renders.
      </p>
    </div>
  );
}
