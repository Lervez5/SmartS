'use client';

import { useApi } from '@schoolos/hooks';
import {
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
 * `GET /api/attendance/history/me` - no extra permission, and the handler
 * filters on `req.user.id` so a learner can only ever read their own record.
 * A `classId` in the query is optional and is intersected with that scope.
 */
interface AttendanceRecord {
  id: string;
  status: string;
  date: string;
  note?: string | null;
  class?: {
    id: string;
    name: string;
    subject?: { name: string } | null;
  } | null;
}

interface StudentAttendanceResponse {
  records?: AttendanceRecord[];
  stats?: {
    total: number;
    present: number;
    absent: number;
    percentage: number;
  };
}

const TONE: Record<string, StatusTone> = {
  present: 'success',
  late: 'warning',
  absent: 'danger',
  excused: 'neutral',
  sick: 'warning',
  on_leave: 'info',
};

export default function StudentAttendancePage() {
  const { data, loading, error } = useApi<StudentAttendanceResponse>('/api/attendance/history/me');

  const records = data?.records ?? [];
  const stats = data?.stats;

  const columns: Array<DataTableColumn<AttendanceRecord>> = [
    {
      id: 'date',
      header: 'Date',
      cell: (row) =>
        new Date(row.date).toLocaleDateString(undefined, {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
      sortValue: (row) => row.date,
    },
    {
      id: 'class',
      header: 'Class',
      cell: (row) => (
        <span className="font-medium text-foreground">
          {row.class?.name ?? '-'}
          {row.class?.subject?.name ? (
            <span className="ml-1.5 text-xs text-muted-foreground">{row.class.subject.name}</span>
          ) : null}
        </span>
      ),
      hideBelow: 'sm',
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => (
        <StatusPill label={row.status.replace(/_/g, ' ')} tone={TONE[row.status] ?? 'neutral'} />
      ),
    },
    {
      id: 'note',
      header: 'Note',
      hideBelow: 'md',
      cell: (row) => row.note ?? '-',
    },
  ];

  if (loading) return <LoadingState label="Loading your attendance" />;

  if (error) {
    return (
      <ErrorState
        title="Could not load your attendance"
        message="Confirm the API is running and that you are signed in."
      />
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="My Attendance"
        description="Your own attendance record. The API resolves your learner id from the session, so this can only ever contain your data."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <DashboardCard
          title="Attendance rate"
          value={`${stats?.percentage ?? 0}%`}
          icon="calendar-check"
          tone="accent"
          description={`${stats?.present ?? 0} present of ${stats?.total ?? 0} sessions`}
        />
        <DashboardCard title="Present" value={stats?.present ?? 0} icon="check" tone="success" />
        <DashboardCard
          title="Absent"
          value={stats?.absent ?? 0}
          icon="circle-alert"
          tone="danger"
        />
      </div>

      <DataTable
        caption="Attendance record for the signed-in learner"
        columns={columns}
        rows={records}
        rowKey={(row) => row.id}
        pageSize={15}
        empty={
          <EmptyState
            title="No attendance recorded"
            description="Your teacher marks attendance per class. Records appear here once marked."
            icon="calendar-check"
          />
        }
      />
    </div>
  );
}
