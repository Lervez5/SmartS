'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { useApi } from '@schoolos/hooks';
import { useAuth } from '@schoolos/auth';
import {
  DataTable,
  DashboardCard,
  EmptyState,
  ErrorState,
  LoadingState,
  SectionHeader,
  SettingsCard,
  StatusPill,
  type DataTableColumn,
} from '@schoolos/ui';

/**
 * A single summative assessment: its academic context and its results.
 *
 * Reads `GET /api/examinations/:id`, which joins the assessment to the
 * AcademicYear and Term, to the class (which carries the grade) and to the
 * subject (the learning-area analogue the schema carries), and returns the
 * attempts with their scores.
 */
interface Attempt {
  id: string;
  studentId: string | null;
  name: string;
  email: string;
  score: number | null;
  graded: boolean;
  submittedAt?: string | null;
}

interface Detail {
  id: string;
  title: string;
  description?: string | null;
  status: 'draft' | 'published' | 'completed' | 'archived';
  lifecycle: string;
  assessmentType?: string | null;
  startDate: string;
  endDate?: string | null;
  duration?: number | null;
  maxScore?: number | null;
  classId: string | null;
  class?: { id: string; name: string; gradeLevel?: string | null } | null;
  subject?: { id: string; name: string } | null;
  academicYear?: { id: string; name: string; label?: string | null } | null;
  term?: { id: string; name: string; termNumber: number } | null;
  attempts: Attempt[];
  scoredCount: number;
  averagePercent: number | null;
}

const LIFECYCLE_TONE = {
  draft: 'neutral',
  scheduled: 'info',
  open: 'success',
  closed: 'warning',
  completed: 'brand',
  archived: 'neutral',
} as const;

function formatDate(value?: string | null): string {
  if (!value) return '-';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? '-'
    : parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminAssessmentDetailPage() {
  const params = useParams();
  const assessmentId = params?.id as string | undefined;
  const { can } = useAuth();
  const allowed = can('examinations.view');

  const { data, loading, error } = useApi<{ assessment: Detail | null }>(
    allowed ? `/api/examinations/${assessmentId}` : '/api/examinations?denied=1'
  );

  const assessment = data?.assessment ?? null;

  const resultColumns: Array<DataTableColumn<Attempt>> = [
    {
      id: 'learner',
      header: 'Learner',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{row.name}</p>
          <p className="truncate text-xs text-muted-foreground">{row.email}</p>
        </div>
      ),
    },
    {
      id: 'score',
      header: 'Score',
      align: 'right',
      cell: (row) =>
        row.score !== null ? (
          <span className="font-medium text-foreground">
            {row.score}
            {assessment?.maxScore ? (
              <span className="text-muted-foreground"> / {assessment.maxScore}</span>
            ) : null}
          </span>
        ) : (
          <span className="text-muted-foreground">Not scored</span>
        ),
    },
    {
      id: 'state',
      header: 'State',
      cell: (row) =>
        row.graded ? (
          <StatusPill label="graded" tone="success" />
        ) : row.score !== null ? (
          <StatusPill label="entered" tone="warning" />
        ) : (
          <StatusPill label="not scored" tone="neutral" />
        ),
    },
  ];

  if (!allowed) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Assessment" />
        <ErrorState
          title="You do not have access to assessments"
          message="Viewing assessments requires examinations.view. Your role does not hold it, and the API refuses the request independently of this screen."
        />
      </div>
    );
  }

  if (loading) return <LoadingState label="Loading the assessment" />;

  if (error) {
    return (
      <ErrorState
        title="Could not load this assessment"
        message="GET /api/examinations requires examinations.view. Confirm the API is running and that your session still holds the permission."
      />
    );
  }

  if (!assessment) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Assessment" />
        <EmptyState
          title="Assessment not found"
          description="No assessment matches this identifier."
          icon="clipboard-check"
          action={
            <a
              href="/admin/assessment/tests"
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Back to Tests
            </a>
          }
        />
      </div>
    );
  }

  const total = assessment.attempts.length;
  const pending = total - assessment.scoredCount;

  return (
    <div className="space-y-6">
      <SectionHeader
        title={assessment.title}
        description={
          assessment.description ?? 'A summative assessment in the school’s academic context.'
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            {can('grading.manage') ? (
              <a
                href={`/admin/assessment/tests/${assessment.id}/marks`}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Enter Marks
              </a>
            ) : null}
            <a
              href="/admin/reports"
              className="rounded-md border border-input bg-background px-3.5 py-2 text-sm font-semibold transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Reports
            </a>
            <a
              href="/admin/assessment/tests"
              className="rounded-md border border-input bg-background px-3.5 py-2 text-sm font-semibold transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Back to Tests
            </a>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-1.5">
        <StatusPill
          label={assessment.lifecycle}
          tone={LIFECYCLE_TONE[assessment.lifecycle as keyof typeof LIFECYCLE_TONE] ?? 'neutral'}
        />
        {assessment.assessmentType ? (
          <StatusPill label={assessment.assessmentType} tone="neutral" />
        ) : null}
        {assessment.academicYear ? (
          <StatusPill
            label={assessment.academicYear.label ?? assessment.academicYear.name}
            tone="brand"
          />
        ) : null}
        {assessment.term ? (
          <StatusPill label={`Term ${assessment.term.termNumber}`} tone="brand" />
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardCard
          title="Grade / class"
          value={assessment.class?.name ?? 'No class'}
          icon="users-round"
          description={assessment.class?.gradeLevel ?? undefined}
        />
        <DashboardCard
          title="Learning area"
          value={assessment.subject?.name ?? 'Not set'}
          icon="shapes"
          description="Carried as Subject in the schema"
        />
        <DashboardCard
          title="Attempts"
          value={total}
          icon="clipboard-check"
          description={`${assessment.scoredCount} scored`}
        />
        <DashboardCard
          title="Average"
          value={assessment.averagePercent !== null ? `${assessment.averagePercent}%` : '-'}
          icon="trending-up"
          tone={pending > 0 ? 'warning' : 'success'}
          description={pending > 0 ? `${pending} not yet scored` : 'All scored'}
        />
      </div>

      <SettingsCard
        title="Configuration"
        description="The academic context this assessment belongs to, and the dates its lifecycle is derived from."
      >
        <DataTable
          caption="Assessment configuration"
          columns={[
            {
              id: 'f',
              header: 'Field',
              cell: (row: { field: string; value: string }) => row.field,
            },
            {
              id: 'v',
              header: 'Value',
              cell: (row: { field: string; value: string }) => row.value,
            },
          ]}
          rows={[
            {
              field: 'Academic session',
              value:
                assessment.academicYear?.label ??
                assessment.academicYear?.name ??
                'Not in a session',
            },
            {
              field: 'Term',
              value: assessment.term
                ? `Term ${assessment.term.termNumber}${assessment.term.name && assessment.term.name !== `Term ${assessment.term.termNumber}` ? ` · ${assessment.term.name}` : ''}`
                : 'Not in a term',
            },
            {
              field: 'Grade / class',
              value: assessment.class
                ? [assessment.class.name, assessment.class.gradeLevel].filter(Boolean).join(' - ')
                : 'No class',
            },
            { field: 'Assessment type', value: assessment.assessmentType ?? 'Not set' },
            { field: 'Start date', value: formatDate(assessment.startDate) },
            { field: 'End date', value: formatDate(assessment.endDate) },
            {
              field: 'Duration',
              value: assessment.duration ? `${assessment.duration} minutes` : '-',
            },
            {
              field: 'Maximum score',
              value:
                assessment.maxScore !== null && assessment.maxScore !== undefined
                  ? String(assessment.maxScore)
                  : '-',
            },
            { field: 'Lifecycle', value: `${assessment.lifecycle} (stored: ${assessment.status})` },
          ]}
          rowKey={(row) => row.field}
        />
      </SettingsCard>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">Results</h2>
        <DataTable
          caption="Learner results for this assessment"
          columns={resultColumns}
          rows={assessment.attempts}
          rowKey={(row) => row.id}
          empty={
            <EmptyState
              title="No attempts yet"
              description={
                assessment.classId
                  ? 'Attempts are created from the class enrolment on the marks screen.'
                  : 'This assessment has no class, so there is no enrolment to take attempts from.'
              }
              icon="users"
              action={
                can('grading.manage') ? (
                  <a
                    href={`/admin/assessment/tests/${assessment.id}/marks`}
                    className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    Go to marks entry
                  </a>
                ) : null
              }
            />
          }
        />
      </section>
    </div>
  );
}
