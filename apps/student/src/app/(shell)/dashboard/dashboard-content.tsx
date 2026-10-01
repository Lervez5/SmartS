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
  type StatusTone,
} from '@schoolos/ui';

/**
 * Shape of `GET /api/dashboard/student`.
 *
 * Every field is produced by services/api/src/modules/dashboard/service.ts and
 * scoped to the authenticated learner - the API resolves the student id from
 * the session, it is never supplied by the client.
 */
interface StudentDashboardData {
  upcomingClasses?: Array<{
    id: string;
    schedule?: string;
    name: string;
    subject?: { id: string; name: string } | null;
    teacher?: { id: string; name: string } | null;
  }>;
  pendingAssignments?: Array<{ id: string; title: string; dueDate: string }>;
  recentGrades?: Array<{
    id: string;
    rawScore?: number | null;
    createdAt: string;
    exercise?: { lesson?: { title: string; id: string } | null } | null;
  }>;
  notifications?: Array<{
    id: string;
    title: string;
    body?: string;
    createdAt: string;
  }>;
  progress?: Array<{
    id: string;
    percent: number;
    subject?: { id: string; name: string } | null;
  }>;
}

function formatDate(value?: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(value?: string): string {
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

export function StudentDashboard() {
  const { user } = useAuth();
  const { data, loading, error } = useApi<StudentDashboardData>('/api/dashboard/student');

  const upcoming = data?.upcomingClasses ?? [];
  const pending = data?.pendingAssignments ?? [];
  const grades = data?.recentGrades ?? [];
  const notifications = data?.notifications ?? [];
  const progress = data?.progress ?? [];

  const averageProgress =
    progress.length > 0
      ? Math.round(progress.reduce((sum, item) => sum + (item.percent ?? 0), 0) / progress.length)
      : null;

  const nextDue = pending
    .map((item) => new Date(item.dueDate).getTime())
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => a - b)[0];

  const classColumns: Array<
    DataTableColumn<NonNullable<StudentDashboardData['upcomingClasses']>[number]>
  > = [
    {
      id: 'subject',
      header: 'Learning Area',
      cell: (row) => row.subject?.name ?? row.name,
      sortValue: (row) => row.subject?.name ?? row.name,
    },
    {
      id: 'teacher',
      header: 'Teacher',
      cell: (row) => row.teacher?.name ?? '-',
      hideBelow: 'md',
      sortValue: (row) => row.teacher?.name ?? '',
    },
    {
      id: 'class',
      header: 'Class',
      cell: (row) => <span className="text-muted-foreground">{row.name}</span>,
      hideBelow: 'lg',
    },
    {
      id: 'schedule',
      header: 'Next session',
      cell: (row) => formatDateTime(row.schedule),
      align: 'right',
      sortValue: (row) => row.schedule ?? '',
    },
  ];

  if (loading) return <LoadingState label="Loading your dashboard" />;

  if (error) {
    return (
      <ErrorState
        title="Could not load your dashboard"
        message="The API did not return your dashboard data. Check that the API is running and try again."
      />
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title={`${greeting()}, ${user?.name ?? user?.firstName ?? 'learner'}`}
        description="Your courses, assignments, attendance and progress at a glance."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardCard
          title="Courses in progress"
          value={progress.length}
          icon="book-open"
          tone="accent"
          description={
            averageProgress !== null ? `${averageProgress}% average completion` : undefined
          }
          href="/dashboard/student/courses"
        />
        <DashboardCard
          title="Pending assignments"
          value={pending.length}
          icon="clipboard-list"
          tone={pending.length > 0 ? 'warning' : 'default'}
          meta={
            nextDue && !Number.isNaN(nextDue)
              ? `Next due ${new Date(nextDue).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`
              : undefined
          }
          href="/dashboard/assignments"
        />
        <DashboardCard
          title="Upcoming classes"
          value={upcoming.length}
          icon="calendar-days"
          description={
            upcoming[0]
              ? `Next: ${upcoming[0].subject?.name ?? upcoming[0].name}`
              : 'Nothing scheduled'
          }
          href="/dashboard/timetable"
        />
        <DashboardCard
          title="Unread notifications"
          value={notifications.length}
          icon="megaphone"
          tone={notifications.length > 0 ? 'warning' : 'default'}
          href="/dashboard/announcements"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="space-y-3 xl:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Upcoming classes</h2>
            <Link
              href="/dashboard/timetable"
              className="text-sm font-medium text-primary hover:underline"
            >
              Timetable
            </Link>
          </div>
          <DataTable
            caption="Upcoming classes for the signed-in learner"
            columns={classColumns}
            rows={upcoming}
            rowKey={(row) => row.id}
            pageSize={5}
            empty={
              <EmptyState
                title="No classes scheduled"
                description="Your timetable has not been published yet. It will appear here once your teacher schedules it."
                icon="calendar-days"
              />
            }
          />
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">Due soon</h2>
          {pending.length === 0 ? (
            <EmptyState
              title="Nothing due"
              description="You have no pending assignments."
              icon="clipboard-check"
            />
          ) : (
            <ul className="space-y-2">
              {pending.slice(0, 5).map((item) => (
                <li key={item.id} className="rounded-lg border bg-card p-3">
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Due {formatDate(item.dueDate)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">Learning progress</h2>
          {progress.length === 0 ? (
            <GapState
              concept="Learning progress"
              detail="The API reports course enrollment progress, but no CBC learner-progress report exists yet. There is no Progress model or GET /api/progress route."
            />
          ) : (
            <ul className="space-y-3">
              {progress.map((item) => (
                <li key={item.id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">
                      {item.subject?.name ?? 'Course'}
                    </span>
                    <span className="text-muted-foreground">{item.percent ?? 0}%</span>
                  </div>
                  <div
                    className="h-2 w-full overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-valuenow={item.percent ?? 0}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${item.subject?.name ?? 'Course'} progress`}
                  >
                    <div
                      className="h-full rounded-full bg-primary transition-[width]"
                      style={{
                        width: `${Math.min(100, Math.max(0, item.percent ?? 0))}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">Recent results</h2>
          {grades.length === 0 ? (
            <EmptyState
              title="No results yet"
              description="Results appear here once your teacher records a score."
              icon="file-bar-chart"
            />
          ) : (
            <DataTable
              caption="Recent graded results"
              columns={[
                {
                  id: 'title',
                  header: 'Activity',
                  cell: (row) => row.exercise?.lesson?.title ?? 'Graded activity',
                },
                {
                  id: 'score',
                  header: 'Score',
                  align: 'right',
                  cell: (row) => <StatusPill label={String(row.rawScore ?? '-')} tone="brand" />,
                },
                {
                  id: 'date',
                  header: 'Date',
                  align: 'right',
                  hideBelow: 'sm',
                  cell: (row) => formatDate(row.createdAt),
                },
              ]}
              rows={grades}
              rowKey={(row) => row.id}
              empty={<EmptyState title="No results yet" icon="file-bar-chart" />}
            />
          )}
        </section>
      </div>
    </div>
  );
}

/** Maps a raw status string onto a consistent pill tone. */
export function statusToneFor(status?: string): StatusTone {
  switch ((status ?? '').toLowerCase()) {
    case 'active':
    case 'paid':
    case 'present':
    case 'published':
    case 'enrolled':
      return 'success';
    case 'pending':
    case 'draft':
    case 'late':
      return 'warning';
    case 'absent':
    case 'suspended':
    case 'overdue':
    case 'void':
      return 'danger';
    default:
      return 'neutral';
  }
}
