'use client';

import * as React from 'react';
import { useApi } from '@schoolos/hooks';
import { useAuth } from '@schoolos/auth';
import {
  ActionButtons,
  ContextFilterBar,
  DashboardCard,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  PrimaryActionButton,
  SectionHeader,
  StatusPill,
  type DataTableColumn,
  type StatusTone,
} from '@schoolos/ui';

/**
 * Summative Tests — the assessment directory.
 *
 * Reads `GET /api/examinations`, which returns examinations joined to the
 * authoritative academic context: the AcademicYear and Term the navbar selects,
 * the class (which carries the grade) and the subject (the learning-area
 * analogue the schema carries today).
 *
 * Filter options come from `GET /api/examinations/options`, which derives them
 * from the records that exist rather than from a hardcoded list.
 */
interface AssessmentRow {
  id: string;
  title: string;
  description?: string | null;
  status: 'draft' | 'published' | 'completed' | 'archived';
  lifecycle: 'draft' | 'scheduled' | 'open' | 'closed' | 'completed' | 'archived';
  assessmentType?: string | null;
  startDate: string;
  endDate?: string | null;
  maxScore?: number | null;
  attemptCount: number;
  class?: { id: string; name: string; gradeLevel?: string | null } | null;
  subject?: { id: string; name: string } | null;
  academicYear?: { id: string; name: string; label?: string | null } | null;
  term?: { id: string; name: string; termNumber: number } | null;
}

interface ListResponse {
  examinations?: AssessmentRow[];
}

interface OptionsResponse {
  assessmentTypes?: Array<{ value: string; label: string }>;
  grades?: Array<{ value: string; label: string; classId: string }>;
  terms?: Array<{ value: string; label: string }>;
}

const LIFECYCLE_TONE: Record<string, StatusTone> = {
  draft: 'neutral',
  scheduled: 'info',
  open: 'success',
  closed: 'warning',
  completed: 'brand',
  archived: 'neutral',
};

const LIFECYCLE_LABEL: Record<string, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  open: 'Open',
  closed: 'Closed',
  completed: 'Completed',
  archived: 'Archived',
};

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? '—'
    : parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminTestsPage() {
  const { can } = useAuth();
  const allowed = can('examinations.view');

  const [query, setQuery] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [termId, setTermId] = React.useState('');
  const [type, setType] = React.useState('');
  const [classId, setClassId] = React.useState('');
  const [status, setStatus] = React.useState('');

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  // Resolved by the API, so the directory stays authoritative.
  const params = new URLSearchParams({ sort: 'date_desc' });
  if (debounced) params.set('search', debounced);
  if (termId) params.set('termId', termId);
  if (type) params.set('assessmentType', type);
  if (classId) params.set('classId', classId);
  if (status) params.set('status', status);
  params.set('limit', '200');

  const { data, loading, error } = useApi<ListResponse>(
    allowed ? `/api/examinations?${params.toString()}` : '/api/examinations?denied=1'
  );

  const options = useApi<OptionsResponse>(
    allowed ? '/api/examinations/options' : '/api/examinations/options?denied=1'
  );

  const assessments = React.useMemo(() => data?.examinations ?? [], [data]);

  const total = assessments.length;
  const open = assessments.filter((a) => a.lifecycle === 'open').length;
  const drafts = assessments.filter((a) => a.status === 'draft').length;
  const awaitingMarks = assessments.filter(
    (a) => a.attemptCount > 0 && a.lifecycle !== 'completed' && a.status !== 'draft'
  ).length;

  const columns: Array<DataTableColumn<AssessmentRow>> = [
    {
      id: 'assessment',
      header: 'Assessment',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{row.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {/* Subject is the learning-area analogue the schema carries. */}
            {[
              row.subject?.name,
              row.assessmentType,
              row.academicYear?.label ?? row.academicYear?.name,
            ]
              .filter(Boolean)
              .join(' · ') || 'No learning area or type set'}
          </p>
        </div>
      ),
      sortValue: (row) => row.title,
    },
    {
      id: 'grade',
      header: 'Grade',
      cell: (row) =>
        row.class ? (
          <div className="min-w-0">
            <p className="truncate text-sm text-foreground">{row.class.name}</p>
            {row.class.gradeLevel ? (
              <p className="truncate text-xs text-muted-foreground">{row.class.gradeLevel}</p>
            ) : null}
          </div>
        ) : (
          <span className="text-muted-foreground">No class</span>
        ),
      sortValue: (row) => row.class?.gradeLevel ?? row.class?.name ?? '',
    },
    {
      id: 'term',
      header: 'Term',
      cell: (row) =>
        row.term ? (
          <span className="text-sm text-foreground">
            Term {row.term.termNumber}
            {row.term.name && row.term.name !== `Term ${row.term.termNumber}` ? (
              <span className="block text-xs text-muted-foreground">{row.term.name}</span>
            ) : null}
          </span>
        ) : (
          <span className="text-muted-foreground">Not in a term</span>
        ),
    },
    {
      id: 'type',
      header: 'Type',
      cell: (row) =>
        row.assessmentType ? (
          <StatusPill label={row.assessmentType} tone="neutral" />
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: 'date',
      header: 'Date',
      align: 'right',
      cell: (row) => (
        <div className="min-w-0">
          <p className="text-sm text-foreground">{formatDate(row.startDate)}</p>
          {row.endDate ? (
            <p className="text-xs text-muted-foreground">to {formatDate(row.endDate)}</p>
          ) : null}
        </div>
      ),
      sortValue: (row) => row.startDate,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => (
        <StatusPill
          label={LIFECYCLE_LABEL[row.lifecycle] ?? row.lifecycle}
          tone={LIFECYCLE_TONE[row.lifecycle] ?? 'neutral'}
        />
      ),
      sortValue: (row) => row.lifecycle,
    },
  ];

  if (!allowed) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Tests" />
        <ErrorState
          title="You do not have access to assessments"
          message="Viewing summative assessments requires examinations.view. Your role does not hold it, and the API refuses the request independently of this screen."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Tests"
        description={`Summative assessments across the school's academic sessions and terms. ${total === 1 ? '1 assessment' : `${total} assessments`} within your authorized scope.`}
        action={
          can('examinations.manage') ? (
            <PrimaryActionButton
              href="/admin/assessment/tests/new"
              label="New Assessment"
              icon="plus"
              title="Creates a summative assessment via POST /api/examinations."
            />
          ) : null
        }
      />

      {loading ? (
        <LoadingState label="Loading assessments" />
      ) : error ? (
        <ErrorState
          title="Could not load assessments"
          message="GET /api/examinations requires examinations.view. Confirm the API is running and that your session still holds the permission."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <DashboardCard
              title="Assessments"
              value={total}
              icon="clipboard-check"
              tone="accent"
              description={
                debounced || termId || type || classId || status
                  ? 'Matching the current filters'
                  : 'Everything in your scope'
              }
            />
            <DashboardCard
              title="Open now"
              value={open}
              icon="check"
              tone={open > 0 ? 'success' : 'default'}
              description="Started and not yet closed"
            />
            <DashboardCard
              title="Awaiting marks"
              value={awaitingMarks}
              icon="pen-line"
              tone={awaitingMarks > 0 ? 'warning' : 'success'}
              description="Attempts seeded, marks not final"
            />
            <DashboardCard
              title="Drafts"
              value={drafts}
              icon="file-text"
              description="Not yet published to learners"
            />
          </div>

          <DataTable
            caption="Summative assessments with their academic context"
            columns={columns}
            rows={assessments}
            rowKey={(row) => row.id}
            pageSize={15}
            onRowClick={(row) => {
              window.location.href = `/admin/assessment/tests/${row.id}`;
            }}
            renderRowActions={(row) => (
              <ActionButtons
                items={[
                  {
                    id: 'view',
                    label: `View ${row.title}`,
                    href: `/admin/assessment/tests/${row.id}`,
                    icon: 'eye',
                  },
                  // Marks entry is gated on grading.manage, not examinations.view,
                  // because recording results is a stronger capability than
                  // seeing that an assessment exists.
                  ...(can('grading.manage')
                    ? [
                        {
                          id: 'marks',
                          label: `Marks for ${row.title}`,
                          href: `/admin/assessment/tests/${row.id}/marks`,
                          icon: 'pen-line',
                        },
                      ]
                    : []),
                  {
                    id: 'reports',
                    label: `Reports for ${row.title}`,
                    href: '/admin/reports',
                    icon: 'file-bar-chart',
                  },
                ]}
              />
            )}
            toolbar={
              <ContextFilterBar
                search={{
                  value: query,
                  onChange: setQuery,
                  placeholder: 'Search by assessment name or type…',
                }}
                filters={[
                  {
                    id: 'term',
                    label: 'Term',
                    value: termId,
                    options: options.data?.terms ?? [],
                    onChange: setTermId,
                    allLabel: 'All terms',
                  },
                  {
                    id: 'type',
                    label: 'Assessment Type',
                    value: type,
                    options: options.data?.assessmentTypes ?? [],
                    onChange: setType,
                    allLabel: 'All types',
                  },
                  {
                    id: 'grade',
                    label: 'Grade',
                    value: classId,
                    options: options.data?.grades ?? [],
                    onChange: setClassId,
                    allLabel: 'All grades',
                  },
                  {
                    id: 'status',
                    label: 'Status',
                    value: status,
                    options: [
                      { value: 'draft', label: 'Draft' },
                      { value: 'published', label: 'Published' },
                      { value: 'completed', label: 'Completed' },
                      { value: 'archived', label: 'Archived' },
                    ],
                    onChange: setStatus,
                    allLabel: 'All statuses',
                  },
                ]}
              />
            }
            empty={
              <EmptyState
                title={
                  total === 0 && !debounced && !termId && !type && !classId && !status
                    ? 'No assessments yet'
                    : 'No assessments match these filters'
                }
                description={
                  total === 0 && !debounced && !termId && !type && !classId && !status
                    ? 'Create a summative assessment to begin. Term, type and grade are drawn from the academic context already configured.'
                    : 'Adjust the search or filters above.'
                }
                icon="clipboard-check"
              />
            }
          />

          <p className="text-xs text-muted-foreground">
            Status is derived from the stored lifecycle and the configured dates: a draft stays a
            draft, and a published assessment is scheduled before it opens, open while it is
            running, and closed once its end date passes. Term and grade filters list only what the
            school actually uses.
          </p>
        </>
      )}
    </div>
  );
}
