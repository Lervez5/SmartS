'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { useApi } from '@schoolos/hooks';
import { useAuth } from '@schoolos/auth';
import {
  DataTable,
  DashboardCard,
  EmptyState,
  ErrorState,
  LoadingState,
  NavIcon,
  SectionHeader,
  SettingsCard,
  StatusPill,
  initialsOf,
  roleLabel,
  type DataTableColumn,
  type StatusTone,
} from '@schoolos/ui';

/**
 * Staff profile.
 *
 * A read view over `GET /api/staff`, the same source as the directory, because
 * the module has no per-staff endpoint. Employment and account access are shown
 * as two states, not one.
 */
interface StaffMember {
  id: string;
  userId: string;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  phone?: string | null;
  avatar?: string | null;
  userStatus: string;
  roles: Array<{ id: string; name: string }>;
  position?: string | null;
  department?: string | null;
  employeeId?: string | null;
  hireDate?: string | null;
  status: string;
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

function formatDate(value?: string | null): string {
  if (!value) return '-';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? '-'
    : parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function displayName(member: StaffMember): string {
  return member.name ?? [member.firstName, member.lastName].filter(Boolean).join(' ') ?? '';
}

export default function AdminStaffProfilePage() {
  const params = useParams();
  const staffId = params?.id as string | undefined;
  const { can } = useAuth();
  const allowed = can('staff.view');

  const { data, loading, error } = useApi<StaffResponse>(
    allowed ? '/api/staff?limit=200' : '/api/staff?denied=1'
  );

  const member = React.useMemo(
    () => (data?.staff ?? []).find((row) => row.id === staffId),
    [data, staffId]
  );

  if (!allowed) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Staff member" />
        <ErrorState
          title="You do not have access to staff records"
          message="Viewing staff requires staff.view. Your role does not hold it, and the API refuses the request independently of this screen."
        />
      </div>
    );
  }

  if (loading) return <LoadingState label="Loading the staff record" />;

  if (error) {
    return (
      <ErrorState
        title="Could not load this staff record"
        message="GET /api/staff requires staff.view. Confirm the API is running and that your session still holds the permission."
      />
    );
  }

  if (!member) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Staff member" />
        <EmptyState
          title="Staff member not found"
          description="No staff record on the directory matches this identifier."
          icon="graduation-cap"
          action={
            <a
              href="/admin/staff"
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Back to School Staff
            </a>
          }
        />
      </div>
    );
  }

  const name = displayName(member);

  const detailRows = [
    { field: 'Full name', value: name || '-' },
    { field: 'Email', value: member.email },
    { field: 'Phone', value: member.phone || '-' },
    { field: 'Employee ID', value: member.employeeId || '-', mono: Boolean(member.employeeId) },
    { field: 'Position', value: member.position || '-' },
    { field: 'Department', value: member.department || '-' },
    { field: 'Hire date', value: formatDate(member.hireDate) },
    { field: 'Employment status', value: member.status.replace(/_/g, ' ') },
    { field: 'Account access', value: member.userStatus },
    { field: 'Record id', value: member.id, mono: true },
  ];

  const columns: Array<DataTableColumn<{ field: string; value: string; mono?: boolean }>> = [
    { id: 'field', header: 'Field', cell: (row) => row.field },
    {
      id: 'value',
      header: 'Value',
      cell: (row) => (
        <span className={row.mono ? 'font-mono text-xs text-foreground' : undefined}>
          {row.value}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        title={name || 'Staff member'}
        description="Staff record and portal access, as held by the platform."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {can('staff.manage') ? (
              <a
                href={`/admin/staff/${member.id}/edit`}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-background px-3.5 text-sm font-semibold transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <NavIcon name="pencil" className="h-4 w-4" />
                Edit
              </a>
            ) : null}
            {can('roles.manage') ? (
              <a
                href={`/admin/staff/${member.id}/access`}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-background px-3.5 text-sm font-semibold transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <NavIcon name="key-round" className="h-4 w-4" />
                Portal access
              </a>
            ) : null}
            <a
              href="/admin/staff"
              className="rounded-md border border-input bg-background px-3.5 py-2 text-sm font-semibold transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Back to School Staff
            </a>
          </div>
        }
      />

      <div className="flex items-center gap-4 rounded-lg border bg-card p-5">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-lg font-bold text-primary">
          {member.avatar ? (
            <span
              role="img"
              aria-label=""
              className="h-full w-full bg-cover bg-center"
              style={{ backgroundImage: `url(${member.avatar})` }}
            />
          ) : (
            initialsOf(name || member.email)
          )}
        </span>
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-foreground">{name || 'Unnamed'}</p>
          <p className="truncate text-sm text-muted-foreground">
            {[member.position, member.department].filter(Boolean).join(' · ') || member.email}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <StatusPill
              label={`employment: ${member.status.replace(/_/g, ' ')}`}
              tone={EMPLOYMENT_TONE[member.status] ?? 'neutral'}
            />
            <StatusPill
              label={`access: ${member.userStatus}`}
              tone={ACCOUNT_TONE[member.userStatus] ?? 'neutral'}
            />
            {member.roles.map((r) => (
              <StatusPill key={r.id} label={roleLabel(r.name)} tone="brand" />
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardCard title="Position" value={member.position ?? '-'} icon="user-round" />
        <DashboardCard title="Department" value={member.department ?? '-'} icon="layers" />
        <DashboardCard
          title="Can sign in"
          value={member.userStatus === 'active' ? 'Yes' : 'No'}
          icon="shield-check"
          tone={member.userStatus === 'active' ? 'success' : 'warning'}
        />
        <DashboardCard title="Hired" value={formatDate(member.hireDate)} icon="calendar-check" />
      </div>

      <SettingsCard
        title="Staff details"
        description="Every field the staff record holds. Name, email and phone belong to the Central Auth account, not to the staff record."
      >
        <DataTable
          caption="Full staff record"
          columns={columns}
          rows={detailRows}
          rowKey={(row) => row.field}
        />
      </SettingsCard>
    </div>
  );
}
