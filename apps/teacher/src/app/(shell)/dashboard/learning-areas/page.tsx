'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { useApi } from '@schoolos/hooks';
import { notify } from '@schoolos/ui';
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

interface Stream {
  id: string;
  name: string;
  code: string;
  isClassLevel: boolean;
  class: { id: string; name: string; gradeLevel: string | null };
}

interface TeachingRow {
  area: LearningArea;
  responsibility: string;
  canEnterResults: boolean;
  canManage: boolean;
  stream: Stream;
  academicYear: { id: string; name: string } | null;
}

interface TeachingResponse {
  teaching: TeachingRow[];
  areaCount: number;
  streamCount: number;
}

const ORIGIN_LABEL: Record<'custom' | 'curriculum', string> = {
  custom: 'School-defined',
  curriculum: 'Curriculum-defined',
};

const ORIGIN_TONE: Record<'custom' | 'curriculum', StatusTone> = {
  custom: 'neutral',
  curriculum: 'info',
};

const RESPONSIBILITY_LABEL: Record<string, string> = {
  main_class_teacher: 'Class teacher',
  assistant_class_teacher: 'Assistant class teacher',
  subject_teacher: 'Subject teacher',
};

const RESPONSIBILITY_TONE: Record<string, StatusTone> = {
  main_class_teacher: 'info',
  assistant_class_teacher: 'neutral',
  subject_teacher: 'neutral',
};

function describeGrades(area: LearningArea): string {
  if (area.appliesToAllGrades) return 'All grades';
  if (area.gradeLevels.length === 0) return 'No grades selected';
  if (area.gradeLevels.length === 1) return `Grade ${area.gradeLevels[0]}`;
  if (area.gradeLevels.length <= 3) return `Grades ${area.gradeLevels.join(', ')}`;
  return `Grades ${area.gradeLevels.slice(0, 3).join(', ')} +${area.gradeLevels.length - 3}`;
}

function streamLabel(stream: Stream): string {
  if (stream.isClassLevel) return 'Whole class';
  return `${stream.name} (${stream.code})`;
}

export default function TeacherLearningAreasPage() {
  const data = useApi<TeachingResponse>('/api/learning-areas/teaching');

  const rows = data.data?.teaching ?? [];
  const areaCount = data.data?.areaCount ?? 0;
  const streamCount = data.data?.streamCount ?? 0;
  const curriculumCount = rows.filter((r) => r.area.origin === 'curriculum').length;

  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());

  const groups = React.useMemo(() => {
    const grouped = new Map<string, TeachingRow[]>();
    for (const row of rows) {
      const cls = row.stream.class;
      const key = cls.id;
      grouped.set(key, [...(grouped.get(key) ?? []), row]);
    }
    return [...grouped.entries()]
      .map(([classId, items]) => ({
        key: classId,
        label: items[0].stream.class.name,
        sublabel: items[0].stream.class.gradeLevel ?? undefined,
        items: items.sort((a, b) => a.area.name.localeCompare(b.area.name)),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);

  function toggleGroup(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAll() {
    const keys = groups.map((g) => g.key);
    const anyOpen = keys.some((k) => !collapsed.has(k));
    setCollapsed(anyOpen ? new Set(keys) : new Set());
  }

  const groupedColumns: Array<DataTableColumn<TeachingRow>> = [
    {
      id: 'area',
      header: 'Learning area',
      cell: (row) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={
                row.area.origin === 'curriculum'
                  ? 'text-xs text-blue-600'
                  : 'text-xs text-amber-600'
              }
            >
            </span>
            <p className="truncate text-sm font-medium text-foreground">{row.area.name}</p>
          </div>
          <p className="ml-6 truncate text-xs text-muted-foreground">{describeGrades(row.area)}</p>
        </div>
      ),
      sortValue: (row) => row.area.name,
    },
    {
      id: 'stream',
      header: 'Stream',
      cell: (row) => (
        <span className="text-sm text-foreground">{streamLabel(row.stream)}</span>
      ),
      hideBelow: 'sm',
      sortValue: (row) => streamLabel(row.stream),
    },
    {
      id: 'responsibility',
      header: 'Responsibility',
      cell: (row) => (
        <StatusPill
          label={RESPONSIBILITY_LABEL[row.responsibility] ?? row.responsibility}
          tone={RESPONSIBILITY_TONE[row.responsibility] ?? 'neutral'}
        />
      ),
      hideBelow: 'md',
      sortValue: (row) => row.responsibility,
    },
    {
      id: 'results',
      header: 'Results entry',
      cell: (row) =>
        row.canEnterResults ? (
          <StatusPill label="Permitted" tone="success" />
        ) : (
          <span className="text-xs text-muted-foreground">Not permitted</span>
        ),
      hideBelow: 'lg',
    },
    {
      id: 'source',
      header: 'Source',
      cell: (row) => (
        <StatusPill
          label={ORIGIN_LABEL[row.area.origin]}
          tone={ORIGIN_TONE[row.area.origin]}
        />
      ),
      hideBelow: 'lg',
    },
    {
      id: 'actions',
      header: '',
      align: 'right',
      cell: (row) => (
        <button
          type="button"
          onClick={() =>
            notify.info(
              row.area.description ?? `${row.area.name} has no description recorded.`
            )
          }
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          View details
        </button>
      ),
    },
  ];

  if (data.loading) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Learning Areas" description="The learning areas you teach." />
        <LoadingState label="Loading your learning areas" />
      </div>
    );
  }

  if (data.error) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Learning Areas" description="The learning areas you teach." />
        <ErrorState
          title="Could not load your learning areas"
          message="GET /api/learning-areas/teaching requires learningAreas.view. Confirm the API is running and that your session still holds the permission."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Learning Areas"
        description="The learning areas you are responsible for, taken from your teaching allocations."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <DashboardCard
          title="Learning areas"
          value={areaCount}
          icon="book-open"
          tone="accent"
          description="Distinct areas you teach"
        />
        <DashboardCard
          title="Streams"
          value={streamCount}
          icon="users-round"
          description="Classes and streams you cover"
        />
        <DashboardCard
          title="Curriculum-defined"
          value={curriculumCount}
          icon="shield-check"
          description="Synchronized from the curriculum"
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No learning areas assigned"
          description="You have no active allocation that names a learning area. Allocations are made in the teacher allocation workspace; contact an academic administrator if this looks wrong."
          icon="book-open"
        />
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {groups.length} {groups.length === 1 ? 'class' : 'classes'} · {rows.length} allocation{rows.length === 1 ? '' : 's'}
            </p>
            <button
              type="button"
              onClick={toggleAll}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {groups.some((g) => !collapsed.has(g.key)) ? 'Collapse all' : 'Expand all'}
            </button>
          </div>

          {groups.map((group) => {
            const isCollapsed = collapsed.has(group.key);
            return (
              <div key={group.key} className="rounded-lg border bg-card shadow-sm">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.key)}
                  aria-expanded={!isCollapsed}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                >
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{group.label}</span>
                      {group.sublabel && (
                        <>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground">{group.sublabel}</span>
                        </>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {group.items.length} {group.items.length === 1 ? 'area' : 'areas'}
                    </span>
                  </div>
                  <span className="rounded-full bg-muted/50 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {group.items.length}
                  </span>
                  <ChevronDown
                    className={
                      isCollapsed ? 'ml-auto h-4 w-4 rotate-0' : 'ml-auto h-4 w-4 rotate-180'
                    }
                  />
                </button>
                {!isCollapsed ? (
                  <div className="border-t bg-muted/20">
                    <DataTable
                      caption={`Learning areas for ${group.label}`}
                      columns={groupedColumns}
                      rows={group.items}
                      rowKey={(row) => `${row.area.id}:${row.stream.id}`}
                      pageSize={group.items.length > 10 ? 10 : 0}
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
