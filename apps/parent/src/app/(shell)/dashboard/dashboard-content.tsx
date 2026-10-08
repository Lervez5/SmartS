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
  type DataTableColumn,
} from '@schoolos/ui';

/**
 * Shape of `GET /api/dashboard/parent`.
 *
 * Every collection is derived from `ParentChildLink`, so a parent only ever
 * sees learners linked to their own `ParentProfile`. The API resolves the
 * parent from the session rather than from a request parameter.
 */
interface ParentDashboardData {
  children?: Array<{
    id: string;
    name: string;
    email: string;
    gradeLevel?: string | null;
  }>;
  attendanceSummary?: Array<{ status: string; _count: number }>;
  upcomingClasses?: Array<{
    id: string;
    name: string;
    schedule?: string | null;
    subject?: { id: string; name: string } | null;
    teacher?: { id: string; name: string } | null;
  }>;
  recentGrades?: Array<{
    id: string;
    studentId?: string | null;
    value: number;
    scale?: string | null;
    gradedAt: string;
    subject?: { id: string; name: string } | null;
    childName?: string | null;
  }>;
  invoices?: Array<{
    id: string;
    studentId?: string | null;
    number: string;
    amountCents: number;
    status?: string | null;
    issuedAt: string;
    dueDate?: string | null;
  }>;
}

function formatDate(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatMoney(cents?: number | null): string {
  const units = (cents ?? 0) / 100;
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'KES',
    maximumFractionDigits: 0,
  }).format(units);
}

const ATTENDANCE_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  present: 'success',
  late: 'warning',
  excused: 'neutral',
  sick: 'neutral',
  absent: 'danger',
  on_leave: 'neutral',
};

export function ParentDashboard() {
  const { user } = useAuth();
  const { data, loading, error } = useApi<ParentDashboardData>('/api/dashboard/parent');

  const children = data?.children ?? [];
  const attendance = data?.attendanceSummary ?? [];
  const upcoming = data?.upcomingClasses ?? [];
  const grades = data?.recentGrades ?? [];
  const invoices = data?.invoices ?? [];

  const present = attendance.find((a) => a.status === 'present')?._count ?? 0;
  const marked = attendance.reduce((sum, a) => sum + a._count, 0);
  const attendanceRate = marked > 0 ? Math.round((present / marked) * 100) : null;

  const outstanding = invoices
    .filter((invoice) => invoice.status !== 'paid')
    .reduce((sum, invoice) => sum + (invoice.amountCents ?? 0), 0);

  const gradeColumns: Array<
    DataTableColumn<NonNullable<ParentDashboardData['recentGrades']>[number]>
  > = [
    { id: 'child', header: 'Child', cell: (row) => row.childName ?? '-' },
    {
      id: 'subject',
      header: 'Learning Area',
      cell: (row) => row.subject?.name ?? '-',
    },
    {
      id: 'value',
      header: 'Score',
      align: 'right',
      cell: (row) => <StatusPill label={String(row.value)} tone="brand" />,
    },
    {
      id: 'date',
      header: 'Date',
      align: 'right',
      hideBelow: 'sm',
      cell: (row) => formatDate(row.gradedAt),
    },
  ];

  if (loading) return <LoadingState label="Loading your family dashboard" />;

  if (error) {
    return (
      <ErrorState
        title="Could not load your dashboard"
        message="The API did not return your family data. Check that the API is running and try again."
      />
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title={`Welcome, ${user?.name ?? user?.firstName ?? 'parent'}`}
        description="Your children's attendance, results, classes and fees in one place."
      />

      {children.length === 0 ? (
        <EmptyState
          title="No children linked yet"
          description="A school administrator links your profile to your children. Once linked, their attendance, results and fees appear here."
          icon="graduation-cap"
        />
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardCard
          title="Children"
          value={children.length}
          icon="graduation-cap"
          tone="accent"
          href="/dashboard/children"
        />
        <DashboardCard
          title="Attendance"
          value={attendanceRate !== null ? `${attendanceRate}%` : '-'}
          icon="calendar-check"
          tone={attendanceRate !== null && attendanceRate < 80 ? 'danger' : 'default'}
          description={marked > 0 ? `${present} present of ${marked} marked` : 'No marks recorded'}
          href="/dashboard/attendance"
        />
        <DashboardCard
          title="Upcoming classes"
          value={upcoming.length}
          icon="calendar-days"
          href="/dashboard/timetable"
        />
        <DashboardCard
          title="Outstanding fees"
          value={formatMoney(outstanding)}
          icon="receipt"
          tone={outstanding > 0 ? 'warning' : 'default'}
          description={invoices.length > 0 ? `${invoices.length} invoices on record` : undefined}
          href="/dashboard/finance/invoices"
        />
      </div>

      {children.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">My children</h2>
          <DataTable
            caption="Learners linked to the signed-in parent"
            columns={[
              {
                id: 'name',
                header: 'Name',
                cell: (row) => <span className="font-medium text-foreground">{row.name}</span>,
              },
              {
                id: 'email',
                header: 'Email',
                cell: (row) => row.email,
                hideBelow: 'sm',
              },
              {
                id: 'grade',
                header: 'Class',
                cell: (row) =>
                  row.gradeLevel ?? <span className="text-muted-foreground">Not placed</span>,
                align: 'right',
              },
            ]}
            rows={children}
            rowKey={(row) => row.id}
            empty={<EmptyState title="No children linked" icon="graduation-cap" />}
          />
        </section>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">Recent results</h2>
          {grades.length === 0 ? (
            <EmptyState
              title="No results yet"
              description="Results appear here once teachers record them."
              icon="file-bar-chart"
            />
          ) : (
            <DataTable
              caption="Recent results across linked children"
              columns={gradeColumns}
              rows={grades}
              rowKey={(row) => row.id}
              pageSize={6}
              empty={<EmptyState title="No results yet" icon="file-bar-chart" />}
            />
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">Attendance</h2>
          {attendance.length === 0 ? (
            <EmptyState
              title="No attendance recorded"
              description="Attendance for your children appears here once it has been marked."
              icon="calendar-check"
            />
          ) : (
            <ul className="space-y-2">
              {attendance.map((entry) => (
                <li
                  key={entry.status}
                  className="flex items-center justify-between rounded-lg border bg-card px-4 py-3"
                >
                  <StatusPill
                    label={entry.status.replace(/_/g, ' ')}
                    tone={ATTENDANCE_TONE[entry.status] ?? 'neutral'}
                  />
                  <span className="text-sm font-semibold text-foreground">{entry._count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">Fees and invoices</h2>
        {invoices.length === 0 ? (
          <GapState
            concept="Parent fee statements"
            detail="GET /api/finance/invoices is not parent-scoped. It returns every invoice the caller can read with no child filter, so wiring it into the parent portal would expose other families' billing. A parent-scoped route has to be implemented first."
          />
        ) : (
          <DataTable
            caption="Recent invoices for linked children"
            columns={[
              {
                id: 'number',
                header: 'Invoice',
                cell: (row) => <span className="font-medium text-foreground">{row.number}</span>,
              },
              {
                id: 'status',
                header: 'Status',
                cell: (row) => (
                  <StatusPill
                    label={row.status ?? 'unknown'}
                    tone={
                      row.status === 'paid'
                        ? 'success'
                        : row.status === 'void'
                          ? 'danger'
                          : 'warning'
                    }
                  />
                ),
              },
              {
                id: 'amount',
                header: 'Amount',
                align: 'right',
                cell: (row) => formatMoney(row.amountCents),
              },
              {
                id: 'due',
                header: 'Due',
                align: 'right',
                hideBelow: 'sm',
                cell: (row) => formatDate(row.dueDate),
              },
            ]}
            rows={invoices}
            rowKey={(row) => row.id}
            pageSize={6}
            empty={<EmptyState title="No invoices" icon="receipt" />}
          />
        )}
      </section>
    </div>
  );
}
