'use client';

import * as React from 'react';
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
} from '@schoolos/ui';

/**
 * Learning Areas - student portal.
 *
 * The learning areas this learner is actually taught.
 *
 * The catalogue is not repeated here: the school defines it in the admin
 * Learning Areas workspace, and this reads the same records filtered to the
 * grades the learner is placed in. A Grade 1 learner sees Grade 1 areas, not
 * every area the school teaches.
 *
 * Grade applicability comes from the learner's own enrolments rather than from
 * anything typed on this screen, so an area that applies to all grades and an
 * area restricted to named grades are both handled by the same rule.
 */

interface LearningArea {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  status: 'active' | 'inactive' | 'archived';
  origin: 'custom' | 'curriculum';
  gradeScope: 'all' | 'selected';
  gradeLevels: string[];
  applicableGradeLevels: string[];
  appliesToAllGrades: boolean;
}

interface MyAreasResponse {
  gradeLevels: string[];
  message?: string;
  classes: Array<{ id: string; name: string; gradeLevel: string | null }>;
  areas: LearningArea[];
}

const ORIGIN_LABEL: Record<'custom' | 'curriculum', string> = {
  custom: 'School-defined',
  curriculum: 'Curriculum-defined',
};

export default function StudentLearningAreasPage() {
  const mine = useApi<MyAreasResponse>('/api/learning-areas/mine');

  const areas = mine.data?.areas ?? [];
  const gradeLevels = mine.data?.gradeLevels ?? [];
  const classes = mine.data?.classes ?? [];

  // Grouped by grade, because an area restricted to one grade and an area
  // taught in every grade are different facts about the same list.
  const groups = React.useMemo(() => {
    const byGrade = new Map<string, LearningArea[]>();
    const all: LearningArea[] = [];
    for (const area of areas) {
      if (area.appliesToAllGrades) {
        all.push(area);
        continue;
      }
      for (const grade of area.applicableGradeLevels) {
        byGrade.set(grade, [...(byGrade.get(grade) ?? []), area]);
      }
    }

    const result = gradeLevels.map((grade) => ({
      key: grade,
      label: grade,
      areas: (byGrade.get(grade) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
    }));

    if (all.length > 0) {
      result.push({
        key: '__all__',
        label: 'Taught in every grade',
        areas: all.sort((a, b) => a.name.localeCompare(b.name)),
      });
    }

    return result.filter((group) => group.areas.length > 0);
  }, [areas, gradeLevels]);

  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());

  function toggleGroup(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const columns: Array<DataTableColumn<LearningArea>> = [
    {
      id: 'name',
      header: 'Learning area',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{row.name}</p>
          {row.code ? <p className="truncate text-xs text-muted-foreground">{row.code}</p> : null}
        </div>
      ),
      sortValue: (row) => row.name,
    },
    {
      id: 'grades',
      header: 'Grades',
      cell: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.appliesToAllGrades ? 'All grades' : row.applicableGradeLevels.join(', ')}
        </span>
      ),
      hideBelow: 'sm',
      sortValue: (row) => (row.appliesToAllGrades ? '' : row.applicableGradeLevels.join(',')),
    },
    {
      id: 'origin',
      header: 'Source',
      cell: (row) => (
        <StatusPill
          label={ORIGIN_LABEL[row.origin]}
          tone={row.origin === 'curriculum' ? 'info' : 'neutral'}
        />
      ),
      hideBelow: 'md',
      sortValue: (row) => row.origin,
    },
  ];

  if (mine.loading) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Learning Areas" description="The learning areas you are taught." />
        <LoadingState label="Loading your learning areas" />
      </div>
    );
  }

  if (mine.error) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Learning Areas" description="The learning areas you are taught." />
        <ErrorState
          title="Could not load your learning areas"
          message="GET /api/learning-areas/mine requires learningAreas.view. Confirm the API is running and that your session still holds the permission."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Learning Areas"
        description={
          gradeLevels.length > 0
            ? `The learning areas offered in ${gradeLevels.join(', ')}.`
            : 'The learning areas you are taught.'
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <DashboardCard
          title="Learning areas"
          value={areas.length}
          icon="book-open"
          tone="accent"
          description={`Offered in ${gradeLevels.length || 0} grade(s)`}
        />
        <DashboardCard
          title="Your classes"
          value={classes.length}
          icon="users-round"
          description="Classes you are enrolled in"
        />
        <DashboardCard
          title="Taught in every grade"
          value={areas.filter((a) => a.appliesToAllGrades).length}
          icon="layers"
          tone="success"
          description="Not restricted to a grade"
        />
      </div>

      {mine.data?.message ? (
        <EmptyState
          title="No learning areas yet"
          description={mine.data.message}
          icon="book-open"
        />
      ) : areas.length === 0 ? (
        <EmptyState
          title="No learning areas for your grade"
          description="Your school has not published any learning areas for the grades you are in yet. Ask your class teacher or an administrator."
          icon="book-open"
        />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                const keys = groups.map((g) => g.key);
                const anyOpen = keys.some((k) => !collapsed.has(k));
                setCollapsed(anyOpen ? new Set(keys) : new Set());
              }}
              className="rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {groups.some((g) => !collapsed.has(g.key)) ? 'Collapse all' : 'Expand all'}
            </button>
          </div>

          {groups.map((group) => {
            const isCollapsed = collapsed.has(group.key);
            return (
              <div key={group.key} className="rounded-lg border bg-card">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.key)}
                  aria-expanded={!isCollapsed}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                >
                  <span className="text-xs font-medium text-muted-foreground">{group.label}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {group.areas.length}
                  </span>
                  <span className="flex-1" />
                  <span className="text-xs text-muted-foreground">
                    {isCollapsed ? 'Show' : 'Hide'}
                  </span>
                </button>
                {!isCollapsed ? (
                  <div className="border-t">
                    <DataTable
                      caption={`Learning areas for ${group.label}`}
                      columns={columns}
                      rows={group.areas}
                      rowKey={(row) => row.id}
                      pageSize={group.areas.length > 10 ? 10 : 0}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
