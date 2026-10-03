'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useApi } from '@schoolos/hooks';
import { useAuth } from '@schoolos/auth';
import {
  DashboardCard,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  PrimaryActionButton,
  SectionHeader,
  StatusPill,
  useAcademicSession,
  type DataTableColumn,
} from '@schoolos/ui';

/**
 * Summative Overview - assessment coverage and result-entry progress.
 *
 * Reads `GET /api/reporting/summative`, which computes every figure from the
 * real examination, attempt and grade collections. The academic context is taken
 * from the same session the navbar has selected, so the metrics and the band
 * distribution can never be built from two different sessions.
 *
 * The band distribution counts the CBC competency levels actually recorded on
 * grades - EE, ME, AE and BE - against the school's own `CompetencyBand`
 * boundaries. Where the school has configured no bands the section says so
 * instead of drawing empty bars, which would read as "no results yet".
 */
interface Band {
  level: string;
  label: string;
  range: string | null;
  description: string | null;
  count: number;
  percent: number | null;
}

interface Summary {
  context: { academicYearId: string | null; termId: string | null; gradeLevel: string | null };
  metrics: {
    assessments: number;
    resultsEntered: number;
    resultsPending: number;
    awaitingResults: number;
    schoolAverage: number | null;
    gradesCovered: number;
  };
  gradeLevels: string[];
  grading: {
    bandsConfigured: boolean;
    scale: string | null;
    gradedResults: number;
    distribution: Band[];
  };
  recent: Array<{
    id: string;
    title: string;
    assessmentType?: string | null;
    status: string;
    startDate: string;
    maxScore?: number | null;
    gradeLevel?: string | null;
    className?: string | null;
    subjectName?: string | null;
    termName?: string | null;
    sessionName?: string | null;
    attempts: number;
  }>;
}

const STATUS_TONE = {
  draft: 'neutral',
  published: 'info',
  completed: 'success',
  archived: 'neutral',
} as const;

/**
 * Band colours follow the strength of the level, from the strongest. Derived
 * from the platform's primary so the chart belongs to the same palette as the
 * rest of the portal rather than importing an unrelated chart theme.
 */
const BAND_COLOUR: Record<string, string> = {
  EE: 'hsl(142 76% 36%)',
  ME: 'hsl(199 89% 48%)',
  AE: 'hsl(38 92% 50%)',
  BE: 'hsl(0 84% 60%)',
};

function formatDate(value?: string | null): string {
  if (!value) return '-';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? '-'
    : parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminSummativeOverviewPage() {
  const { can } = useAuth();
  const allowed = can('examinations.view');
  const academic = useAcademicSession();

  // Scoped to the session the navbar has selected, so the metrics and the
  // distribution cannot be built from two different sessions.
  const params = new URLSearchParams();
  if (academic.sessionId) params.set('academicYearId', academic.sessionId);
  const qs = params.toString();

  const { data, loading, error } = useApi<Summary>(
    allowed ? `/api/reporting/summative${qs ? `?${qs}` : ''}` : '/api/reporting/summative?denied=1'
  );

  const metrics = data?.metrics;
  const grading = data?.grading;
  const distribution = grading?.distribution ?? [];
  const hasResults = (grading?.gradedResults ?? 0) > 0;

  const recentColumns: Array<DataTableColumn<NonNullable<Summary['recent']>[number]>> = [
    {
      id: 'assessment',
      header: 'Assessment',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{row.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {[row.assessmentType, row.subjectName, row.sessionName, row.termName]
              .filter(Boolean)
              .join(' · ') || 'No type, learning area or term set'}
          </p>
        </div>
      ),
      sortValue: (row) => row.title,
    },
    {
      id: 'grade',
      header: 'Grade / Level',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-foreground">{row.className ?? 'No class'}</p>
          <p className="truncate text-xs text-muted-foreground">{row.gradeLevel ?? 'Unplaced'}</p>
        </div>
      ),
    },
    {
      id: 'date',
      header: 'Date',
      align: 'right',
      cell: (row) => formatDate(row.startDate),
      hideBelow: 'sm',
      sortValue: (row) => row.startDate,
    },
    {
      id: 'status',
      header: 'Status',
      align: 'right',
      cell: (row) => (
        <StatusPill
          label={row.status}
          tone={STATUS_TONE[row.status as keyof typeof STATUS_TONE] ?? 'neutral'}
        />
      ),
      sortValue: (row) => row.status,
    },
  ];

  if (!allowed) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Summative Overview" />
        <ErrorState
          title="You do not have access to assessment reporting"
          message="This overview requires examinations.view. Your role does not hold it, and the API refuses the request independently of this screen."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Summative Overview"
        description="Monitor assessment coverage, result entry progress, and CBC grade distribution."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {/* Both actions route to real workflows. Enter Marks needs a
                grading capability, not merely visibility of an assessment. */}
            {can('grading.manage') ? (
              <PrimaryActionButton
                href="/admin/assessment/tests"
                label="Enter Marks"
                icon="pen-line"
                variant="outline"
                title="Open the assessment directory to record learner results."
              />
            ) : null}
            {can('examinations.manage') ? (
              <PrimaryActionButton
                href="/admin/assessment/tests/new"
                label="New Assessment"
                icon="plus"
                title="Creates a summative assessment via POST /api/examinations."
              />
            ) : null}
          </div>
        }
      />

      {loading ? (
        <LoadingState label="Building the summative overview" />
      ) : error ? (
        <ErrorState
          title="Could not build the summative overview"
          message="GET /api/reporting/summative requires examinations.view. Confirm the API is running and that your session still holds the permission."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <DashboardCard
              title="Assessments"
              value={metrics?.assessments ?? 0}
              icon="clipboard-check"
              tone="accent"
              description="Summative assessments in the selected session and term"
            />
            <DashboardCard
              title="Results Entered"
              value={metrics?.resultsEntered ?? 0}
              icon="check"
              tone="success"
              description={
                (metrics?.resultsPending ?? 0) > 0
                  ? `${metrics?.resultsPending} attempts still have no score`
                  : 'Every attempt has a score'
              }
            />
            <DashboardCard
              title="School Average"
              value={
                metrics?.schoolAverage !== null && metrics?.schoolAverage !== undefined
                  ? `${metrics.schoolAverage}%`
                  : '-'
              }
              icon="trending-up"
              description={
                metrics?.schoolAverage === null || metrics?.schoolAverage === undefined
                  ? 'No comparable scores recorded yet'
                  : 'Mean across comparable scores'
              }
            />
            <DashboardCard
              title="Grades Covered"
              value={metrics?.gradesCovered ?? 0}
              icon="layers"
              description={
                (data?.gradeLevels ?? []).length > 0
                  ? data?.gradeLevels.join(', ')
                  : 'No grade levels assessed yet'
              }
            />
          </div>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-foreground">Grade Band Distribution</h2>
              {grading?.bandsConfigured ? (
                <span className="text-xs text-muted-foreground">
                  CBC competency levels · {grading.gradedResults} graded result
                  {grading.gradedResults === 1 ? '' : 's'}
                </span>
              ) : null}
            </div>

            {!grading?.bandsConfigured ? (
              <EmptyState
                title="No CBC competency bands configured"
                description="The distribution is derived from the school’s own competency bands. Configure them under Administration → School Configuration → Academic, then record results to populate it."
                icon="bar-chart-3"
              />
            ) : !hasResults ? (
              <EmptyState
                title="No graded results yet"
                description="Bands are configured. Once marks are recorded, learners are counted against them here."
                icon="bar-chart-3"
              />
            ) : (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <div className="h-64 rounded-lg border bg-card p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={distribution} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
                      <XAxis
                        type="number"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <YAxis
                        type="category"
                        dataKey="level"
                        width={44}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 12, fontWeight: 700, fill: 'hsl(var(--foreground))' }}
                      />
                      <Tooltip
                        cursor={{ fill: 'hsl(var(--muted))' }}
                        contentStyle={{
                          borderRadius: 8,
                          border: '1px solid hsl(var(--border))',
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={36}>
                        {distribution.map((band) => (
                          <Cell
                            key={band.level}
                            fill={BAND_COLOUR[band.level] ?? 'hsl(var(--primary))'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* The same values as text, so the figure never depends on
                    reading a chart. */}
                <ul className="space-y-2">
                  {distribution.map((band) => (
                    <li key={band.level} className="rounded-lg border bg-card p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2">
                          <span
                            aria-hidden
                            className="h-2.5 w-2.5 rounded-full"
                            style={{
                              backgroundColor: BAND_COLOUR[band.level] ?? 'hsl(var(--primary))',
                            }}
                          />
                          <span className="text-sm font-semibold text-foreground">
                            {band.level}
                          </span>
                          <span className="text-xs text-muted-foreground">{band.label}</span>
                        </span>
                        <span className="text-sm font-semibold text-foreground">
                          {band.count}
                          {band.percent !== null ? (
                            <span className="ml-1 text-xs font-normal text-muted-foreground">
                              ({band.percent}%)
                            </span>
                          ) : null}
                        </span>
                      </div>
                      {band.range ? (
                        <p className="mt-1 text-xs text-muted-foreground">{band.range}</p>
                      ) : null}
                      {band.description ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">{band.description}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-foreground">Recent Assessments</h2>
              <Link
                href="/admin/assessment/tests"
                className="text-sm font-medium text-primary hover:underline"
              >
                View all
              </Link>
            </div>

            {data && data.recent.length > 0 ? (
              <DataTable
                caption="Most recent summative assessments in the selected context"
                columns={recentColumns}
                rows={data.recent}
                rowKey={(row) => row.id}
                onRowClick={(row) => {
                  window.location.href = `/admin/assessment/tests/${row.id}`;
                }}
              />
            ) : (
              <EmptyState
                title="No assessments in this context"
                description={
                  academic.sessionId
                    ? 'Create an assessment in the selected session, or pick a different session from the navbar.'
                    : 'No academic session is active, so there is no context to assess against. Set one under Administration → Academic Sessions.'
                }
                icon="clipboard-check"
                action={
                  can('examinations.manage') ? (
                    <a
                      href="/admin/assessment/tests/new"
                      className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                      New Assessment
                    </a>
                  ) : null
                }
              />
            )}
          </section>

          <p className="text-xs text-muted-foreground">
            {metrics?.awaitingResults ?? 0} assessment
            {(metrics?.awaitingResults ?? 0) === 1 ? '' : 's'} have attempts but no results yet. The
            school average counts only scores that can be compared, which excludes attempts on
            assessments with no maximum set - a bare score means something different on a 10-point
            paper than on a 100-point one.
          </p>
        </>
      )}
    </div>
  );
}
