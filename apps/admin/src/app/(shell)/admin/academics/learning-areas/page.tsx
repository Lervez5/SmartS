'use client';

import * as React from 'react';
import { useApi } from '@schoolos/hooks';
import { useAuth } from '@schoolos/auth';
import {
  ActionButtons,
  Button,
  ContextFilterBar,
  DashboardCard,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  FloatingFormModal,
  LoadingState,
  SectionHeader,
  Select,
  StatusPill,
  TextInput,
  notify,
  type ContextFilter,
  type DataTableColumn,
  type StatusTone,
} from '@schoolos/ui';

/**
 * Learning Areas - what the school teaches.
 *
 * The workspace is organised around one distinction that decides everything
 * else: where a learning area came from.
 *
 *   Curriculum-defined areas arrive from the authoritative curriculum source
 *   through synchronisation. They are read-only here, because editing them would
 *   silently make the school's copy disagree with the official one. There is no
 *   synchronisation source in this repository, so this section is empty and says
 *   so rather than showing a table that looks like "no data yet".
 *
 *   School-defined areas are the school's own. Their name, code, grades and
 *   lifecycle are the school's to change, which is what the Custom Learning
 *   Areas section is for.
 *
 * A learning area is retired by status, not deleted, wherever it is referenced:
 * assessments, results, teacher allocations and grades point at it by its stable
 * id, and deleting it would take the meaning of those records with it.
 *
 * Grade applicability is always shown as an explicit choice between "all grades"
 * and a named list. An empty grade list therefore never has to be read as two
 * contradictory things at once.
 */

type LearningAreaStatus = 'active' | 'inactive' | 'archived';
type Origin = 'custom' | 'curriculum';
type GradeScope = 'all' | 'selected';

interface Dependency {
  label: string;
  count: number;
}

interface LearningArea {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  status: LearningAreaStatus;
  origin: Origin;
  gradeScope: GradeScope;
  gradeLevels: string[];
  applicableGradeLevels: string[];
  appliesToAllGrades: boolean;
  dependencies: Dependency[];
  hasDependencies: boolean;
  createdAt: string;
  updatedAt: string;
}

interface WorkspaceResponse {
  summary: {
    total: number;
    customCount: number;
    curriculumCount: number;
    activeCount: number;
    inactiveCount: number;
    archivedCount: number;
    appliesToAllGrades: number;
  };
  gradeOptions: string[];
  customAreas: LearningArea[];
  curriculumAreas: LearningArea[];
  grouped: Array<{
    key: string;
    label: string;
    areas: LearningArea[];
  }>;
  curriculumSyncAvailable: boolean;
  curriculumSyncNote: string;
}

const STATUS_LABEL: Record<LearningAreaStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  archived: 'Archived',
};

const STATUS_TONE: Record<LearningAreaStatus, StatusTone> = {
  active: 'success',
  inactive: 'warning',
  archived: 'neutral',
};

function formatDate(value?: string | null): string {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  return body?.error?.message ?? `${fallback} (HTTP ${res.status})`;
}

/** How an area's grade applicability reads on screen. */
function describeGrades(area: LearningArea): string {
  if (area.appliesToAllGrades) return 'All grades';
  if (area.gradeLevels.length === 0) return 'No grades selected';
  if (area.gradeLevels.length === 1) return `Grade ${area.gradeLevels[0]}`;
  return `Grades ${area.gradeLevels.join(', ')}`;
}

interface Draft {
  id: string | null;
  name: string;
  code: string;
  description: string;
  gradeScope: GradeScope;
  gradeLevels: string[];
  status: LearningAreaStatus;
}

function emptyDraft(): Draft {
  return {
    id: null,
    name: '',
    code: '',
    description: '',
    // `all` is the starting point, and it is a choice rather than a default
    // fallback: the form makes the operator pick between it and a named list.
    gradeScope: 'all',
    gradeLevels: [],
    status: 'active',
  };
}

export default function LearningAreasPage() {
  const { can } = useAuth();
  const canView = can('learningAreas.view');
  const canManage = can('learningAreas.manage');

  const [search, setSearch] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [gradeLevel, setGradeLevel] = React.useState('');
  const [includeInactive, setIncludeInactive] = React.useState(false);

  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState<LearningArea | null>(null);
  const [deactivateTarget, setDeactivateTarget] = React.useState<LearningArea | null>(null);

  // Groups collapse as a set, so Expand All and Collapse All have something
  // real to act on rather than being decorative.
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const params = new URLSearchParams();
  if (debounced) params.set('search', debounced);
  if (status) params.set('status', status);
  if (gradeLevel) params.set('gradeLevel', gradeLevel);
  if (includeInactive) params.set('includeInactive', 'true');
  const qs = params.toString();

  const workspace = useApi<WorkspaceResponse>(
    canView ? `/api/learning-areas${qs ? `?${qs}` : ''}` : null
  );

  const data = workspace.data;
  const summary = data?.summary;
  const gradeOptions = data?.gradeOptions ?? [];
  const customAreas = data?.customAreas ?? [];
  const curriculumAreas = data?.curriculumAreas ?? [];

  // Grouping is computed from the areas the API returned for the current
  // filters, so the groups and the statistics agree with what is on screen.
  const groups = React.useMemo(() => {
    const source = customAreas;
    if (!gradeLevel) {
      const byGrade = new Map<string, LearningArea[]>();
      const multi: LearningArea[] = [];
      for (const area of source) {
        if (area.applicableGradeLevels.length > 1) {
          multi.push(area);
          continue;
        }
        const grade = area.applicableGradeLevels[0] ?? 'No grade set';
        byGrade.set(grade, [...(byGrade.get(grade) ?? []), area]);
      }
      const ordered = [
        ...gradeOptions.filter((grade) => byGrade.has(grade)),
        ...[...byGrade.keys()].filter((grade) => !gradeOptions.includes(grade)),
      ].map((grade) => ({
        key: grade,
        label: grade,
        areas: (byGrade.get(grade) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
      }));
      if (multi.length > 0) {
        ordered.push({
          key: '__multi__',
          label: 'Several grades',
          areas: multi.sort((a, b) => a.name.localeCompare(b.name)),
        });
      }
      return ordered;
    }
    // Filtering to one grade collapses the grouping: showing a single open group
    // under a filter the operator already chose adds nothing.
    return [{ key: '__filtered__', label: `Grade ${gradeLevel}`, areas: source }];
  }, [customAreas, gradeOptions, gradeLevel]);

  const filtered = Boolean(debounced) || Boolean(status) || Boolean(gradeLevel) || includeInactive;

  function openCreate() {
    setDraft(emptyDraft());
  }

  function openEdit(area: LearningArea) {
    setDraft({
      id: area.id,
      name: area.name,
      code: area.code ?? '',
      description: area.description ?? '',
      gradeScope: area.gradeScope,
      gradeLevels: area.gradeLevels,
      status: area.status,
    });
  }

  function toggleGroup(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAllGroups() {
    const allKeys = groups.map((group) => group.key);
    const anyOpen = allKeys.some((key) => !collapsed.has(key));
    setCollapsed(anyOpen ? new Set(allKeys) : new Set());
  }

  async function submitDraft() {
    if (!draft) return;
    if (!draft.name.trim()) {
      notify.error('Give the learning area a name.');
      return;
    }
    if (draft.gradeScope === 'selected' && draft.gradeLevels.length === 0) {
      notify.error(
        'Pick the grades this learning area is offered to, or set it to all grades. Leaving both unset is ambiguous.'
      );
      return;
    }

    setBusy(true);
    try {
      const payload = {
        name: draft.name.trim(),
        code: draft.code.trim() || undefined,
        description: draft.description.trim() || undefined,
        gradeScope: draft.gradeScope,
        gradeLevels: draft.gradeScope === 'selected' ? draft.gradeLevels : undefined,
      };

      const res = await fetch(
        draft.id ? `/api/learning-areas/${draft.id}` : '/api/learning-areas',
        {
          method: draft.id ? 'PATCH' : 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        notify.error(
          await errorMessage(
            res,
            draft.id ? 'Could not update the learning area' : 'Could not create the learning area'
          )
        );
        return;
      }

      notify.success(
        draft.id ? `${draft.name} updated.` : `${draft.name} added to your school's learning areas.`
      );
      setDraft(null);
      workspace.refetch();
    } catch {
      notify.error('Could not reach the API. Check that it is running.');
    } finally {
      setBusy(false);
    }
  }

  /** Retire rather than delete, because something still references the area. */
  async function changeStatus(area: LearningArea, next: LearningAreaStatus) {
    setBusy(true);
    try {
      const res = await fetch(`/api/learning-areas/${area.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        notify.error(await errorMessage(res, 'Could not change the status'));
        return;
      }
      notify.success(
        next === 'active'
          ? `${area.name} is active again.`
          : `${area.name} is now ${STATUS_LABEL[next].toLowerCase()}. Existing assessments, results and allocations are unchanged.`
      );
      setDeactivateTarget(null);
      workspace.refetch();
    } catch {
      notify.error('Could not reach the API. Check that it is running.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmDeleteArea() {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/learning-areas/${confirmDelete.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        notify.error(await errorMessage(res, 'Could not delete the learning area'));
        return;
      }
      notify.success(`${confirmDelete.name} deleted.`);
      setConfirmDelete(null);
      workspace.refetch();
    } catch {
      notify.error('Could not reach the API. Check that it is running.');
    } finally {
      setBusy(false);
    }
  }

  const filters: ContextFilter[] = [
    {
      id: 'status',
      label: 'Status',
      value: status,
      allowAll: true,
      allLabel: 'Active only',
      options: (Object.keys(STATUS_LABEL) as LearningAreaStatus[]).map((key) => ({
        value: key,
        label: STATUS_LABEL[key],
      })),
      onChange: setStatus,
    },
    {
      id: 'grade',
      label: 'Grade',
      value: gradeLevel,
      allowAll: true,
      allLabel: 'All grades',
      options: gradeOptions.map((grade) => ({ value: grade, label: `Grade ${grade}` })),
      onChange: setGradeLevel,
    },
  ];

  const areaColumns: Array<DataTableColumn<LearningArea>> = [
    {
      id: 'name',
      header: 'Learning area',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{row.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {row.code ? `Code ${row.code}` : 'No code'} · {describeGrades(row)}
          </p>
        </div>
      ),
      sortValue: (row) => row.name,
    },
    {
      id: 'description',
      header: 'Description',
      cell: (row) => (
        <span className="line-clamp-2 text-xs text-muted-foreground">{row.description ?? '-'}</span>
      ),
      hideBelow: 'lg',
      sortValue: (row) => row.description ?? '',
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => <StatusPill label={STATUS_LABEL[row.status]} tone={STATUS_TONE[row.status]} />,
      hideBelow: 'sm',
      sortValue: (row) => row.status,
    },
    {
      id: 'updated',
      header: 'Updated',
      cell: (row) => (
        <span className="text-xs text-muted-foreground">{formatDate(row.updatedAt)}</span>
      ),
      hideBelow: 'md',
      sortValue: (row) => row.updatedAt,
    },
    {
      id: 'actions',
      header: '',
      align: 'right',
      cell: (row) => (
        <ActionButtons
          items={[
            ...(canManage && row.origin === 'custom'
              ? [
                  {
                    id: 'edit',
                    label: `Edit ${row.name}`,
                    icon: 'pencil',
                    onClick: () => openEdit(row),
                  },
                ]
              : []),
            // Retiring is offered before deleting, and is the only option once
            // anything references the area.
            ...(canManage && row.origin === 'custom' && row.status === 'active'
              ? [
                  {
                    id: 'deactivate',
                    label: `Deactivate ${row.name}`,
                    icon: 'archive',
                    tone: 'danger' as const,
                    onClick: () => setDeactivateTarget(row),
                  },
                ]
              : []),
            ...(canManage && row.origin === 'custom' && row.status !== 'active'
              ? [
                  {
                    id: 'reactivate',
                    label: `Reactivate ${row.name}`,
                    icon: 'check',
                    onClick: () => changeStatus(row, 'active'),
                  },
                ]
              : []),
            ...(canManage && row.origin === 'custom' && !row.hasDependencies
              ? [
                  {
                    id: 'delete',
                    label: `Delete ${row.name}`,
                    icon: 'x',
                    tone: 'danger' as const,
                    onClick: () => setConfirmDelete(row),
                  },
                ]
              : []),
            // Read-only areas explain themselves rather than showing no action.
            ...(row.origin === 'curriculum'
              ? [
                  {
                    id: 'locked',
                    label: 'Curriculum-defined: managed through the curriculum workflow',
                    icon: 'shield-check',
                    onClick: () =>
                      notify.error(
                        'This learning area comes from the curriculum. Change it in the curriculum source and re-synchronize; editing it here would make the two disagree.'
                      ),
                  },
                ]
              : []),
          ]}
        />
      ),
    },
  ];

  if (!canView) {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="Learning Areas"
          description="The learning areas your school teaches, and which of them are its own."
        />
        <ErrorState
          title="You do not have access to learning areas"
          message="Viewing learning areas requires learningAreas.view. Your role does not hold it, and the API refuses the request independently of this screen."
        />
      </div>
    );
  }

  if (workspace.loading) {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="Learning Areas"
          description="The learning areas your school teaches, and which of them are its own."
        />
        <LoadingState label="Loading learning areas" />
      </div>
    );
  }

  if (workspace.error) {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="Learning Areas"
          description="The learning areas your school teaches, and which of them are its own."
        />
        <ErrorState
          title="Could not load learning areas"
          message="GET /api/learning-areas requires learningAreas.view. Confirm the API is running and that your session still holds the permission."
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Learning Areas"
        description="The learning areas your school teaches. Curriculum-defined areas are managed through the curriculum workflow; school-defined areas are yours to change."
        action={canManage ? <Button onClick={openCreate}>New learning area</Button> : null}
      />

      {/* Statistics are derived from what the API returned, and the custom and
          curriculum counts are separate figures so one is never folded into the
          other. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardCard
          title="School-defined"
          value={summary?.customCount ?? 0}
          icon="book-open"
          tone="accent"
          description="Custom learning areas you can edit"
        />
        <DashboardCard
          title="Curriculum-defined"
          value={summary?.curriculumCount ?? 0}
          icon="shield-check"
          description={
            curriculumAreas.length === 0
              ? 'No curriculum source connected'
              : 'Synchronized from the curriculum'
          }
        />
        <DashboardCard
          title="Active"
          value={summary?.activeCount ?? 0}
          icon="check"
          tone="success"
          description={`${summary?.inactiveCount ?? 0} inactive · ${summary?.archivedCount ?? 0} archived`}
        />
        <DashboardCard
          title="Taught in all grades"
          value={summary?.appliesToAllGrades ?? 0}
          icon="layers"
          description={`${(summary?.customCount ?? 0) - (summary?.appliesToAllGrades ?? 0)} restricted to named grades`}
        />
      </div>

      {/* ---------------------------------------------------------------- *
       * Curriculum-defined
       * ---------------------------------------------------------------- */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-base font-semibold text-foreground">
            Curriculum-defined learning areas
          </h2>
          <StatusPill label="Read-only" tone="neutral" />
        </div>

        {curriculumAreas.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/30 p-5">
            <h3 className="text-sm font-semibold text-foreground">
              No curriculum source is connected
            </h3>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              {data?.curriculumSyncNote ??
                'No curriculum synchronisation source is configured, so no curriculum-defined learning areas exist yet.'}
            </p>
            <p className="mt-3 max-w-3xl text-xs text-muted-foreground">
              Nothing here has been filled in to look like curriculum data. When a real source is
              connected, its learning areas will appear here read-only, and grade, strand and
              substrand structure will come from that source rather than from this screen. Until
              then, anything the school teaches is a school-defined learning area below.
            </p>
          </div>
        ) : (
          <DataTable
            caption="Curriculum-defined learning areas"
            columns={areaColumns}
            rows={curriculumAreas}
            rowKey={(row) => row.id}
          />
        )}
      </section>

      {/* ---------------------------------------------------------------- *
       * School-defined
       * ---------------------------------------------------------------- */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-base font-semibold text-foreground">Custom learning areas</h2>
          <StatusPill label="Editable" tone="success" />
          <span className="text-xs text-muted-foreground">
            {customAreas.length} in{' '}
            {gradeOptions.length > 0 ? `${gradeOptions.length} grades` : 'no grades'}
          </span>
        </div>

        <ContextFilterBar
          filters={filters}
          search={{
            value: search,
            onChange: setSearch,
            placeholder: 'Search by name, code or description…',
          }}
          actions={
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              Show inactive
            </label>
          }
        />

        {groups.length > 0 ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs text-muted-foreground">
                {groups.length} group{groups.length === 1 ? '' : 's'} · {customAreas.length} area
                {customAreas.length === 1 ? '' : 's'}
              </p>
              <div className="flex flex-1 justify-end gap-2">
                <Button size="sm" variant="outline" onClick={toggleAllGroups}>
                  {groups.some((group) => !collapsed.has(group.key))
                    ? 'Collapse all'
                    : 'Expand all'}
                </Button>
              </div>
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
                      <span className="text-xs font-medium text-muted-foreground">
                        {group.label}
                      </span>
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
                          columns={areaColumns}
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
          </>
        ) : (
          <EmptyState
            title={
              filtered
                ? 'No learning areas match these filters'
                : 'No school-defined learning areas yet'
            }
            description={
              filtered
                ? 'Adjust the search or filters above.'
                : 'Add the learning areas your school teaches. Anything not synchronized from a curriculum belongs here.'
            }
            icon="book-open"
            action={canManage ? <Button onClick={openCreate}>New learning area</Button> : null}
          />
        )}
      </section>

      {/* ---------------------------------------------------------------- *
       * Create / edit
       * ---------------------------------------------------------------- */}
      <FloatingFormModal
        isOpen={Boolean(draft)}
        onClose={() => setDraft(null)}
        title={draft?.id ? 'Edit learning area' : 'New learning area'}
        description={
          draft?.id
            ? 'Renaming or re-scoping a learning area does not change records already made against it: they reference its stable identity, not its name.'
            : 'A school-defined learning area. Curriculum-defined areas are synchronized and cannot be created here.'
        }
        icon="book-open"
        submitLabel={draft?.id ? 'Save changes' : 'Create learning area'}
        isSubmitting={busy}
        onSubmit={submitDraft}
        size="lg"
      >
        {draft ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Name" required>
                <TextInput
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="e.g. Mathematics"
                />
              </Field>
              <Field label="Code" hint="Optional. Unique within your school.">
                <TextInput
                  value={draft.code}
                  onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. MATH"
                />
              </Field>
            </div>

            <Field label="Description" hint="Optional. Shown wherever the area is listed.">
              <TextInput
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder="What this learning area covers"
              />
            </Field>

            {/* The two grade cases are a choice, not a fallback, so an empty
                grade list can never be read as both. */}
            <Field label="Grade applicability" required>
              <Select
                value={draft.gradeScope}
                onChange={(e) => setDraft({ ...draft, gradeScope: e.target.value as GradeScope })}
              >
                <option value="all">All grades this school teaches</option>
                <option value="selected">Only the grades I pick below</option>
              </Select>
            </Field>

            {draft.gradeScope === 'selected' ? (
              <Field
                label="Grades"
                required
                hint="Pick at least one grade, or switch to all grades."
              >
                {gradeOptions.length === 0 ? (
                  <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
                    Your school has no classes yet, so there are no grades to pick. Create a class
                    first, or set this learning area to all grades.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {gradeOptions.map((grade) => {
                      const checked = draft.gradeLevels.includes(grade);
                      return (
                        <label
                          key={grade}
                          className={
                            checked
                              ? 'flex cursor-pointer items-center gap-2 rounded-full border border-primary bg-primary/10 px-3 py-1.5 text-sm font-medium text-foreground'
                              : 'flex cursor-pointer items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent'
                          }
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setDraft({
                                ...draft,
                                gradeLevels: checked
                                  ? draft.gradeLevels.filter((g) => g !== grade)
                                  : [...draft.gradeLevels, grade],
                              })
                            }
                            className="h-3.5 w-3.5"
                          />
                          {grade}
                        </label>
                      );
                    })}
                  </div>
                )}
              </Field>
            ) : (
              <p className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
                This learning area will be available in every grade your school teaches
                {gradeOptions.length > 0 ? ` (${gradeOptions.join(', ')})` : ''}. No grade list is
                stored, because none is needed.
              </p>
            )}
          </div>
        ) : null}
      </FloatingFormModal>

      {/* ---------------------------------------------------------------- *
       * Deactivate confirmation
       * ---------------------------------------------------------------- */}
      <FloatingFormModal
        isOpen={Boolean(deactivateTarget)}
        onClose={() => setDeactivateTarget(null)}
        title="Deactivate learning area"
        description="Deactivating retires the area from new work without touching anything already recorded against it."
        icon="archive"
        submitLabel="Deactivate"
        isSubmitting={busy}
        onSubmit={() => {
          if (deactivateTarget) void changeStatus(deactivateTarget, 'inactive');
        }}
      >
        {deactivateTarget ? (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">{deactivateTarget.name}</span> will stop
              being offered for new assessments, allocations and results. Everything already
              recorded against it stays readable and keeps its meaning.
            </p>
            {deactivateTarget.dependencies.length > 0 ? (
              <div className="rounded-md bg-amber-50 p-3 text-amber-800">
                <p className="font-medium">Still referenced by:</p>
                <ul className="mt-1 list-disc pl-5 text-xs">
                  {deactivateTarget.dependencies.map((dep) => (
                    <li key={dep.label}>
                      {dep.count} {dep.label}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs">
                  Deleting it instead would remove these references, which is why deactivating is
                  offered here.
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Nothing references this learning area yet.
              </p>
            )}
          </div>
        ) : null}
      </FloatingFormModal>

      {/* ---------------------------------------------------------------- *
       * Delete confirmation
       * ---------------------------------------------------------------- */}
      <FloatingFormModal
        isOpen={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="Delete learning area"
        description="This removes the learning area itself. It is only offered when nothing references it."
        icon="x"
        submitLabel="Delete permanently"
        isSubmitting={busy}
        onSubmit={confirmDeleteArea}
      >
        {confirmDelete ? (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">{confirmDelete.name}</span> will be
              removed from your school's learning areas.
            </p>
            <p className="text-xs text-muted-foreground">
              If you might use this learning area again, deactivate it instead: that keeps the
              record and everything recorded against it.
            </p>
          </div>
        ) : null}
      </FloatingFormModal>
    </div>
  );
}
