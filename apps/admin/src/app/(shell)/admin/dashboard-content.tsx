'use client';

import * as React from 'react';
import Link from 'next/link';
import { useApi } from '@schoolos/hooks';
import { useAuth } from '@schoolos/auth';
import { useAcademicSession } from '@schoolos/ui';
import {
  DashboardCard,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  SectionHeader,
  StatusPill,
  notify,
  type DataTableColumn,
} from '@schoolos/ui';

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

interface DashboardContext {
  academicYearId: string | null;
  termId: string | null;
  termName: string | null;
  sessionName: string | null;
}

interface FinancialMetrics {
  collectionRate: number | null;
  collectedCents: number;
  expectedCents: number;
  activeLearners: number;
  todayPayments: { count: number; amountCents: number };
  termCollections: { count: number; amountCents: number };
  arrears: { count: number; amountCents: number };
}

interface CollectionsBreakdown {
  method: string;
  amountCents: number;
  count: number;
  percentage: number;
}

interface RecentPayment {
  id: string;
  amountCents: number;
  method: string;
  paidByName: string;
  learnerName: string;
  reference: string;
  receivedAt: string;
}

interface TeacherActivity {
  teacherId: string;
  teacherName: string;
  assessmentCount: number;
  learnersAssessed: number;
}

interface AdminDashboardResponse {
  context: DashboardContext;
  financial: FinancialMetrics;
  collections: CollectionsBreakdown[];
  recentPayments: RecentPayment[];
  teacherActivity: TeacherActivity[];
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

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function formatMoney(cents?: number | null, currency = 'KES'): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format((cents ?? 0) / 100);
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

function collectionTone(rate: number | null): 'success' | 'warning' | 'danger' | 'default' {
  if (rate === null) return 'default';
  if (rate >= 75) return 'success';
  if (rate >= 50) return 'warning';
  return 'danger';
}

function paymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    cash: 'Cash',
    mpesa: 'M-Pesa',
    bank_transfer: 'Bank Transfer',
    card: 'Card',
    cheque: 'Cheque',
  };
  return labels[method] ?? method;
}

/* ------------------------------------------------------------------ *
 * Financial Summary Cards
 * ------------------------------------------------------------------ */

function FinancialSummary({ data }: { data: AdminDashboardResponse['financial'] }) {
  const { can } = useAuth();

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <DashboardCard
        title="Collection Rate"
        value={data.collectionRate !== null ? `${data.collectionRate.toFixed(1)}%` : '-'}
        icon="trending-up"
        tone={collectionTone(data.collectionRate)}
        description={`${formatMoney(data.collectedCents)} collected of ${formatMoney(data.expectedCents)}`}
      />
      <DashboardCard
        title="Active Learners"
        value={data.activeLearners}
        icon="graduation-cap"
        tone="accent"
      />
      <DashboardCard
        title="Today's Payments"
        value={formatMoney(data.todayPayments.amountCents)}
        icon="credit-card"
        tone="success"
        description={`${data.todayPayments.count} payment${data.todayPayments.count === 1 ? '' : 's'}`}
      />
      <DashboardCard
        title="Term Collections"
        value={formatMoney(data.termCollections.amountCents)}
        icon="wallet"
        description={`${data.termCollections.count} transaction${data.termCollections.count === 1 ? '' : 's'}`}
      />
      <DashboardCard
        title="Arrears"
        value={formatMoney(data.arrears.amountCents)}
        icon="triangle-alert"
        tone={data.arrears.amountCents > 0 ? 'danger' : 'default'}
        description={`${data.arrears.count} outstanding`}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Collections Breakdown
 * ------------------------------------------------------------------ */

function CollectionsBreakdown({ data }: { data: AdminDashboardResponse['collections'] }) {
  if (data.length === 0) {
    return (
      <EmptyState
        title="No collections yet"
        description="Payments will appear here once they are recorded."
        icon="credit-card"
      />
    );
  }

  const maxAmount = Math.max(...data.map((d) => d.amountCents));

  return (
    <div className="space-y-3">
      {data.map((item) => {
        const width = maxAmount > 0 ? (item.amountCents / maxAmount) * 100 : 0;
        return (
          <div key={item.method} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">{paymentMethodLabel(item.method)}</span>
              <div className="text-right">
                <span className="font-semibold text-foreground">{formatMoney(item.amountCents)}</span>
                <span className="ml-2 text-xs text-muted-foreground">{item.percentage.toFixed(1)}%</span>
              </div>
            </div>
            <div className="h-2 w-full rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-primary transition-all duration-500"
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Recent Payments
 * ------------------------------------------------------------------ */

const paymentColumns: Array<DataTableColumn<RecentPayment>> = [
  {
    id: 'reference',
    header: 'Reference',
    cell: (row) => <span className="font-mono text-xs">{row.reference}</span>,
  },
  {
    id: 'learner',
    header: 'Learner',
    cell: (row) => <span className="truncate">{row.learnerName}</span>,
  },
  {
    id: 'paidBy',
    header: 'Paid By',
    cell: (row) => row.paidByName,
    hideBelow: 'sm',
  },
  {
    id: 'method',
    header: 'Method',
    cell: (row) => paymentMethodLabel(row.method),
    hideBelow: 'md',
  },
  {
    id: 'amount',
    header: 'Amount',
    align: 'right',
    cell: (row) => <span className="font-semibold">{formatMoney(row.amountCents)}</span>,
    sortValue: (row) => row.amountCents,
  },
  {
    id: 'when',
    header: 'When',
    align: 'right',
    cell: (row) => formatDate(row.receivedAt),
    sortValue: (row) => row.receivedAt,
  },
];

function RecentPayments({ data }: { data: RecentPayment[] }) {
  if (data.length === 0) {
    return (
      <EmptyState
        title="No payments yet"
        description="Recorded payments will appear here."
        icon="credit-card"
      />
    );
  }

  return (
    <DataTable
      caption="Recent payments"
      columns={paymentColumns}
      rows={data}
      rowKey={(row) => row.id}
      pageSize={5}
      empty={<EmptyState title="No payments yet" icon="credit-card" />}
    />
  );
}

/* ------------------------------------------------------------------ *
 * Teacher Assessment Leaderboard
 * ------------------------------------------------------------------ */

const teacherColumns: Array<DataTableColumn<TeacherActivity>> = [
  {
    id: 'name',
    header: 'Teacher',
    cell: (row) => <span className="font-medium text-foreground">{row.teacherName}</span>,
    sortValue: (row) => row.teacherName,
  },
  {
    id: 'assessments',
    header: 'Assessments',
    align: 'right',
    cell: (row) => row.assessmentCount,
    sortValue: (row) => row.assessmentCount,
  },
  {
    id: 'learners',
    header: 'Learners Assessed',
    align: 'right',
    cell: (row) => row.learnersAssessed,
    sortValue: (row) => row.learnersAssessed,
  },
];

function TeacherLeaderboard({ data }: { data: TeacherActivity[] }) {
  if (data.length === 0) {
    return (
      <EmptyState
        title="No assessment activity"
        description="Teacher assessment activity will appear here once assessments are created and scored."
        icon="file-check"
      />
    );
  }

  return (
    <DataTable
      caption="Teacher assessment activity"
      columns={teacherColumns}
      rows={data}
      rowKey={(row) => row.teacherId}
      pageSize={5}
      empty={
        <EmptyState
          title="No assessment activity"
          description="Teacher assessment activity will appear here once assessments are created and scored."
          icon="file-check"
        />
      }
    />
  );
}

/* ------------------------------------------------------------------ *
 * Main Dashboard
 * ------------------------------------------------------------------ */

export function AdminDashboard() {
  const { user, can } = useAuth();
  const role = user?.role ?? 'DEAN';
  const { sessionId, setSessionId, termId, setTermId, current, termsForSelectedYear, ready } = useAcademicSession();

  const showAcademic = can('students.view') && can('cohorts.view') && can('courses.view');
  const showUsers = can('users.view');
  const showFinance = can('finance.view');
  const showAdministration =
    can('users.create') || can('roles.manage') || can('users.import') || can('settings.view');
  const showTeacherActivity = can('examinations.view') || can('grading.view');

  const { data, loading, error, refetch } = useApi<AdminDashboardResponse>(
    `/api/dashboard/admin?academicYearId=${sessionId}&termId=${termId}`
  );

  const handleRecordPayment = React.useCallback(() => {
    notify.info('Payment recording workflow coming soon');
  }, []);

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

  const termOptions = React.useMemo(
    () =>
      termsForSelectedYear.map((t) => ({
        id: t.id,
        label: t.name ?? `Term ${t.termNumber}`,
      })),
    [termsForSelectedYear]
  );

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Admin Dashboard"
        description={description}
        action={
          can('finance.payments') ? (
            <button
              type="button"
              onClick={handleRecordPayment}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              <span className="hidden sm:inline">Record Payment</span>
              <span className="sm:hidden">Payment</span>
            </button>
          ) : null}
      />

      {/* Academic Session / Term Context */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Session:</span>
          {ready && current ? (
            <span className="text-sm font-semibold text-foreground">{current.label}</span>
          ) : ready ? (
            <span className="text-sm text-muted-foreground">No session selected</span>
          ) : (
            <span className="text-sm text-muted-foreground">Loading…</span>
          )}
        </div>
        {termOptions.length > 0 ? (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Term:</span>
            <select
              value={termId}
              onChange={(e) => setTermId(e.target.value)}
              className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
            >
              <option value="">All terms</option>
              {termOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {data?.context?.termName ? (
          <StatusPill label={data.context.termName} tone="info" />
        ) : null}
      </div>

      {error ? (
        <ErrorState
          title="Could not load dashboard"
          message="GET /api/dashboard/admin refused the request. Confirm the API is running and that your session still holds the required permissions."
        />
      ) : null}

      {/* Finance Section */}
      {showFinance && data?.financial ? (
        <section className="space-y-6">
          <h2 className="text-base font-semibold text-foreground">Financial Summary</h2>
          <FinancialSummary data={data.financial} />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Collections Breakdown</h3>
              <CollectionsBreakdown data={data.collections} />
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Recent Payments</h3>
                <Link href="/admin/finance" className="text-sm font-medium text-primary hover:underline">
                  All finance
                </Link>
              </div>
              <RecentPayments data={data.recentPayments} />
            </section>
          </div>
        </section>
      ) : showFinance && loading ? (
        <section className="space-y-6">
          <h2 className="text-base font-semibold text-foreground">Financial Summary</h2>
          <LoadingState label="Loading financial summary" />
        </section>
      ) : null}

      {/* Academic Section */}
      {showAcademic ? (
        <section className="space-y-6">
          <h2 className="text-base font-semibold text-foreground">Academic Overview</h2>
          <AcademicOverview sessionId={sessionId} termId={termId} />
        </section>
      ) : null}

      {/* Teacher Assessment Activity */}
      {showTeacherActivity && data?.teacherActivity ? (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">Teacher Assessment Activity</h2>
          <TeacherLeaderboard data={data.teacherActivity} />
        </section>
      ) : null}

      {/* Users Section */}
      {showUsers ? (
        <section className="space-y-6">
          <UsersOverview data={data} loading={loading} error={error} />
        </section>
      ) : null}

      {/* Administration Section */}
      {showAdministration && !showUsers ? (
        <section className="space-y-6">
          <AdministrationOverview data={data} loading={loading} />
        </section>
      ) : null}

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

/* ------------------------------------------------------------------ *
 * Academic Overview
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

function AcademicOverview({ sessionId, termId }: { sessionId: string; termId: string }) {
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
          message={
            [
              students.error ? 'the learner register (/api/students)' : null,
              classes.error ? 'the class list (/api/classes)' : null,
              courses.error ? 'the course list (/api/courses)' : null,
            ]
              .filter(Boolean)
              .join(', ') +
            ' refused the request. Each needs its own permission: students.view, cohorts.view and courses.view respectively.'
          }
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
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Users Overview
 * ------------------------------------------------------------------ */

function UsersOverview({
  data,
  loading,
  error,
}: {
  data: AdminDashboardResponse | null | undefined;
  loading: boolean;
  error: unknown;
}) {
  if (loading) return <LoadingState label="Loading account overview" />;

  if (error) {
    return (
      <ErrorState
        title="Could not load the account overview"
        message="GET /api/dashboard/admin requires users.view. Confirm the API is running and that your session still holds the permission."
      />
    );
  }

  const stats = data?.stats ?? [];
  const activity = data?.activity ?? [];
  const recentUsers = data?.recentUsers ?? [];

  const learners = stats.find((s) => s.name.toUpperCase() === 'STUDENT')?._count ?? 0;
  const teachers = stats.find((s) => s.name.toUpperCase() === 'TEACHER')?._count ?? 0;
  const parents = stats.find((s) => s.name.toUpperCase() === 'PARENT')?._count ?? 0;
  const staff =
    (stats.find((s) => s.name.toUpperCase() === 'DEAN')?._count ?? 0) +
    (stats.find((s) => s.name.toUpperCase() === 'ACCOUNTANT')?._count ?? 0) +
    (stats.find((s) => s.name.toUpperCase() === 'SUPER_ADMIN')?._count ?? 0);

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
                  cell: (row) => (row.role ? row.role.toLowerCase() : '-'),
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

/* ------------------------------------------------------------------ *
 * Administration Overview
 * ------------------------------------------------------------------ */

function AdministrationOverview({ data, loading }: { data: AdminDashboardResponse | null | undefined; loading: boolean }) {
  const { can, permissions } = useAuth();

  if (loading) return <LoadingState label="Loading platform administration" />;

  const stats = data?.stats ?? [];

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
                  <StatusPill label={entry.name.toLowerCase()} tone="neutral" />
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
    </div>
  );
}
