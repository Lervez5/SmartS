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
 * Shape of `GET /api/dashboard/teacher`.
 *
 * Scoped by the API to the signed-in teacher: `classesTaught` filters on
 * `Class.teacherId`, and `pendingGrading` only covers submissions for those
 * classes. A teacher cannot widen this by changing a request parameter.
 */
interface TeacherDashboardData {
  classesTaught?: Array<{
    id: string;
    name: string;
    gradeLevel?: string | null;
    schedule?: string | null;
    subject?: { id: string; name: string } | null;
    _count?: { enrollments?: number } | null;
  }>;
  pendingGrading?: Array<{
    id: string;
    createdAt: string;
    student?: { id: string; name: string; email: string } | null;
    assignment?: { id: string; title: string } | null;
  }>;
  recentSubmissions?: Array<{
    id: string;
    score?: number | null;
    status?: string | null;
    createdAt: string;
    student?: { id: string; name: string } | null;
    assignment?: { id: string; title: string } | null;
  }>;
  attendanceSummary?: Array<{ status: string; _count: number }>;
}

function formatDateTime(value?: string | null): string {
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

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const ATTENDANCE_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  present: 'success',
  late: 'warning',
  excused: 'neutral',
  sick: 'neutral',
  absent: 'danger',
  on_leave: 'neutral',
};

export function TeacherDashboard() {
  const { user } = useAuth();
  const { data, loading, error } = useApi<TeacherDashboardData>('/api/dashboard/teacher');

  const classes = data?.classesTaught ?? [];
  const pending = data?.pendingGrading ?? [];
  const submissions = data?.recentSubmissions ?? [];
  const attendance = data?.attendanceSummary ?? [];

  const totalLearners = classes.reduce((sum, c) => sum + (c._count?.enrollments ?? 0), 0);
  const present = attendance.find((a) => a.status === 'present')?._count ?? 0;
  const marked = attendance.reduce((sum, a) => sum + a._count, 0);
  const attendanceRate = marked > 0 ? Math.round((present / marked) * 100) : null;

  const classColumns: Array<
    DataTableColumn<NonNullable<TeacherDashboardData['classesTaught']>[number]>
  > = [
    {
      id: 'class',
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
      sortValue: (row) => row.subject?.name ?? '',
    },
    {
      id: 'learners',
      header: 'Learners',
      align: 'right',
      cell: (row) => row._count?.enrollments ?? 0,
      sortValue: (row) => row._count?.enrollments ?? 0,
    },
    {
      id: 'schedule',
      header: 'Next session',
      align: 'right',
      hideBelow: 'lg',
      cell: (row) => formatDateTime(row.schedule),
      sortValue: (row) => row.schedule ?? '',
    },
  ];

  if (loading) return <LoadingState label="Loading your teaching dashboard" />;

  if (error) {
    return (
      <ErrorState
        title="Could not load your dashboard"
        message="The API did not return your teaching data. Check that the API is running and try again."
      />
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title={`${greeting()}, ${user?.name ?? user?.firstName ?? 'teacher'}`}
        description="Your classes, marking queue, submissions and attendance over the last seven days."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardCard
          title="Classes taught"
          value={classes.length}
          icon="users-round"
          tone="accent"
          description={totalLearners > 0 ? `${totalLearners} learners enrolled` : undefined}
          href="/dashboard/classes"
        />
        <DashboardCard
          title="Pending grading"
          value={pending.length}
          icon="pen-line"
          tone={pending.length > 0 ? 'warning' : 'default'}
          description={pending.length > 0 ? 'Submissions waiting on you' : 'Nothing in the queue'}
          href="/dashboard/grading"
        />
        <DashboardCard
          title="Attendance (7 days)"
          value={attendanceRate !== null ? `${attendanceRate}%` : '-'}
          icon="calendar-check"
          tone={attendanceRate !== null && attendanceRate < 80 ? 'danger' : 'default'}
          description={marked > 0 ? `${present} present of ${marked} marked` : 'No marks recorded'}
          href="/dashboard/attendance/class"
        />
        <DashboardCard
          title="Recent submissions"
          value={submissions.length}
          icon="clipboard-list"
          href="/dashboard/assignments"
        />
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">My classes</h2>
          <Link
            href="/dashboard/classes"
            className="text-sm font-medium text-primary hover:underline"
          >
            All classes
          </Link>
        </div>
        <DataTable
          caption="Classes assigned to the signed-in teacher"
          columns={classColumns}
          rows={classes}
          rowKey={(row) => row.id}
          pageSize={5}
          empty={
            <EmptyState
              title="No classes assigned"
              description="You are not the assigned teacher on any class yet. A DEAN or SUPER_ADMIN assigns class ownership from the admin portal."
              icon="users-round"
            />
          }
        />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Marking queue</h2>
            <Link
              href="/dashboard/grading"
              className="text-sm font-medium text-primary hover:underline"
            >
              Grade
            </Link>
          </div>
          {pending.length === 0 ? (
            <EmptyState
              title="Nothing to grade"
              description="Every submission for your classes has been graded."
              icon="clipboard-check"
            />
          ) : (
            <DataTable
              caption="Submissions awaiting grading"
              columns={[
                {
                  id: 'student',
                  header: 'Learner',
                  cell: (row) => row.student?.name ?? '-',
                },
                {
                  id: 'assignment',
                  header: 'Assignment',
                  hideBelow: 'sm',
                  cell: (row) => row.assignment?.title ?? '-',
                },
                {
                  id: 'submitted',
                  header: 'Submitted',
                  align: 'right',
                  hideBelow: 'md',
                  cell: (row) => formatDateTime(row.createdAt),
                },
              ]}
              rows={pending}
              rowKey={(row) => row.id}
              pageSize={6}
              empty={<EmptyState title="Nothing to grade" icon="clipboard-check" />}
            />
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">Attendance breakdown</h2>
          {attendance.length === 0 ? (
            <EmptyState
              title="No attendance recorded"
              description="Attendance marked in the last seven days appears here."
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
        <h2 className="text-base font-semibold text-foreground">Assessment workspace</h2>
        <GapState
          concept="CBC assessment and grading"
          detail="GET /api/assessment and GET /api/grading are both stubs. The Assignment model exists and is surfaced through the dashboard service, but there is no Assessment, Rubric or Competency model, and no route to create or grade against one. Assessments are currently reachable only as /api/examinations."
        />
      </section>
    </div>
  );
}
