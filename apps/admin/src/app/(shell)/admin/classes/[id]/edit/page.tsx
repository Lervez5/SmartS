'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useApi } from '@schoolos/hooks';
import { useAuth } from '@schoolos/auth';
import {
  ConfirmButton,
  DashboardCard,
  ErrorState,
  Field,
  LoadingState,
  PrimaryActionButton,
  SectionHeader,
  Select,
  SettingsCard,
  StatusPill,
  TextInput,
  useAcademicSession,
  notify,
} from '@schoolos/ui';

/**
 * Edit Class - modify an existing class/grade record.
 *
 * The academic session is shown for context but not editable inline: changing
 * a class's session after streams, enrolments and results are attached would
 * orphan that history, so session moves are an explicit archival + re-create
 * flow rather than a casual edit.
 */

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
  assistants: Array<{
    canManage: boolean;
    assistant: { id: string; name: string | null; email: string };
  }>;
  _count: { enrollments: number };
  streamCount: number;
  activeStreamCount: number;
  createdAt: string;
  updatedAt: string;
  streams: Array<{
    id: string;
    name: string;
    code: string;
    status: string;
    learnerCount: number;
  }>;
}

interface ClassDetailResponse {
  class?: ClassRecord;
}

export default function AdminEditClassPage() {
  const params = useParams();
  const classId = params?.id as string | undefined;
  const { can } = useAuth();
  const allowed = can('cohorts.manage');
  const router = useRouter();
  const { current: session, ready } = useAcademicSession();

  const { data, loading, error, refetch } = useApi<ClassDetailResponse>(
    allowed && classId ? `/api/classes/${classId}` : '/api/classes?denied=1'
  );

  const cls = React.useMemo(() => data?.class, [data]);

  const [name, setName] = React.useState('');
  const [classCode, setClassCode] = React.useState('');
  const [gradeLevel, setGradeLevel] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [status, setStatus] = React.useState('active');
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    if (!cls || hydrated) return;
    setName(cls.name);
    setClassCode(cls.classCode ?? '');
    setGradeLevel(cls.gradeLevel ?? '');
    setDescription(cls.description ?? '');
    setStatus(cls.status);
    setHydrated(true);
  }, [cls, hydrated]);

  const dirty =
    hydrated &&
    cls !== undefined &&
    (name !== cls.name ||
      classCode !== (cls.classCode ?? '') ||
      gradeLevel !== (cls.gradeLevel ?? '') ||
      description !== (cls.description ?? '') ||
      status !== cls.status);

  async function save() {
    if (!cls) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/classes/${cls.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          classCode: classCode.trim() || null,
          gradeLevel: gradeLevel.trim() || null,
          description: description.trim() || null,
          status,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setSaveError(body?.error?.message ?? `The API refused the change (HTTP ${res.status}).`);
        return;
      }

      notify.success(`${cls.name} updated`);
      setHydrated(false);
      refetch();
      router.refresh();
    } catch {
      setSaveError('Could not reach the API. Check that it is running.');
    } finally {
      setSaving(false);
    }
  }

  async function archive() {
    if (!cls) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/classes/${cls.id}/archive`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        notify.error(
          body?.error?.message ?? `Could not archive ${cls.name} (HTTP ${res.status}).`
        );
        return;
      }
      notify.success(`${cls.name} archived`, {
        description: 'Enrolments, attendance and results are retained.',
      });
      router.push('/admin/classes');
      router.refresh();
    } catch {
      notify.error('Could not reach the API. Check that it is running.');
    } finally {
      setSaving(false);
    }
  }

  if (!allowed) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Edit Class" />
        <ErrorState
          title="You do not have access to manage classes"
          message="Editing a class requires cohorts.manage. Your role does not hold it, and the API refuses the request independently of this screen."
        />
      </div>
    );
  }

  if (loading) return <LoadingState label="Loading class" />;

  if (error) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Edit Class" />
        <ErrorState
          title="Could not load this class"
          message="GET /api/classes/:id requires cohorts.view. Confirm the API is running and that your session still holds the permission."
        />
      </div>
    );
  }

  if (!cls) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Edit Class" />
        <ErrorState
          title="Class not found"
          message="No class in this school matches this identifier."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title={`Edit ${cls.name}`}
        description={
          <>
            {cls.gradeLevel ? `Grade ${cls.gradeLevel}` : 'Class detail'} · Status:{' '}
            <StatusPill label={cls.status} tone={cls.status === 'active' ? 'success' : cls.status === 'inactive' ? 'warning' : 'neutral'} />
            {ready && session && cls.academicYearId ? (
              <span className="ml-2 text-sm text-muted-foreground">
                Session: {session.label}
              </span>
            ) : null}
          </>
        }
        action={
          <a
            href="/admin/classes"
            className="rounded-md border border-input bg-background px-3.5 py-2 text-sm font-semibold transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Back to Classes
          </a>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardCard
          title="Streams"
          value={cls.streamCount}
          icon="split"
          description={`${cls.activeStreamCount} active`}
        />
        <DashboardCard
          title="Learners"
          value={cls._count.enrollments}
          icon="graduation-cap"
          description="Enrolled in this class"
        />
        <DashboardCard
          title="Class Teacher"
          value={cls.teacher?.name ?? 'Unassigned'}
          icon="user-round"
        />
        <DashboardCard
          title="Assistants"
          value={cls.assistants.length}
          icon="users"
          description={`${cls.assistants.filter((a) => a.canManage).length} may manage`}
        />
      </div>

      <SettingsCard
        title="Class details"
        description="The class name, code and grade level. The academic session cannot be changed here: changing it would orphan existing streams, enrolments, attendance and results."
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field label="Class name" required hint="e.g. Grade 4 Blue">
            <TextInput
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Grade 4 Blue"
            />
          </Field>
          <Field label="Class code" hint="Optional short code, e.g. 4BLU">
            <TextInput
              value={classCode}
              onChange={(event) => setClassCode(event.target.value.toUpperCase())}
              placeholder="4BLU"
            />
          </Field>
          <Field label="Grade / Level" hint="e.g. Grade 4, Form 1">
            <TextInput
              value={gradeLevel}
              onChange={(event) => setGradeLevel(event.target.value)}
              placeholder="Grade 4"
            />
          </Field>
          <Field label="Status" hint="Archiving a class blocks further changes">
            <Select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
            </Select>
          </Field>
          <Field label="Description" hint="Optional" className="md:col-span-2">
            <TextInput
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional class description"
            />
          </Field>
        </div>

        {saveError ? (
          <div
            role="alert"
            className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            {saveError}
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          {cls.status !== 'archived' ? (
            <ConfirmButton
              label="Archive class"
              confirmLabel="Archive"
              description="Enrolments, attendance and results are retained; the class is retired, not deleted."
              onConfirm={archive}
              variant="destructive"
              size="md"
              icon="archive"
              disabled={saving}
            />
          ) : (
            <StatusPill label="Archived" tone="neutral" />
          )}
        </div>
      </SettingsCard>

      {cls.streams && cls.streams.length > 0 ? (
        <SettingsCard
          title="Child streams"
          description="Streams subdivide this class into teaching groups. Manage staffing via Teacher Allocation."
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs font-medium text-muted-foreground uppercase">
                  <th className="pb-2">Stream</th>
                  <th className="pb-2">Code</th>
                  <th className="pb-2">Learners</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {cls.streams.map((stream) => (
                  <tr key={stream.id} className="border-b last:border-0">
                    <td className="py-2.5">
                      <span className="text-sm font-medium">{stream.name}</span>
                    </td>
                    <td className="py-2.5 text-muted-foreground">{stream.code}</td>
                    <td className="py-2.5">{stream.learnerCount}</td>
                    <td className="py-2.5">
                      <StatusPill label={stream.status} tone={stream.status === 'active' ? 'success' : stream.status === 'inactive' ? 'warning' : 'neutral'} />
                    </td>
                    <td className="py-2.5 text-right">
                      <a
                        href={`/admin/academics/streams/${stream.id}/edit`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        Edit
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {allowed && cls.status !== 'archived' ? (
            <div className="mt-4">
              <PrimaryActionButton
                href={`/admin/classes/${cls.id}/streams/new`}
                label="Create Stream"
                icon="plus"
                title="Add a new stream to this class"
                variant="outline"
              />
            </div>
          ) : null}
        </SettingsCard>
      ) : (
        <SettingsCard title="Child streams" description="No streams have been created yet.">
          <div className="py-4 text-center">
            <p className="text-sm text-muted-foreground">Streams will appear here once created.</p>
          </div>
          {allowed && cls.status !== 'archived' ? (
            <div className="mt-4">
              <PrimaryActionButton
                href={`/admin/classes/${cls.id}/streams/new`}
                label="Create first stream"
                icon="plus"
              />
            </div>
          ) : null}
        </SettingsCard>
      )}
    </div>
  );
}
