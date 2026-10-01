'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { useApi } from '@schoolos/hooks';
import { useAuth } from '@schoolos/auth';
import {
  DashboardCard,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  SectionHeader,
  SettingsCard,
  StatusPill,
  initialsOf,
  type DataTableColumn,
} from '@schoolos/ui';

/**
 * Learner profile.
 *
 * Reads the same `GET /api/students` directory the Active Learners page uses
 * and selects the requested learner. There is no per-learner endpoint and no
 * edit endpoint, so this is a read view over the directory response — adding a
 * dedicated `GET /api/students/:id` is the obvious next step once the
 * directory stops being the only source.
 */
interface Learner {
  id: string;
  userId: string;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  phone?: string | null;
  avatar?: string | null;
  status: 'pending' | 'active' | 'suspended' | 'archived';
  gradeLevel?: string | null;
  admissionId?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  enrollmentDate?: string | null;
  guardians: number;
  class: { id: string; name: string; classCode?: string | null; gradeLevel?: string | null } | null;
}

interface StudentsResponse {
  students?: Learner[];
}

const STATUS_TONE = {
  active: 'success',
  pending: 'warning',
  suspended: 'danger',
  archived: 'neutral',
} as const;

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? '—'
    : parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function displayName(learner: Learner): string {
  return learner.name ?? [learner.firstName, learner.lastName].filter(Boolean).join(' ') ?? '';
}

export default function AdminLearnerProfilePage() {
  const params = useParams();
  const learnerId = params?.id as string | undefined;
  const { can } = useAuth();
  const allowed = can('students.view');

  const { data, loading, error } = useApi<StudentsResponse>(
    allowed ? '/api/students?limit=200' : '/api/students?denied=1'
  );

  const learner = React.useMemo(
    () => (data?.students ?? []).find((row) => row.id === learnerId),
    [data, learnerId]
  );

  if (!allowed) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Learner" />
        <ErrorState
          title="You do not have access to learner records"
          message="Viewing learners requires students.view. Your role does not hold it, and the API refuses the request independently of this screen."
        />
      </div>
    );
  }

  if (loading) return <LoadingState label="Loading the learner record" />;

  if (error) {
    return (
      <ErrorState
        title="Could not load this learner"
        message="GET /api/students requires students.view. Confirm the API is running and that your session still holds the permission."
      />
    );
  }

  if (!learner) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Learner" />
        <EmptyState
          title="Learner not found"
          description="No learner in the directory matches this identifier. It may have been removed, or the link may be out of date."
          icon="graduation-cap"
          action={
            <a
              href="/admin/students"
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Back to Active Learners
            </a>
          }
        />
      </div>
    );
  }

  const name = displayName(learner);

  const detailRows = [
    { field: 'Full name', value: name || '—' },
    { field: 'Email', value: learner.email },
    { field: 'Phone', value: learner.phone || '—' },
    { field: 'Date of birth', value: formatDate(learner.dateOfBirth) },
    {
      field: 'Gender',
      value:
        learner.gender && learner.gender !== 'unspecified'
          ? learner.gender.charAt(0).toUpperCase() + learner.gender.slice(1)
          : '—',
    },
    { field: 'Enrolment date', value: formatDate(learner.enrollmentDate) },
    {
      field: 'Admission identifier',
      value: learner.admissionId || '—',
      mono: Boolean(learner.admissionId),
    },
    { field: 'Class', value: learner.class?.name ?? 'Unplaced' },
    { field: 'Class code', value: learner.class?.classCode || '—' },
    { field: 'Grade level', value: learner.class?.gradeLevel ?? learner.gradeLevel ?? '—' },
    { field: 'Stream', value: 'No stream in the data model' },
    { field: 'Linked guardians', value: String(learner.guardians) },
    { field: 'Record id', value: learner.id, mono: true },
  ];

  const columns: Array<DataTableColumn<{ field: string; value: string; mono?: boolean }>> = [
    { id: 'field', header: 'Field', cell: (row) => row.field },
    {
      id: 'value',
      header: 'Value',
      cell: (row) => (
        <span className={row.mono ? 'font-mono text-xs text-foreground' : undefined}>
          {row.value}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        title={name || 'Learner'}
        description="Learner record as held by the school. This is a read view: the API exposes no learner edit endpoint."
        action={
          <a
            href="/admin/students"
            className="rounded-md border border-input bg-background px-3.5 py-2 text-sm font-semibold transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Back to Active Learners
          </a>
        }
      />

      <div className="flex items-center gap-4 rounded-lg border bg-card p-5">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-lg font-bold text-primary">
          {learner.avatar ? (
            <span
              role="img"
              aria-label=""
              className="h-full w-full bg-cover bg-center"
              style={{ backgroundImage: `url(${learner.avatar})` }}
            />
          ) : (
            initialsOf(name || learner.email)
          )}
        </span>
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-foreground">{name || 'Unnamed'}</p>
          <p className="truncate text-sm text-muted-foreground">{learner.email}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <StatusPill label={learner.status} tone={STATUS_TONE[learner.status] ?? 'neutral'} />
            <StatusPill
              label={learner.class ? learner.class.name : 'Unplaced'}
              tone={learner.class ? 'brand' : 'warning'}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardCard title="Class" value={learner.class?.name ?? 'Unplaced'} icon="users-round" />
        <DashboardCard
          title="Grade level"
          value={learner.class?.gradeLevel ?? learner.gradeLevel ?? '—'}
          icon="layers"
        />
        <DashboardCard title="Guardians linked" value={learner.guardians} icon="users" />
        <DashboardCard
          title="Account status"
          value={learner.status}
          icon="shield-check"
          tone={learner.status === 'active' ? 'success' : 'warning'}
        />
      </div>

      <SettingsCard
        title="Learner details"
        description="Every field the model holds for this learner. Fields the schema does not carry are shown as such rather than left blank."
      >
        <DataTable
          caption="Full learner record"
          columns={columns}
          rows={detailRows}
          rowKey={(row) => row.field}
        />
      </SettingsCard>
    </div>
  );
}
