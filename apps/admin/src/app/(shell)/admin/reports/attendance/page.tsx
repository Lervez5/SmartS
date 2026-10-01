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
  type DataTableColumn,
  type StatusTone,
} from '@schoolos/ui';

/**
 * `GET /api/reporting/attendance` — gated by `reports.attendance`.
 *
 * A real endpoint: the service aggregates Attendance by status, by class and
 * across the window, and resolves class names before returning.
 */
interface AttendanceReport {
  range: { from: string; to: string };
  byStatus: Array<{ status: string; count: number }>;
  byClass: Array<{ classId: string; name: string; count: number }>;
  rate: number;
  totalRecords: number;
}

const TONE: Record<string, StatusTone> = {
  present: 'success',
  late: 'warning',
  absent: 'danger',
  excused: 'info',
  sick: 'warning',
  on_leave: 'neutral',
};

function date(value?: string): string {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? '—'
    : parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

const RANGES = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '180', label: 'Last 180 days' },
];

export default function AdminAttendanceReportsPage() {
  const { can } = useAuth();
  const allowed = can('reports.attendance');
  const [days, setDays] = React.useState('30');

  const { data, loading, error } = useApi<AttendanceReport>(
    allowed ? `/api/reporting/attendance?days=${days}` : '/api/reporting/attendance?denied=1'
  );

  if (!allowed) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Attendance Reports" />
        <ErrorState
          title="You do not have access to attendance reports"
          message="This report requires reports.attendance. Your role does not hold it, and the API refuses the request independently of this screen."
        />
      </div>
    );
  }

  if (loading) return <LoadingState label="Building the attendance report" />;

  if (error) {
    return (
      <ErrorState
        title="Could not build the attendance report"
        message="GET /api/reporting/attendance requires reports.attendance. Confirm the API is running and that your session still holds the permission."
      />
    );
  }

  const statusTotal = (data?.byStatus ?? []).reduce((sum, row) => sum + row.count, 0);
  const absent = (data?.byStatus ?? []).find((row) => row.status === 'absent')?.count ?? 0;

  const classColumns: Array<
    DataTableColumn<
      (typeof data extends null ? never : NonNullable<typeof data>)['byClass'][number]
    >
  > = [
    { id: 'class', header: 'Class', cell: (row) => row.name },
    {
      id: 'records',
      header: 'Attendance records',
      align: 'right',
      cell: (row) => row.count.toLocaleString(),
      sortValue: (row) => row.count,
    },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Attendance Reports"
        description={`Recorded attendance between ${date(data?.range.from)} and ${date(data?.range.to)}.`}
      />

      <ContextFilterBar
        filters={[
          {
            id: 'days',
            label: 'Period',
            value: days,
            options: RANGES,
            onChange: setDays,
            allowAll: false,
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardCard
          title="Attendance rate"
          value={`${data?.rate ?? 0}%`}
          icon="calendar-check"
          tone="accent"
          description="Present as a share of all records"
        />
        <DashboardCard
          title="Records"
          value={data?.totalRecords ?? 0}
          icon="clipboard-list"
          description={`${statusTotal} counted by status`}
        />
        <DashboardCard
          title="Absences"
          value={absent}
          icon="circle-alert"
          tone={absent > 0 ? 'danger' : 'success'}
          description="Recorded as absent"
        />
        <DashboardCard
          title="Classes reporting"
          value={data?.byClass.length ?? 0}
          icon="users-round"
          description="With attendance in this period"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">By status</h2>
          {(data?.byStatus ?? []).length === 0 ? (
            <EmptyState title="No attendance recorded" icon="calendar-check" />
          ) : (
            <ul className="space-y-2">
              {(data?.byStatus ?? []).map((row) => (
                <li
                  key={row.status}
                  className="flex items-center justify-between rounded-lg border bg-card px-4 py-3"
                >
                  <StatusPill
                    label={row.status.replace(/_/g, ' ')}
                    tone={TONE[row.status] ?? 'neutral'}
                  />
                  <span className="text-sm font-semibold text-foreground">
                    {row.count.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">By class</h2>
          <DataTable
            caption="Attendance records per class for the selected period"
            columns={classColumns}
            rows={data?.byClass ?? []}
            rowKey={(row) => row.classId}
            pageSize={8}
            empty={
              <EmptyState
                title="No class attendance in this period"
                description="Attendance appears once a teacher marks a register."
                icon="users-round"
              />
            }
          />
        </section>
      </div>
    </div>
  );
}
