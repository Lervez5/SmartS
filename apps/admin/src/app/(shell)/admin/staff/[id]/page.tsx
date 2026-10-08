'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { useApi } from '@schoolos/hooks';
import { useAuth } from '@schoolos/auth';
import {
  DashboardCard,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  NavIcon,
  PrimaryActionButton,
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
 * A read view over `GET /api/staff`, plus `GET /api/staff/:userId/assignments`
 * for the academic allocations. Employment and account access are shown as two
 * states, not one, and academic responsibilities are shown as a third layer
 * because they are assignments, not identity or employment.
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
  userStatus: string;
  roles: StaffRoleRef[];
  position?: string | null;
  department?: string | null;
  employeeId?: string | null;
  hireDate?: string | null;
  status: string;
}

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

interface StaffResponse {
  staff?: StaffMember[];
}

interface AssignmentsResponse {
  teacher?: {
    id: string;
    name: string | null;
    email: string;
  };
  assignments?: StaffAssignment[];
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
  const canManageAssignments = can('teaching.manage');

  const { data, loading, error } = useApi<StaffResponse>(
    allowed ? '/api/staff?limit=200' : '/api/staff?denied=1'
  );

  const member = React.useMemo(
    () => (data?.staff ?? []).find((row) => row.id === staffId),
    [data, staffId]
  );

  const { data: assignmentsData } = useApi<AssignmentsResponse>(
    allowed && member ? `/api/staff/${member.userId}/assignments` : '/api/staff?denied=1'
  );

  const assignments = React.useMemo(() => assignmentsData?.assignments ?? [], [assignmentsData]);

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

  const mainTeacherCount = assignments.filter((a) => a.responsibility === 'main_class_teacher' && a.status === 'active').length;
  const assistantTeacherCount = assignments.filter((a) => a.responsibility === 'assistant_class_teacher' && a.status === 'active').length;
  const subjectTeacherCount = assignments.filter((a) => a.responsibility === 'subject_teacher' && a.status === 'active').length;
  const activeAssignments = assignments.filter((a) => a.status === 'active');

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

  const assignmentColumns: Array<DataTableColumn<StaffAssignment>> = [
    {
      id: 'session',
      header: 'Academic Session',
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
          {row.subject && (
            <span className="text-xs text-muted-foreground">{row.subject.name}</span>
          )}
        </div>
      ),
      sortValue: (row) => row.responsibility,
    },
    {
      id: 'period',
      header: 'Period',
      cell: (row) => (
        <div className="text-xs">
          <p>{formatDate(row.effectiveFrom)}</p>
          {row.effectiveTo && <p className="text-muted-foreground">to {formatDate(row.effectiveTo)}</p>}
        </div>
      ),
      sortValue: (row) => row.effectiveFrom,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => (
        <StatusPill
          label={row.status}
          tone={row.status === 'active' ? 'success' : 'neutral'}
        />
      ),
      sortValue: (row) => row.status,
    },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        title={name || 'Staff member'}
        description="Staff record, portal access, and academic responsibilities."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {canManageAssignments ? (
              <PrimaryActionButton
                href={`/admin/staff/${member.id}/assignments`}
                label="Manage Assignments"
                icon="book-open"
              />
            ) : null}
            {can('teaching.view') ? (
              <PrimaryActionButton
                href="/admin/academics/teacher-allocation"
                label="View Teaching Teams"
                icon="users"
                variant="outline"
              />
            ) : null}
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
        <DashboardCard title="Main teacher" value={mainTeacherCount} icon="user-round-check" tone="success" description="Streams led" />
        <DashboardCard title="Assistant teacher" value={assistantTeacherCount} icon="user-round" tone="accent" description="Streams supported" />
        <DashboardCard title="Subject teacher" value={subjectTeacherCount} icon="book-open" tone="default" description="Learning areas taught" />
        <DashboardCard title="Hired" value={formatDate(member.hireDate)} icon="calendar-check" />
      </div>

      <SettingsCard
        title="Academic assignments"
        description="Teaching allocations from the authoritative StreamAllocation model. These are assignments, not global roles."
      >
        {activeAssignments.length === 0 ? (
          <EmptyState
            title="No academic assignments"
            description={
              canManageAssignments
                ? 'This staff member has no active teaching allocations. Use Manage Assignments to create one.'
                : 'This staff member has no active teaching allocations on record.'
            }
            icon="book-open"
            action={
              canManageAssignments ? (
                <a
                  href={`/admin/staff/${member.id}/assignments`}
                  className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Add Assignment
                </a>
              ) : null
            }
          />
        ) : (
          <DataTable
            caption="Academic assignments"
            columns={assignmentColumns}
            rows={activeAssignments}
            rowKey={(row) => row.id}
            pageSize={20}
            empty={
              <EmptyState
                title="No active assignments"
                description="There are no active academic assignments for this staff member."
                icon="book-open"
              />
            }
          />
        )}
      </SettingsCard>

      <SettingsCard
        title="Staff details"
        description="Every field the staff record holds. Name, email and phone belong to the Central Auth account, not to the staff record."
      >
        <DataTable
          caption="Full staff record"
          columns={[
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
          ]}
          rows={detailRows}
          rowKey={(row) => row.field}
        />
      </SettingsCard>
    </div>
  );
}
