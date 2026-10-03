'use client';

import * as React from 'react';
import Link from 'next/link';
import { useApi } from '@schoolos/hooks';
import {
  DashboardCard,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  SectionHeader,
  StatusPill,
  initialsOf,
  type DataTableColumn,
} from '@schoolos/ui';

/**
 * My Children - the linked learners for the signed-in parent.
 *
 * Reads `GET /api/dashboard/parent`, which is gated by `requireRole('PARENT')`
 * and resolves the caller's own ParentProfile server-side. There is no client
 * supplied identifier anywhere on this screen: the API decides which learners a
 * parent may see, so this can never reach another family.
 *
 * Children with no attendance are reported as such rather than shown as a
 * misleading zero.
 */
interface Child {
  id: string;
  name?: string | null;
  gradeLevel?: string | null;
  email?: string | null;
  user?: { id: string; name?: string | null; email?: string | null } | null;
}

interface ParentDashboard {
  children?: Child[];
  attendanceSummary?: Array<{ status: string; _count: number }>;
  upcomingClasses?: Array<{
    id: string;
    name?: string | null;
    schedule?: string | null;
    subject?: { id: string; name: string } | null;
  }>;
  recentGrades?: Array<{
    id: string;
    value?: number | null;
    gradedAt?: string | null;
    subject?: { id: string; name: string } | null;
    childName?: string | null;
  }>;
}

const ATTENDANCE_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  present: 'success',
  late: 'warning',
  absent: 'danger',
  excused: 'neutral',
  sick: 'warning',
  on_leave: 'neutral',
};

function formatDate(value?: string | null): string {
  if (!value) return '-';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? '-'
    : parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function nameOf(child: Child): string {
  return child.name ?? child.user?.name ?? child.email ?? 'Learner';
}

export default function ParentChildrenPage() {
  const { data, loading, error } = useApi<ParentDashboard>('/api/dashboard/parent');

  const children = React.useMemo(() => data?.children ?? [], [data]);
  const attendance = data?.attendanceSummary ?? [];
  const grades = data?.recentGrades ?? [];

  const present = attendance.find((a) => a.status === 'present')?._count ?? 0;
  const marked = attendance.reduce((sum, a) => sum + a._count, 0);

  const columns: Array<DataTableColumn<Child>> = [
    {
      id: 'learner',
      header: 'Learner',
      cell: (row) => {
        const name = nameOf(row);
        return (
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              {initialsOf(name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {row.user?.email ?? row.email ?? '-'}
              </p>
            </div>
          </div>
        );
      },
      sortValue: (row) => nameOf(row),
    },
    {
      id: 'class',
      header: 'Class',
      cell: (row) =>
        row.gradeLevel ? (
          <span className="text-sm text-foreground">{row.gradeLevel}</span>
        ) : (
          <span className="text-muted-foreground">Not placed</span>
        ),
      sortValue: (row) => row.gradeLevel ?? '',
    },
    {
      id: 'results',
      header: 'Latest results',
      cell: (row) => {
        const own = grades.filter((g) => g.childName === nameOf(row));
        if (own.length === 0) {
          return <span className="text-sm text-muted-foreground">None recorded</span>;
        }
        return (
          <div className="min-w-0">
            <p className="truncate text-sm text-foreground">{own[0].subject?.name ?? 'Result'}</p>
            <p className="truncate text-xs text-muted-foreground">{formatDate(own[0].gradedAt)}</p>
          </div>
        );
      },
    },
  ];

  if (loading) return <LoadingState label="Loading your children" />;

  if (error) {
    return (
      <div className="space-y-6">
        <SectionHeader title="My Children" />
        <ErrorState
          title="Could not load your children"
          message="The parent dashboard is available to parent accounts. Confirm you are signed in with a parent account and that the API is running."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="My Children"
        description="The learners linked to your account, with their class and recent results. Only children linked to you are shown."
      />

      {children.length === 0 ? (
        <EmptyState
          title="No children linked yet"
          description="A school administrator links your account to your children. Once they are linked they will appear here, and you will only ever see your own."
          icon="graduation-cap"
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <DashboardCard
              title="Children linked"
              value={children.length}
              icon="graduation-cap"
              tone="accent"
            />
            <DashboardCard
              title="Attendance"
              value={marked > 0 ? `${Math.round((present / marked) * 100)}%` : '-'}
              icon="calendar-check"
              description={
                marked > 0 ? `${present} present of ${marked} marked` : 'Nothing marked yet'
              }
            />
            <DashboardCard
              title="Results recorded"
              value={grades.length}
              icon="file-bar-chart"
              description="Across your children"
            />
          </div>

          <DataTable
            caption="Learners linked to your account"
            columns={columns}
            rows={children}
            rowKey={(row) => row.id}
            empty={
              <EmptyState
                title="No children linked"
                description="Ask the school office to link your account."
                icon="graduation-cap"
              />
            }
          />

          {attendance.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">
                Attendance across your children
              </h2>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {attendance.map((entry) => (
                  <li
                    key={entry.status}
                    className="flex items-center justify-between rounded-lg border bg-card px-3 py-2"
                  >
                    <StatusPill
                      label={entry.status.replace(/_/g, ' ')}
                      tone={ATTENDANCE_TONE[entry.status] ?? 'neutral'}
                    />
                    <span className="text-sm font-semibold text-foreground">{entry._count}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <p className="text-sm text-muted-foreground">
              No attendance has been recorded for your children yet.
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            <Link href="/dashboard" className="font-medium text-primary hover:underline">
              Back to dashboard
            </Link>
            . This list is resolved from your own account on the server; there is no identifier a
            page could change to reach another family.
          </p>
        </>
      )}
    </div>
  );
}
