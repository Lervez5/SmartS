'use client';

import * as React from 'react';
import Link from 'next/link';
import { useApi } from '@schoolos/hooks';
import { useAuth } from '@schoolos/auth';
import {
  DashboardCard,
  DataTable,
  EmptyState,
  ErrorState,
  GapState,
  LoadingState,
  SectionHeader,
  StatusPill,
  roleLabel,
  type DataTableColumn,
} from '@schoolos/ui';

/**
 * Shape of `GET /api/dashboard/admin`.
 *
 * Gated by `users.view` in services/api/src/modules/dashboard/routes.ts. Roles
 * without that permission fall through to a purpose-built panel below, because
 * an accountant is authorized for finance but not for the administrative rollup.
 */
interface AdminDashboardData {
  stats?: Array<{ roleId: string; name: string; _count: number }>;
  revenue?: { _sum?: { amountCents: number | null } | null; _count: number };
  activity?: Array<{
    id: string;
    action: string;
    details?: string | null;
    createdAt: string;
    user?: { id: string; name: string; email: string } | null;
  }>;
  recentUsers?: Array<{
    id: string;
    name?: string | null;
    email: string;
    status?: string | null;
    createdAt: string;
    role?: string;
  }>;
  courseCount?: number;
  pendingInvitations?: number;
}

/** `GET /api/finance/summary` - gated by `finance.view`. */
interface FinanceSummaryData {
  invoices?: {
    total?: number;
    paid?: number;
    pending?: number;
    overdue?: number;
    totalAmountCents?: number;
    paidAmountCents?: number;
    pendingAmountCents?: number;
    overdueAmountCents?: number;
  };
  accounts?: Array<{
    id: string;
    name: string;
    type: string;
    balanceCents?: number;
  }>;
  currency?: string;
}

function formatDate(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMoney(cents?: number | null, currency = 'KES'): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format((cents ?? 0) / 100);
}

function headcount(stats: AdminDashboardData['stats'], role: string): number {
  return stats?.find((s) => s.name.toUpperCase() === role)?._count ?? 0;
}

/* ------------------------------------------------------------------ *
 * Academic overview (DEAN and SUPER_ADMIN)
 *
 * Deliberately does NOT use `/api/dashboard/admin`, which is gated by
 * `users.view`. A DEAN holds the academic permissions but not `users.view`, so
 * that endpoint answers 403 and the role would see an empty dashboard. This
 * panel is built from the academic endpoints the role actually holds.
 * ------------------------------------------------------------------ */

interface StudentRow {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  gradeLevel?: string | null;
  status?: string | null;
}

interface ClassRow {
  id: string;
  name: string;
  gradeLevel?: string | null;
  subject?: { id: string; name: string } | null;
  _count?: { enrollments?: number } | null;
}

interface CourseRow {
  id: string;
  title: string;
  code?: string | null;
  status?: string | null;
  category?: string | null;
  _count?: { lessons?: number; enrollments?: number } | null;
}

function AcademicOverview() {
  const students = useApi<{ students?: StudentRow[] }>('/api/students?limit=200');
  const classes = useApi<ClassRow[]>('/api/classes');
  const courses = useApi<{ courses?: CourseRow[] }>('/api/courses');

  const learnerRows = students.data?.students ?? [];
  const classRows = classes.data ?? [];
  const courseRows = courses.data?.courses ?? [];

  const unplaced = learnerRows.filter((s) => !s.gradeLevel).length;
  const enrolled = classRows.reduce((sum, c) => sum + (c._count?.enrollments ?? 0), 0);
  const lessons = courseRows.reduce((sum, c) => sum + (c._count?.lessons ?? 0), 0);

  if (students.loading || classes.loading || courses.loading) {
    return <LoadingState label="Loading academic overview" />;
  }

  const classColumns: Array<DataTableColumn<ClassRow>> = [
    {
      id: 'name',
      header: 'Class',
      cell: (row) => (
        <span className="font-medium text-foreground">
          {row.name}
          {row.gradeLevel ? (
            <span className="ml-1.5 text-xs text-muted-foreground">{row.gradeLevel}</span>
          ) : null}
        </span>
      ),
      sortValue: (row) => row.name,
    },
    {
      id: 'subject',
      header: 'Learning Area',
      cell: (row) => row.subject?.name ?? '-',
      hideBelow: 'sm',
    },
    {
      id: 'enrolled',
      header: 'Enrolled',
      align: 'right',
      cell: (row) => row._count?.enrollments ?? 0,
      sortValue: (row) => row._count?.enrollments ?? 0,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardCard
          title="Learners"
          value={learnerRows.length}
          icon="graduation-cap"
          tone="accent"
          href="/admin/students"
        />
        <DashboardCard
          title="Classes"
          value={classRows.length}
          icon="users-round"
          description={enrolled > 0 ? `${enrolled} enrolments` : undefined}
          href="/admin/classes"
        />
        <DashboardCard
          title="Courses"
          value={courseRows.length}
          icon="book-open"
          description={lessons > 0 ? `${lessons} lessons` : undefined}
          href="/admin/courses"
        />
        <DashboardCard
          title="Awaiting placement"
          value={unplaced}
          icon="triangle-alert"
          tone={unplaced > 0 ? 'warning' : 'success'}
          description="No grade level set"
          href="/admin/students"
        />
      </div>

      {students.error || classes.error || courses.error ? (
        <ErrorState
          title="Some academic data could not be loaded"
          message="One or more academic endpoints refused the request. Your role's permissions decide which of these panels resolve."
        />
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Classes</h2>
          <Link href="/admin/classes" className="text-sm font-medium text-primary hover:underline">
            All classes
          </Link>
        </div>
        <DataTable
          caption="Classes in the school"
          columns={classColumns}
          rows={classRows}
          rowKey={(row) => row.id}
          pageSize={8}
          empty={
            <EmptyState
              title="No classes yet"
              description="Create a class to start placing learners."
              icon="users-round"
            />
          }
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">CBC oversight</h2>
        <GapState
          concept="Curriculum coverage and competency attainment"
          detail="Coverage rollups, competency attainment and learner-progress reports have no backend. There is no CurriculumCoverage, Competency, Strand or LearningOutcome model, and GET /api/academics is a stub. The counts above are live class, course and enrolment data."
        />
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * User rollup (SUPER_ADMIN only - gated by users.view)
 * ------------------------------------------------------------------ */

function UsersOverview() {
  const { data, loading, error } = useApi<AdminDashboardData>('/api/dashboard/admin');

  const stats = data?.stats ?? [];
  const activity = data?.activity ?? [];
  const recentUsers = data?.recentUsers ?? [];

  const learners = headcount(stats, 'STUDENT');
  const teachers = headcount(stats, 'TEACHER');
  const parents = headcount(stats, 'PARENT');
  const staff =
    headcount(stats, 'DEAN') + headcount(stats, 'ACCOUNTANT') + headcount(stats, 'SUPER_ADMIN');

  if (loading) return <LoadingState label="Loading account overview" />;

  if (error) {
    return (
      <ErrorState
        title="Could not load the account overview"
        message="GET /api/dashboard/admin requires users.view. Confirm the API is running and that your session still holds the permission."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardCard
          title="Learners"
          value={learners}
          icon="graduation-cap"
          tone="accent"
          href="/admin/students"
        />
        <DashboardCard title="Teachers" value={teachers} icon="user-round" href="/admin/staff" />
        <DashboardCard title="Parents" value={parents} icon="users" href="/admin/parents" />
        <DashboardCard
          title="Staff"
          value={staff}
          icon="shield-check"
          description="Dean, accountant and super admin"
          href="/admin/staff"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DashboardCard
          title="Pending invitations"
          value={data?.pendingInvitations ?? 0}
          icon="mail-plus"
          tone={(data?.pendingInvitations ?? 0) > 0 ? 'warning' : 'default'}
          href="/admin/invitations"
        />
        <DashboardCard
          title="Revenue (30 days)"
          value={formatMoney(data?.revenue?._sum?.amountCents ?? 0)}
          icon="wallet"
          meta={`${data?.revenue?._count ?? 0} paid invoices`}
          href="/admin/finance"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">Recent audit activity</h2>
          {activity.length === 0 ? (
            <EmptyState title="No recorded activity" icon="scroll-text" />
          ) : (
            <DataTable
              caption="Most recent audited actions"
              columns={[
                {
                  id: 'action',
                  header: 'Action',
                  cell: (row) => (
                    <span className="font-medium text-foreground">
                      {row.action.replace(/_/g, ' ').toLowerCase()}
                    </span>
                  ),
                },
                {
                  id: 'actor',
                  header: 'By',
                  cell: (row) => row.user?.name ?? row.user?.email ?? 'system',
                  hideBelow: 'sm',
                },
                {
                  id: 'when',
                  header: 'When',
                  align: 'right',
                  cell: (row) => formatDate(row.createdAt),
                },
              ]}
              rows={activity}
              rowKey={(row) => row.id}
              pageSize={8}
              empty={<EmptyState title="No recorded activity" icon="scroll-text" />}
            />
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">Newest accounts</h2>
          {recentUsers.length === 0 ? (
            <EmptyState title="No accounts yet" icon="users" />
          ) : (
            <DataTable
              caption="Most recently created accounts"
              columns={[
                {
                  id: 'name',
                  header: 'Name',
                  cell: (row) => row.name ?? row.email,
                },
                {
                  id: 'role',
                  header: 'Role',
                  hideBelow: 'sm',
                  cell: (row) => (row.role ? roleLabel(row.role) : '-'),
                },
                {
                  id: 'status',
                  header: 'Status',
                  align: 'right',
                  cell: (row) => (
                    <StatusPill
                      label={row.status ?? 'unknown'}
                      tone={
                        row.status === 'active'
                          ? 'success'
                          : row.status === 'pending'
                            ? 'warning'
                            : 'neutral'
                      }
                    />
                  ),
                },
              ]}
              rows={recentUsers}
              rowKey={(row) => row.id}
              pageSize={8}
              empty={<EmptyState title="No accounts yet" icon="users" />}
            />
          )}
        </section>
      </div>
    </div>
  );
}

function FinanceOverview() {
  const { can } = useAuth();
  const { data, loading, error } = useApi<FinanceSummaryData>('/api/finance/summary');

  if (loading) return <LoadingState label="Loading finance summary" />;
  if (error) {
    return (
      <ErrorState
        title="Could not load finance"
        message="GET /api/finance/summary requires finance.view. Confirm the API is running and that your session still holds the permission."
      />
    );
  }

  const invoices = data?.invoices ?? {};
  const currency = data?.currency ?? 'KES';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardCard
          title="Invoiced"
          value={formatMoney(invoices.totalAmountCents, currency)}
          icon="receipt"
          description={`${invoices.total ?? 0} invoices`}
          href="/admin/finance/invoices"
        />
        <DashboardCard
          title="Collected"
          value={formatMoney(invoices.paidAmountCents, currency)}
          icon="credit-card"
          tone="success"
          description={`${invoices.paid ?? 0} paid`}
          href="/admin/finance"
        />
        <DashboardCard
          title="Outstanding"
          value={formatMoney(invoices.pendingAmountCents, currency)}
          icon="wallet"
          tone={(invoices.pending ?? 0) > 0 ? 'warning' : 'default'}
          description={`${invoices.pending ?? 0} pending`}
          href="/admin/finance"
        />
        <DashboardCard
          title="Overdue"
          value={formatMoney(invoices.overdueAmountCents, currency)}
          icon="triangle-alert"
          tone={(invoices.overdue ?? 0) > 0 ? 'danger' : 'default'}
          description={`${invoices.overdue ?? 0} past due date`}
          href="/admin/finance"
        />
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Recent invoices</h2>
          <Link
            href="/admin/finance/invoices"
            className="text-sm font-medium text-primary hover:underline"
          >
            All invoices
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">
          The invoice register is the only billing surface the API exposes today.
        </p>
      </section>

      {can('finance.reconcile') ? (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">Reconciliation</h2>
          <GapState
            concept="Bank reconciliation"
            detail="You hold finance.reconcile, but there is no /api/finance/reconciliation route. SchoolFinanceSettings.reconciliationEnabled is configuration only - the workflow it gates does not exist yet."
          />
        </section>
      ) : null}

      {can('payroll.view') ? (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">Payroll</h2>
          <GapState
            concept="Payroll"
            detail="GET /api/payroll is a stub returning a planned placeholder. PayrollRun and Payslip exist in the schema but have no route, and Payslip.staffId is an untyped string with no foreign key."
          />
        </section>
      ) : null}
    </div>
  );
}

function AdministrationOverview() {
  const { can, permissions } = useAuth();
  const { data, loading } = useApi<AdminDashboardData>('/api/dashboard/admin');

  const stats = data?.stats ?? [];

  if (loading) return <LoadingState label="Loading platform administration" />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardCard
          title="Accounts"
          value={stats.reduce((sum, s) => sum + s._count, 0)}
          icon="users"
          tone="accent"
          href="/admin/users"
        />
        <DashboardCard
          title="Pending invitations"
          value={data?.pendingInvitations ?? 0}
          icon="mail-plus"
          tone={(data?.pendingInvitations ?? 0) > 0 ? 'warning' : 'default'}
          href="/admin/invitations"
        />
        <DashboardCard
          title="Roles"
          value={stats.length}
          icon="shield-check"
          description="Roles in use across the school"
          href="/admin/roles"
        />
        <DashboardCard
          title="Your permissions"
          value={permissions.length}
          icon="key-round"
          description="Granted by your role, enforced by the API"
          href="/profile"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">Accounts by role</h2>
          {stats.length === 0 ? (
            <EmptyState title="No accounts yet" icon="users" />
          ) : (
            <ul className="space-y-2">
              {stats.map((entry) => (
                <li
                  key={entry.roleId}
                  className="flex items-center justify-between rounded-lg border bg-card px-4 py-3"
                >
                  <StatusPill label={roleLabel(entry.name)} tone="neutral" />
                  <span className="text-sm font-semibold text-foreground">{entry._count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">Configuration</h2>
          <div className="space-y-2">
            {[
              {
                href: '/admin/settings/general',
                label: 'General & identity',
                permission: 'settings.view',
              },
              {
                href: '/admin/settings/academic',
                label: 'Academic & CBC policy',
                permission: 'settings.view',
              },
              {
                href: '/admin/settings/finance',
                label: 'Finance policy',
                permission: 'finance.view',
              },
              {
                href: '/admin/settings/branding',
                label: 'Branding',
                permission: 'settings.view',
              },
              {
                href: '/admin/settings/notifications',
                label: 'Notifications',
                permission: 'settings.view',
              },
              {
                href: '/admin/settings/security',
                label: 'Security',
                permission: 'settings.view',
              },
            ]
              .filter((entry) => can(entry.permission as never))
              .map((entry) => (
                <Link
                  key={entry.href}
                  href={entry.href}
                  className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                >
                  {entry.label}
                  <span className="text-muted-foreground">→</span>
                </Link>
              ))}
          </div>
        </section>
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">Bulk provisioning</h2>
        <GapState
          concept="User imports"
          detail="There is no bulk endpoint at all. The users module exposes no import or bulk route, and POST /api/students enrols one account at a time, so importing a cohort needs a bulk route, a parser and a job runner before it can exist. The users.import permission is granted but gates nothing yet."
        />
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Admin dashboard
 * ------------------------------------------------------------------ */

export function AdminDashboard() {
  const { user, can } = useAuth();
  const role = user?.role ?? 'DEAN';

  // Each admin role gets the panels its permissions actually support. This is a
  // capability split, not a role switch: `can()` is the only gate, so a role
  // that gains a permission later sees the panel with no code change.
  //
  // `cohorts.view` is the gate for the academic panel rather than
  // `students.view`, because an ACCOUNTANT holds students.view purely to bill
  // against a learner and has no class or course oversight. Gating on
  // students.view would hand an accountant a full academic dashboard.
  const showAcademic = can('cohorts.view') || can('courses.view');
  const showUsers = can('users.view');
  const showFinance = can('finance.view');
  const showAdministration =
    can('users.create') || can('roles.manage') || can('users.import') || can('settings.view');

  const description = React.useMemo(() => {
    switch (role) {
      case 'ACCOUNTANT':
        return 'Billing, collections and the finance surfaces your role can operate.';
      case 'DEAN':
        return 'Academic and CBC oversight across learners, classes and assessment.';
      default:
        return 'Whole-school operations: people, academics, finance and configuration.';
    }
  }, [role]);

  return (
    <div className="space-y-8">
      <SectionHeader title="Admin Dashboard" description={description} />

      {showAcademic ? <AcademicOverview /> : null}
      {showUsers ? <UsersOverview /> : null}
      {showFinance ? <FinanceOverview /> : null}
      {showAdministration && !showUsers ? <AdministrationOverview /> : null}

      {!showAcademic && !showUsers && !showFinance && !showAdministration ? (
        <EmptyState
          title="Nothing to show yet"
          description="Your role holds no dashboard-level permissions. Use the sidebar to reach the modules you are authorized for."
          icon="shield-check"
        />
      ) : null}
    </div>
  );
}
