'use client';

import * as React from 'react';
import { useApi } from '@schoolos/hooks';
import { useAuth } from '@schoolos/auth';
import {
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  SectionHeader,
  StatusPill,
  type DataTableColumn,
} from '@schoolos/ui';

interface GradeRow {
  id: string;
  assessment: {
    id: string;
    title: string;
    assessmentType: string | null;
    maxScore: number | null;
    className: string | null;
    gradeLevel: string | null;
    termName: string | null;
    sessionName: string | null;
  };
  learningArea: {
    id: string;
    name: string;
    code: string | null;
  };
  score: number | null;
  competencyLevel: string | null;
  racefieldBand: string | null;
  gradedAt: string | null;
}

export function LearnerResultsView({ learnerId }: { learnerId: string }) {
  const { data, loading, error } = useApi<{ results: GradeRow[] }>(
    `/api/grading/results?learnerId=${learnerId}`
  );

  const columns: Array<DataTableColumn<GradeRow>> = [
    {
      id: 'assessment',
      header: 'Assessment',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{row.assessment.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {[row.assessment.assessmentType, row.assessment.className, row.assessment.termName, row.assessment.sessionName]
              .filter(Boolean)
              .join(' · ') || 'No context set'}
          </p>
        </div>
      ),
      sortValue: (row) => row.assessment.title,
    },
    {
      id: 'learningArea',
      header: 'Learning Area',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-foreground">{row.learningArea.name}</p>
          <p className="truncate text-xs text-muted-foreground">{row.learningArea.code ?? ''}</p>
        </div>
      ),
    },
    {
      id: 'score',
      header: 'Score',
      align: 'right',
      cell: (row) => (
        <span className="text-sm font-medium text-foreground">
          {row.score !== null && row.score !== undefined ? `${row.score} / ${row.assessment.maxScore ?? '?'}` : '-'}
        </span>
      ),
      sortValue: (row) => row.score ?? -1,
    },
    {
      id: 'competency',
      header: 'Competency',
      align: 'right',
      cell: (row) => (
        <span className="text-sm text-muted-foreground">{row.competencyLevel ?? '-'}</span>
      ),
    },
    {
      id: 'racefield',
      header: 'Grade',
      align: 'right',
      cell: (row) => (
        <StatusPill label={row.racefieldBand ?? '-'} tone="neutral" />
      ),
    },
  ];

  if (loading) {
    return <LoadingState label="Loading results" />;
  }

  if (error) {
    return (
      <ErrorState
        title="Could not load results"
        message="GET /api/grading/results requires grading.view. Confirm the API is running and that your session still holds the permission."
      />
    );
  }

  const results = data?.results ?? [];

  return (
    <div className="space-y-6">
      <SectionHeader title="My Results" description="Released results for your assessments." />

      {results.length === 0 ? (
        <EmptyState
          title="No results yet"
          description="Results will appear here once they are released."
          icon="clipboard-check"
        />
      ) : (
        <DataTable
          caption="Released results"
          columns={columns}
          rows={results}
          rowKey={(row) => row.id}
          pageSize={20}
        />
      )}
    </div>
  );
}
