'use client';

import * as React from 'react';
import { useApi } from '@schoolos/hooks';
import { ActionButtons, notify } from '@schoolos/ui';
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

/**
 * Learning Areas - teacher portal.
 *
 * The learning areas this teacher is responsible for.
 *
 * The list comes from the teacher's own stream allocations, which is the record
 * that says who teaches what to whom - not from the whole school catalogue, and
 * not from a list of every area an administrator happens to have created. A
 * teacher who teaches one area across three streams sees one area against three
 * streams, because that is the shape of the work.
 *
 * Reaching the allocation itself is a link into the teacher allocation
 * workspace, where responsibility is actually changed. Editing a learning area
 * here would be editing something the school owns, not the teacher.
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

interface TeachingRow {
  area: LearningArea;
  responsibility: string;
  canEnterResults: boolean;
  canManage: boolean;
  stream: {
    id: string;
    name: string;
    code: string;
    class: { id: string; name: string; gradeLevel: string | null };
  };
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
  return `Grades ${area.gradeLevels.join(', ')}`;
}

export default function TeacherLearningAreasPage() {
  const data = useApi<TeachingResponse>('/api/learning-areas/teaching');

  const rows = data.data?.teaching ?? [];
  const areaCount = data.data?.areaCount ?? 0;
  const streamCount = data.data?.streamCount ?? 0;

  /**
   * A teacher who teaches five areas across nine streams has nine rows but five
   * areas. The card reads the distinct-area count, and the table shows every
   * allocation, so neither number hides the other.
   */
  const byArea = React.useMemo(() => {
    const map = new Map<
      string,
      { area: LearningArea; streamCount: number; canEnterResults: boolean }
    >();
    for (const row of rows) {
      const existing = map.get(row.area.id);
      map.set(row.area.id, {
        area: row.area,
        streamCount: (existing?.streamCount ?? 0) + 1,
        canEnterResults: existing?.canEnterResults || row.canEnterResults,
      });
    }
    return [...map.values()].sort((a, b) => a.area.name.localeCompare(b.area.name));
  }, [rows]);

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
        label:
          items[0].stream.class.name +
          (items[0].stream.class.gradeLevel ? ` · ${items[0].stream.class.gradeLevel}` : ''),
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

  const rowColumns: Array<DataTableColumn<TeachingRow>> = [
    {
      id: 'area',
      header: 'Learning area',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{row.area.name}</p>
          <p className="truncate text-xs text-muted-foreground">{describeGrades(row.area)}</p>
        </div>
      ),
      sortValue: (row) => row.area.name,
    },
    {
      id: 'stream',
      header: 'Stream',
      cell: (row) => (
        <span className="text-sm text-foreground">
          {row.stream.name} <span className="text-muted-foreground">({row.stream.code})</span>
        </span>
      ),
      hideBelow: 'sm',
      sortValue: (row) => row.stream.name,
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
      id: 'origin',
      header: 'Source',
      cell: (row) => (
        <StatusPill
          label={ORIGIN_LABEL[row.area.origin]}
          tone={row.area.origin === 'curriculum' ? 'info' : 'neutral'}
        />
      ),
      hideBelow: 'lg',
    },
    {
      id: 'actions',
      header: '',
      align: 'right',
      cell: (row) => (
        <ActionButtons
          items={[
            {
              id: 'view',
              label: `What ${row.area.name} covers`,
              icon: 'book-open',
              onClick: () =>
                notify.info(
                  row.area.description ??
                    `${row.area.name} has no description recorded. Ask an administrator to add one.`
                ),
            },
          ]}
        />
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
          value={rows.filter((r) => r.area.origin === 'curriculum').length}
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
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {byArea.map(({ area, streamCount: streams, canEnterResults }) => (
              <div key={area.id} className="rounded-lg border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{area.name}</p>
                    <p className="text-xs text-muted-foreground">{describeGrades(area)}</p>
                  </div>
                  <StatusPill
                    label={ORIGIN_LABEL[area.origin]}
                    tone={area.origin === 'curriculum' ? 'info' : 'neutral'}
                  />
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Streams</dt>
                    <dd className="font-medium text-foreground">{streams}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Results entry</dt>
                    <dd className="font-medium text-foreground">
                      {canEnterResults ? 'Permitted' : 'Not permitted'}
                    </dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>

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

          <div className="space-y-3">
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
                      {group.items.length}
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
                        columns={rowColumns}
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
        </>
      )}
    </div>
  );
}
