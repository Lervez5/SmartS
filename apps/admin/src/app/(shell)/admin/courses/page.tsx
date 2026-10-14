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
  FloatingFormModal,
  LoadingState,
  SectionHeader,
  StatusPill,
  TextInput,
  Select,
  notify,
  type ContextFilter,
  type DataTableColumn,
  type StatusTone,
} from '@schoolos/ui';

interface Course {
  id: string;
  title: string;
  code: string | null;
  description: string | null;
  category: string | null;
  status: 'draft' | 'published' | 'archived';
  teacher: { id: string; name: string | null; email: string } | null;
  subject: { id: string; name: string } | null;
  _count: { enrollments: number; modules: number; classes: number };
  createdAt: string;
  updatedAt: string;
}

interface ClassInCourse {
  id: string;
  name: string;
  classCode: string | null;
  gradeLevel: string | null;
  status: 'active' | 'inactive' | 'archived';
  teacher: { id: string; name: string | null; email: string } | null;
  streamCount: number;
  _count: { enrollments: number };
  streams: Array<{ id: string; name: string; code: string; status: string }>;
}

interface CoursesResponse {
  courses?: Course[];
  total?: number;
}

const STATUS_TONE: Record<Course['status'], StatusTone> = {
  draft: 'neutral',
  published: 'success',
  archived: 'warning',
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function AdminCoursesPage() {
  const { can } = useAuth();
  const allowed = can('courses.view');
  const canManage = can('courses.manage');

  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [draft, setDraft] = React.useState<Partial<Course & { streamCount: number }> | null>(null);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const params = new URLSearchParams();
  if (debounced) params.set('search', debounced);
  if (statusFilter) params.set('status', statusFilter);

  const courses = useApi<CoursesResponse>(
    allowed
      ? `/api/courses${params.toString() ? `?${params.toString()}` : ''}`
      : '/api/courses?denied=1'
  );

  const rows = courses.data?.courses ?? [];

  async function submitDraft() {
    if (!draft?.title?.trim()) {
      notify.error('Course title is required.');
      return;
    }

    const payload = {
      title: draft.title.trim(),
      description: draft.description?.trim() || undefined,
      code: draft.code?.trim() || undefined,
      category: draft.category?.trim() || undefined,
      status: draft.status ?? 'draft',
    };

    const res = await fetch('/api/courses', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      notify.error(body?.error?.message ?? `Could not create the course (HTTP ${res.status}).`);
      return;
    }

    notify.success(`${draft.title} created.`);
    setDraft(null);
    courses.refetch();
  }

  const columns: Array<DataTableColumn<Course & { streamCount: number }>> = [
    {
      id: 'title',
      header: 'COURSE',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{row.title}</p>
          {row.code && (
            <p className="truncate font-mono text-xs text-muted-foreground">{row.code}</p>
          )}
          {row.subject && (
            <p className="truncate text-xs text-muted-foreground">{row.subject.name}</p>
          )}
        </div>
      ),
      sortValue: (row) => row.title,
    },
    {
      id: 'status',
      header: 'STATUS',
      cell: (row) => <StatusPill label={row.status.toUpperCase()} tone={STATUS_TONE[row.status]} />,
      sortValue: (row) => row.status,
    },
    {
      id: 'teacher',
      header: 'TEACHER',
      cell: (row) => {
        const teacher = row.teacher;
        return (
          <div className="min-w-0">
            <p className="truncate text-sm text-foreground">
              {teacher?.name ?? teacher?.email ?? 'Unassigned'}
            </p>
            {row._count.classes > 0 && (
              <p className="text-xs text-muted-foreground">
                {row._count.classes} class{row._count.classes !== 1 ? 'es' : ''}
              </p>
            )}
          </div>
        );
      },
      sortValue: (row) => row.teacher?.name ?? '',
    },
    {
      id: 'progress',
      header: 'PROGRESS',
      cell: (row) => {
        const total = row._count.enrollments;
        return total > 0 ? (
          <span className="text-sm text-foreground">
            {total} ent{total !== 1 ? 'ries' : 'ry'}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        );
      },
      sortValue: (row) => row._count.enrollments,
    },
  ];

  const rowsWithStreamCount = rows.map((row) => ({ ...row, streamCount: 0 }));

  if (courses.loading) {
    return (
      <div className="space-y-6">
        <SectionHeader title="COURSES" description="Manage school courses and learning materials" />
        <LoadingState label="Loading courses…" />
      </div>
    );
  }

  if (courses.error) {
    return (
      <div className="space-y-6">
        <SectionHeader title="COURSES" description="Manage school courses and learning materials" />
        <ErrorState
          title="Could not load courses"
          message="GET /api/courses requires courses.view. Confirm the API is running and your session holds the permission."
        />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="space-y-6">
        <SectionHeader title="COURSES" description="Manage school courses and learning materials" />
        <ErrorState
          title="You do not have access to courses"
          message="Viewing courses requires courses.view. Your role does not hold it."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="COURSES"
        description="Manage school courses and learning materials"
        action={
          canManage ? (
            <Button onClick={() => setDraft({ status: 'draft' })}>New course</Button>
          ) : null
        }
      />

      <ContextFilterBar
        filters={[
          {
            id: 'status',
            label: 'Status',
            value: statusFilter,
            allowAll: true,
            allLabel: 'All statuses',
            options: [
              { value: 'draft', label: 'Draft' },
              { value: 'published', label: 'Published' },
              { value: 'archived', label: 'Archived' },
            ],
            onChange: setStatusFilter,
          } as ContextFilter,
        ]}
        search={{
          value: search,
          onChange: setSearch,
          placeholder: 'Search courses by title, code, or description...',
        }}
      />

      {rowsWithStreamCount.length === 0 ? (
        <EmptyState
          title={debounced || statusFilter ? 'No courses match these filters' : 'No courses yet'}
          description={
            debounced || statusFilter
              ? 'Adjust the search or filters above.'
              : 'No course levels are configured. Create one to begin organizing learning materials.'
          }
          icon="book-open"
          action={
            canManage ? (
              <Button onClick={() => setDraft({ status: 'draft' })}>New course</Button>
            ) : null
          }
        />
      ) : (
        <DataTable
          caption="School courses and learning materials"
          columns={columns}
          rows={rowsWithStreamCount}
          rowKey={(row) => row.id}
          pageSize={20}
          renderRowActions={(row) =>
            canManage ? (
              <ActionButtons
                items={[
                  {
                    id: 'edit',
                    label: `Edit ${row.title}`,
                    icon: 'pencil',
                    onClick: () => setDraft({ ...row, streamCount: 0 }),
                  },
                  {
                    id: row.status === 'archived' ? 'reactivate' : 'archive',
                    label:
                      row.status === 'archived'
                        ? `Reactivate ${row.title}`
                        : `Archive ${row.title}`,
                    icon: row.status === 'archived' ? 'check' : 'archive',
                    tone: row.status === 'archived' ? 'danger' : undefined,
                    onClick: () => {
                      // Archive/reactivate logic would go here
                    },
                  },
                ]}
              />
            ) : null
          }
        />
      )}

      <FloatingFormModal
        isOpen={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? 'Edit course' : 'New course'}
        icon="book-open"
        submitLabel={draft?.id ? 'Save changes' : 'Create course'}
        size="lg"
        onSubmit={submitDraft}
      >
        {draft ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="block">
                  <span className="text-sm font-medium text-foreground">
                    Course Title <span className="text-destructive">*</span>
                  </span>
                  <TextInput
                    value={draft.title ?? ''}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    placeholder="Course title"
                  />
                </label>
              </div>
              <div className="space-y-1.5">
                <label className="block">
                  <span className="text-sm font-medium text-foreground">Code</span>
                  <TextInput
                    value={draft.code ?? ''}
                    onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. MATH101"
                  />
                </label>
              </div>
              <div className="space-y-1.5">
                <label className="block">
                  <span className="text-sm font-medium text-foreground">Subject</span>
                  <Select
                    value={draft.subject?.id ?? ''}
                    onChange={(e) =>
                      setDraft({ ...draft, subject: { id: e.target.value, name: '' } })
                    }
                  >
                    <option value="">Select a learning area</option>
                  </Select>
                </label>
              </div>
              <div className="space-y-1.5">
                <label className="block">
                  <span className="text-sm font-medium text-foreground">Category</span>
                  <TextInput
                    value={draft.category ?? ''}
                    onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                    placeholder="e.g. Mathematics, Science"
                  />
                </label>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="block">
                  <span className="text-sm font-medium text-foreground">Description</span>
                  <TextInput
                    value={draft.description ?? ''}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    placeholder="Course description"
                  />
                </label>
              </div>
              <div className="space-y-1.5">
                <label className="block">
                  <span className="text-sm font-medium text-foreground">Status</span>
                  <Select
                    value={draft.status ?? 'draft'}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        status: e.target.value as 'draft' | 'published' | 'archived',
                      })
                    }
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </Select>
                </label>
              </div>
            </div>
          </div>
        ) : null}
      </FloatingFormModal>
    </div>
  );
}
