'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useApi } from '@schoolos/hooks';
import { useAuth } from '@schoolos/auth';
import {
  ActionButtons,
  ConfirmButton,
  DashboardCard,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  PrimaryActionButton,
  SectionHeader,
  SettingsCard,
  StatusPill,
  notify,
  type DataTableColumn,
  type StatusTone,
} from '@schoolos/ui';

/**
 * Class detail - the authoritative view of one academic class and its streams.
 *
 * The class record is the academic unit. Streams are its subdivisions. The
 * teaching team shown here is the class-level teacher and assistants; stream-
 * level teaching team detail is surfaced through the Teacher Allocation page.
 */

interface StreamRecord {
  id: string;
  name: string;
  code: string;
  capacity: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  learnerCount: number;
  allocations: Array<{
    id: string;
    responsibility: string;
    status: string;
    teacher: { id: string; name: string | null; email: string };
    subject: { id: string; name: string; code: string | null } | null;
  }>;
}

interface ClassRecord {
  id: string;
  name: string;
  classCode: string | null;
  gradeLevel: string | null;
  description: string | null;
  academicYearId: string | null;
  status: string;
  subject: { id: string; name: string } | null;
  teacher: { id: string; name: string | null; email: string } | null;
  academicYear: { id: string; name: string; label: string | null; status: string } | null;
  assistants: Array<{
    canManage: boolean;
    assistant: { id: string; name: string | null; email: string };
  }>;
  _count: { enrollments: number };
  streamCount: number;
  activeStreamCount: number;
  createdAt: string;
  updatedAt: string;
  streams: StreamRecord[];
  enrollments?: Array<{
    id: string;
    student: { id: string; name: string | null; email: string };
  }>;
}

interface ClassDetailResponse {
  class?: ClassRecord;
}

const STATUS_TONE: Record<string, StatusTone> = {
  active: 'success',
  inactive: 'warning',
  archived: 'neutral',
};

const RESPONSIBILITY_LABEL: Record<string, string> = {
  main_class_teacher: 'Main class teacher',
  assistant_class_teacher: 'Assistant teacher',
  subject_teacher: 'Subject teacher',
};

export default function AdminClassDetailPage() {
  const params = useParams();
  const classId = params?.id as string | undefined;
  const router = useRouter();
  const { can } = useAuth();
  const allowed = can('cohorts.view');
  const canManage = can('cohorts.manage');
  const canViewAllocation = can('teaching.view');

  const { data, loading, error, refetch } = useApi<ClassDetailResponse>(
    allowed && classId ? `/api/classes/${classId}` : '/api/classes?denied=1'
  );

  const cls = React.useMemo(() => data?.class, [data]);

  const activeStreams = cls?.streams.filter((s) => s.status === 'active') ?? [];
  const archivedStreams = cls?.streams.filter((s) => s.status === 'archived') ?? [];
  const totalStreams = cls?.streamCount ?? 0;
  const totalAllocations = cls?.streams.reduce(
    (sum, s) => sum + s.allocations.filter((a) => a.status === 'active').length,
    0
  ) ?? 0;

  if (!allowed) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Class" />
        <ErrorState
          title="You do not have access to classes"
          message="Viewing classes requires cohorts.view. Your role does not hold it, and the API refuses the request independently of this screen."
        />
      </div>
    );
  }

  if (loading) return <LoadingState label="Loading class" />;

  if (error || !cls) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Class" />
        <ErrorState
          title="Could not load this class"
          message="The class record could not be loaded. Confirm the API is running and that your session still holds the permission."
        />
      </div>
    );
  }

  const streamColumns: Array<DataTableColumn<StreamRecord>> = [
    {
      id: 'stream',
      header: 'Stream',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{row.name}</p>
          <p className="truncate font-mono text-xs text-muted-foreground">{row.code}</p>
        </div>
      ),
      sortValue: (row) => row.name,
    },
    {
      id: 'learners',
      header: 'Learners',
      cell: (row) => row.learnerCount.toLocaleString(),
      sortValue: (row) => row.learnerCount,
      align: 'right',
    },
    {
      id: 'capacity',
      header: 'Capacity',
      cell: (row) => (row.capacity != null ? row.capacity.toLocaleString() : '-'),
      sortValue: (row) => row.capacity ?? 0,
      align: 'right',
    },
    {
      id: 'teachingTeam',
      header: 'Teaching team',
      cell: (row) => {
        const active = row.allocations.filter((a) => a.status === 'active');
        const main = active.find((a) => a.responsibility === 'main_class_teacher');
        const assistants = active.filter((a) => a.responsibility === 'assistant_class_teacher');
        const subjects = active.filter((a) => a.responsibility === 'subject_teacher');
        return (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-foreground">
              {main ? main.teacher.name ?? 'Unassigned' : 'Unassigned'}
            </span>
            <span className="text-xs text-muted-foreground">
              {assistants.length > 0 && `${assistants.length} assistant${assistants.length === 1 ? '' : 's'}`}
              {assistants.length > 0 && subjects.length > 0 && ' · '}
              {subjects.length > 0 && `${subjects.length} subject${subjects.length === 1 ? '' : 's'}`}
            </span>
          </div>
        );
      },
      sortValue: (row) => row.allocations.filter((a) => a.status === 'active').length,
      hideBelow: 'md',
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => (
        <StatusPill label={row.status} tone={STATUS_TONE[row.status] ?? 'neutral'} />
      ),
      sortValue: (row) => row.status,
    },
  ];

  async function archive() {
    if (!cls) return;
    const res = await fetch(`/api/classes/${cls.id}/archive`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      notify.error(body?.error?.message ?? `Could not archive ${cls.name} (HTTP ${res.status}).`);
      return;
    }
    const result = (await res.json().catch(() => null)) as { retained?: { learners?: number } } | null;
    notify.success(`${cls.name} archived`, {
      description: result?.retained?.learners
        ? `Retained ${result.retained.learners} enrolment(s); the class is retired, not deleted.`
        : 'Enrolments, attendance and results are retained.',
    });
    router.push('/admin/classes');
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title={cls.name}
        description={
          <>
            {cls.gradeLevel ? `Grade ${cls.gradeLevel}` : 'Class detail'} · Status:{' '}
            <StatusPill label={cls.status} tone={STATUS_TONE[cls.status] ?? 'neutral'} />
          </>
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            {canViewAllocation ? (
              <PrimaryActionButton
                href="/admin/academics/teacher-allocation"
                label="View Teaching Teams"
                icon="users"
                variant="outline"
              />
            ) : null}
            {canManage && cls.status !== 'archived' ? (
              <PrimaryActionButton
                href={`/admin/classes/${cls.id}/edit`}
                label="Edit Class"
                icon="pencil"
              />
            ) : null}
            {canManage && cls.status !== 'archived' && (
              <ConfirmButton
                label="Archive class"
                confirmLabel="Archive"
                description="This retires the class and its streams. Enrolments, attendance and results are retained."
                onConfirm={archive}
                variant="outline"
                icon="archive"
              />
            )}
            <a
              href="/admin/classes"
              className="rounded-md border border-input bg-background px-3.5 py-2 text-sm font-semibold transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Back to Classes
            </a>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardCard
          title="Streams"
          value={totalStreams}
          icon="split"
          tone="accent"
          description={`${activeStreams.length} active, ${archivedStreams.length} archived`}
        />
        <DashboardCard
          title="Learners"
          value={cls._count.enrollments}
          icon="graduation-cap"
          description="Enrolled in this class"
        />
        <DashboardCard
          title="Teaching allocations"
          value={totalAllocations}
          icon="user-round-check"
          description="Across all streams"
        />
        <DashboardCard
          title="Grade level"
          value={cls.gradeLevel ?? '-'}
          icon="layers"
          description="Academic level"
        />
      </div>

      <SettingsCard
        title="Class details"
        description="The class record as held by the platform."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Class name</p>
            <p className="text-sm text-foreground">{cls.name}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Class code</p>
            <p className="text-sm text-foreground">{cls.classCode ?? '-'}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Grade / Level</p>
            <p className="text-sm text-foreground">{cls.gradeLevel ?? '-'}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Subject</p>
            <p className="text-sm text-foreground">{cls.subject?.name ?? '-'}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Class teacher</p>
            <p className="text-sm text-foreground">
              {cls.teacher?.name ?? 'Unassigned'}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Assistants</p>
            <p className="text-sm text-foreground">
              {cls.assistants.length > 0
                ? cls.assistants
                    .map((a) => a.assistant.name ?? 'Unnamed')
                    .join(', ')
                : 'None'}
            </p>
          </div>
           {cls.description && (
            <div className="md:col-span-2">
              <p className="text-xs font-medium text-muted-foreground">Description</p>
              <p className="text-sm text-foreground">{cls.description}</p>
            </div>
          )}
          <div>
            <p className="text-xs font-medium text-muted-foreground">Academic session</p>
            <p className="text-sm text-foreground">
              {cls.academicYear?.name ?? cls.academicYear?.label ?? '-'}
            </p>
          </div>
        </div>
      </SettingsCard>

      {canManage && cls.status !== 'archived' && (
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Streams</h2>
          <PrimaryActionButton
            href={`/admin/classes/${cls.id}/streams/new`}
            label="Create Stream"
            icon="plus"
            title="Add a stream to this class"
          />
        </div>
      )}

      <SettingsCard
        title=""
        description={
          cls.status === 'archived'
            ? 'This class is archived. Its streams are retained for historical reference.'
            : 'Subdivisions of this class. Each stream carries its own teaching team through Teacher Allocation.'
        }
      >
        {totalStreams === 0 ? (
          <EmptyState
            title="No streams"
            description="Create a stream to subdivide this class into teaching groups."
            icon="split"
            action={
              canManage && cls.status !== 'archived' ? (
                <a
                  href={`/admin/classes/${cls.id}/streams/new`}
                  className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Create Stream
                </a>
              ) : null}
          />
        ) : (
          <DataTable
            caption="Streams"
            columns={streamColumns}
            rows={cls.streams}
            rowKey={(row) => row.id}
            onRowClick={(row) => {
              window.location.href = `/admin/academics/streams/${row.id}/edit`;
            }}
            empty={
              <EmptyState
                title="No streams"
                description="Create a stream to subdivide this class into teaching groups."
                icon="split"
              />
            }
            renderRowActions={(row) => (
              <ActionButtons
                items={[
                  {
                    id: 'view',
                    label: `View ${row.name}`,
                    href: `/admin/classes/${cls.id}/streams/${row.id}`,
                    icon: 'eye',
                  },
                  {
                    id: 'allocation',
                    label: `Manage teaching team for ${row.name}`,
                    href: `/admin/academics/teacher-allocation`,
                    icon: 'users',
                  },
                ]}
              />
            )}
          />
        )}
      </SettingsCard>
    </div>
  );
}
