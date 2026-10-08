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
  learnerName: string;
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

export function ParentResultsView() {
  const { user } = useAuth();
  const [childIds, setChildIds] = React.useState<string[]>([]);
  const [loadingChildren, setLoadingChildren] = React.useState(true);
  const [childrenError, setChildrenError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!user?.id) return;
    setLoadingChildren(true);
    setChildrenError(null);
    fetch('/api/parent/children', { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ children: Array<{ id: string }> }>;
      })
      .then((body) => setChildIds(body.children.map((c) => c.id)))
      .catch((err) => setChildrenError(err.message))
      .finally(() => setLoadingChildren(false));
  }, [user?.id]);

  const childParam = childIds.join(',');
  const { data, loading, error, refetch } = useApi<{ results: GradeRow[] }>(
    childParam ? `/api/grading/results?learnerIds=${childParam}` : null
  );

  const columns: Array<DataTableColumn<GradeRow>> = [
    {
      id: 'learner',
      header: 'Learner',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{row.learnerName}</p>
        </div>
      ),
      sortValue: (row) => row.learnerName,
    },
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

  if (loadingChildren) {
    return <LoadingState label="Loading children" />;
  }

  if (childrenError) {
    return (
      <ErrorState
        title="Could not load children"
        message={`GET /api/parent/children failed: ${childrenError}`}
      />
    );
  }

  if (childIds.length === 0) {
    return (
      <div className="space-y-6">
        <SectionHeader title="My Children's Results" />
        <EmptyState
          title="No children linked"
          description="Link children to your account to view their results."
          icon="users"
        />
      </div>
    );
  }

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
      <SectionHeader title="My Children's Results" description="Released results for your linked children." />

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
