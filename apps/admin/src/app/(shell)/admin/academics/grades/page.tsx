'use client';

import * as React from 'react';
import { useApi } from '@schoolos/hooks';
import { useAuth } from '@schoolos/auth';
import {
  ActionButtons,
  Button,
  ContextFilterBar,
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

interface GradeLevel {
  id: string;
  designationCode: string;
  name: string;
  academicLevel: number;
  description: string | null;
  status: 'active' | 'inactive';
  origin: 'custom' | 'curriculum';
  classCount: number;
  createdAt: string;
  updatedAt: string;
}

interface GradeResponse {
  grades: GradeLevel[];
  count: number;
}

const STATUS_TONE: Record<GradeLevel['status'], StatusTone> = {
  active: 'success',
  inactive: 'warning',
};

const ORIGIN_LABEL: Record<GradeLevel['origin'], string> = {
  custom: 'Custom',
  curriculum: 'Curriculum',
};

async function fetchError(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  return body?.error?.message ?? `${fallback} (HTTP ${res.status}).`;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function describeStatus(status: string): string {
  return status === 'active' ? 'Active' : 'Inactive';
}

export default function GradesPage() {
  const { can } = useAuth();
  const canView = can('grades.view');
  const canManage = can('grades.manage');

  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [draft, setDraft] = React.useState<GradeLevel | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const params = new URLSearchParams();
  if (debounced) params.set('search', debounced);
  if (statusFilter) params.set('status', statusFilter);
  const qs = params.toString();

  const grades = useApi<GradeResponse>(canView ? `/api/grades${qs ? `?${qs}` : ''}` : null);

  async function submitDraft() {
    if (!draft) return;
    if (!draft.name.trim()) {
      notify.error('Give the grade a name.');
      return;
    }
    if (!draft.designationCode.trim()) {
      notify.error('A designation code is required.');
      return;
    }

    setBusy(true);
    try {
      const payload = {
        name: draft.name.trim(),
        designationCode: draft.designationCode.trim(),
        academicLevel: draft.academicLevel,
        description: draft.description?.trim() || undefined,
        status: draft.status,
      };

      const isEdit = Boolean(draft.id);
      const res = await fetch(isEdit ? `/api/grades/${draft.id}` : '/api/grades', {
        method: isEdit ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        notify.error(
          isEdit
            ? await fetchError(res, 'Could not update the grade')
            : await fetchError(res, 'Could not create the grade')
        );
        return;
      }

      notify.success(
        isEdit ? `${draft.name} updated.` : `${draft.name} added to your school's grades.`
      );
      setDraft(null);
      grades.refetch();
    } catch {
      notify.error('Could not reach the API. Check that it is running.');
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(grade: GradeLevel, next: 'active' | 'inactive') {
    if (next === 'inactive' && grade.classCount > 0) {
      const confirmed = confirm(
        `Deactivating "${grade.name}" will prevent new classes from being created at this grade level. ${grade.classCount} existing class(es) referenced by this grade will be preserved. Continue?`
      );
      if (!confirmed) return;
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/grades/${grade.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });

      if (!res.ok) {
        notify.error(await fetchError(res, 'Could not change the grade status'));
        return;
      }

      notify.success(
        next === 'active'
          ? `${grade.name} is active again.`
          : `${grade.name} is now inactive. Existing classes, learners, allocations, assessments and results are unchanged.`
      );
      grades.refetch();
    } catch {
      notify.error('Could not reach the API. Check that it is running.');
    } finally {
      setBusy(false);
    }
  }

  const columns: Array<DataTableColumn<GradeLevel>> = [
    {
      id: 'academicLevel',
      header: 'ACADEMIC LEVEL',
      cell: (row) => (
        <span className="text-sm font-medium text-foreground">{row.academicLevel}</span>
      ),
      sortValue: (row) => row.academicLevel,
    },
    {
      id: 'designationCode',
      header: 'DESIGNATION CODE',
      cell: (row) => (
        <span className="font-mono text-sm text-foreground">{row.designationCode}</span>
      ),
      sortValue: (row) => row.designationCode,
    },
    {
      id: 'name',
      header: 'GRADE/CLASS NAME',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{row.name}</p>
          {row.origin === 'curriculum' ? (
            <StatusPill label={ORIGIN_LABEL[row.origin]} tone="info" />
          ) : null}
        </div>
      ),
      sortValue: (row) => row.name,
    },
    {
      id: 'description',
      header: 'DESCRIPTION',
      cell: (row) => (
        <span className="truncate text-xs text-muted-foreground">{row.description ?? '-'}</span>
      ),
      sortValue: (row) => row.description ?? '',
    },
    {
      id: 'status',
      header: 'VISIBILITY',
      cell: (row) => (
        <StatusPill label={describeStatus(row.status)} tone={STATUS_TONE[row.status]} />
      ),
      sortValue: (row) => row.status,
    },
  ];

  if (!canView) {
    return (
      <div className="space-y-6">
        <SectionHeader title="GRADES" description="Manage school grades and levels" />
        <ErrorState
          title="You do not have access to grades"
          message="Viewing grades requires grades.view. Your role does not hold it."
        />
      </div>
    );
  }

  if (grades.loading) {
    return (
      <div className="space-y-6">
        <SectionHeader title="GRADES" description="Manage school grades and levels" />
        <LoadingState label="Loading grades…" />
      </div>
    );
  }

  if (grades.error) {
    return (
      <div className="space-y-6">
        <SectionHeader title="GRADES" description="Manage school grades and levels" />
        <ErrorState
          title="Could not load grades"
          message="GET /api/grades requires grades.view. Confirm the API is running and your session holds the permission."
        />
      </div>
    );
  }

  const items = grades.data?.grades ?? [];

  const filters: ContextFilter[] = [
    {
      id: 'status',
      label: 'Status',
      value: statusFilter,
      allowAll: true,
      allLabel: 'All statuses',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
      ],
      onChange: setStatusFilter,
    },
  ];

  function openCreate() {
    setDraft({
      id: '',
      name: '',
      designationCode: '',
      academicLevel: 1,
      description: '',
      status: 'active',
      origin: 'custom',
      classCount: 0,
      createdAt: '',
      updatedAt: '',
    });
  }

  function openEdit(grade: GradeLevel) {
    setDraft({ ...grade });
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="GRADES"
        description="Manage school grades and levels"
        action={canManage ? <Button onClick={openCreate}>New grade</Button> : null}
      />

      <ContextFilterBar
        filters={filters}
        search={{
          value: search,
          onChange: setSearch,
          placeholder: 'Search grades by name, code, or description...',
        }}
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          {items.length} grade{items.length !== 1 ? 's' : ''}
        </span>
        {items.some((g) => g.origin === 'curriculum') ? (
          <span>
            {items.filter((g) => g.origin === 'curriculum').length} curriculum-defined (read-only)
          </span>
        ) : null}
      </div>

      {items.length === 0 ? (
        <EmptyState
          title={search || statusFilter ? 'No grades match these filters' : 'No grades yet'}
          description={
            search || statusFilter
              ? 'Adjust the search or filters above.'
              : 'No grade levels are configured. Create one to begin organizing classes by educational stage.'
          }
          icon="layers"
          action={canManage ? <Button onClick={openCreate}>New grade</Button> : null}
        />
      ) : (
        <DataTable
          caption="School grade levels"
          columns={columns}
          rows={items}
          rowKey={(row) => row.id}
          pageSize={20}
          renderRowActions={(row) => {
            if (row.origin === 'curriculum') {
              return null;
            }
            const items = [
              {
                id: 'edit',
                label: `Edit ${row.name}`,
                icon: 'pencil',
                onClick: () => openEdit(row),
              },
              {
                id: row.status === 'active' ? 'deactivate' : 'reactivate',
                label:
                  row.status === 'active' ? `Deactivate ${row.name}` : `Reactivate ${row.name}`,
                icon: row.status === 'active' ? 'archive' : 'check',
                tone: row.status === 'active' ? 'danger' : 'success',
                onClick: () => changeStatus(row, row.status === 'active' ? 'inactive' : 'active'),
              } as {
                id: string;
                label: string;
                icon: string;
                onClick: () => void;
                tone: 'danger' | 'default';
              },
            ];
            return <ActionButtons items={items} />;
          }}
        />
      )}

      <FloatingFormModal
        isOpen={Boolean(draft)}
        onClose={() => setDraft(null)}
        title={draft?.id ? 'Edit grade' : 'New grade'}
        description={
          draft?.id
            ? 'Renaming or re-scoping a grade does not change records already attached to it: existing classes, learners, allocations and results retain their references.'
            : 'A canonical grade level for the school. Classes, learning areas, and learner profiles reference the designation code.'
        }
        icon="layers"
        submitLabel={draft?.id ? 'Save changes' : 'Create grade'}
        isSubmitting={busy}
        onSubmit={submitDraft}
        size="lg"
      >
        {draft ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Field label="Grade/Class Name" required>
                  <TextInput
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    placeholder="e.g. Grade 1, Pre Primary 1, Crèche"
                  />
                </Field>
              </div>
              <div className="space-y-1.5">
                <Field
                  label="Designation Code"
                  hint="Unique within your school. e.g. PP1, G1, G0"
                  required
                >
                  <TextInput
                    value={draft.designationCode}
                    onChange={(e) =>
                      setDraft({ ...draft, designationCode: e.target.value.toUpperCase() })
                    }
                    placeholder="e.g. G1"
                    disabled={draft.origin === 'curriculum'}
                  />
                </Field>
              </div>
              <div className="space-y-1.5">
                <Field
                  label="Academic Level"
                  hint="Whole number; negative values allowed (PP1 = -2, PP2 = -1, Crèche = 0)"
                  required
                >
                  <TextInput
                    type="number"
                    value={String(draft.academicLevel)}
                    onChange={(e) =>
                      setDraft({ ...draft, academicLevel: parseInt(e.target.value, 10) || 0 })
                    }
                    placeholder="-2"
                    disabled={draft.origin === 'curriculum'}
                  />
                </Field>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Field label="Description" hint="Optional. Shown wherever the grade is listed.">
                  <TextInput
                    value={draft.description ?? ''}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    placeholder="e.g. Curriculum Grade - Grade 1"
                  />
                </Field>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Field label="Visibility" required>
                  <Select
                    value={draft.status}
                    onChange={(e) =>
                      setDraft({ ...draft, status: e.target.value as 'active' | 'inactive' })
                    }
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </Select>
                </Field>
              </div>
            </div>

            {draft.origin === 'curriculum' && (
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                <p className="font-medium">Curriculum-defined grade</p>
                <p className="mt-1">
                  This grade comes from the curriculum. Its designation code and academic level
                  cannot be changed. Toggle visibility between Active and Inactive.
                </p>
              </div>
            )}

            {draft.classCount > 0 && draft.status === 'active' && (
              <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
                {draft.classCount} class(es) currently reference this grade. Deactivating it will
                prevent new classes from being created at this level while preserving existing ones.
              </p>
            )}
          </div>
        ) : null}
      </FloatingFormModal>
    </div>
  );
}
