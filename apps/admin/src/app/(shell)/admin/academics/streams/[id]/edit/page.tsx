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
  SectionHeader,
  Select,
  SettingsCard,
  StatusPill,
  TextInput,
  notify,
} from '@schoolos/ui';

/**
 * Edit a stream.
 *
 * The parent class is fixed: a stream cannot be moved between classes, because
 * attendance, timetabling and assessment results are recorded against the class
 * it was created under, and reassigning it would orphan that history.
 */
interface StreamRecord {
  id: string;
  classId: string;
  name: string;
  code: string;
  capacity: number | null;
  status: 'active' | 'inactive' | 'archived';
  learnerCount: number;
  parentClass: { id: string; name: string; gradeLevel: string | null } | null;
  responsible: {
    mainTeacher: { id: string; name: string | null } | null;
    assistantTeachers: Array<{ id: string; name: string | null; canManage: boolean }>;
  } | null;
}

export default function AdminEditStreamPage() {
  const params = useParams();
  const streamId = params?.id as string | undefined;
  const { can } = useAuth();
  const allowed = can('academics.manage');
  const router = useRouter();

  const { data, loading, error, refetch } = useApi<{ streams?: StreamRecord[] }>(
    allowed ? '/api/streams?limit=200' : '/api/streams?denied=1'
  );

  const [name, setName] = React.useState('');
  const [code, setCode] = React.useState('');
  const [capacity, setCapacity] = React.useState('');
  const [status, setStatus] = React.useState('active');
  const [hydrated, setHydrated] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  // The list route returns the school's own streams, so the record is selected
  // from that set: a stream belonging to another school is simply absent.
  const record = React.useMemo(
    () => (data?.streams ?? []).find((s) => s.id === streamId) ?? null,
    [data, streamId]
  );

  React.useEffect(() => {
    if (!record || hydrated) return;
    setName(record.name);
    setCode(record.code);
    setCapacity(record.capacity === null ? '' : String(record.capacity));
    setStatus(record.status);
    setHydrated(true);
  }, [record, hydrated]);

  const dirty =
    hydrated &&
    record !== null &&
    (name !== record.name ||
      code !== record.code ||
      capacity !== (record.capacity === null ? '' : String(record.capacity)) ||
      status !== record.status);

  async function save() {
    if (!record) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/streams/${record.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim(),
          capacity: capacity.trim() ? Number(capacity) : null,
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

      notify.success(`${name.trim()} updated`);
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
    if (!record) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/streams/${record.id}/archive`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        notify.error(
          body?.error?.message ?? `Could not archive ${record.name} (HTTP ${res.status}).`
        );
        return;
      }
      notify.success(`${record.name} archived`);
      router.push('/admin/academics/streams');
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
        <SectionHeader title="Edit Stream" />
        <ErrorState
          title="You do not have access to manage streams"
          message="Editing a stream requires academics.manage. Your role does not hold it, and the API refuses the request independently of this screen."
        />
      </div>
    );
  }

  if (loading) return <LoadingState label="Loading the stream" />;

  if (error) {
    return (
      <ErrorState
        title="Could not load this stream"
        message="GET /api/streams requires academics.view. Confirm the API is running and that your session still holds the permission."
      />
    );
  }

  if (!record) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Edit Stream" />
        <ErrorState
          title="Stream not found"
          message="No stream in this school matches this identifier."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title={`Edit ${record.name}`}
        description={`A stream within ${record.parentClass?.name ?? 'its class'}. The parent class cannot be changed, because attendance and assessment records belong to it.`}
        action={
          <a
            href="/admin/academics/streams"
            className="rounded-md border border-input bg-background px-3.5 py-2 text-sm font-semibold transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Back to Streams
          </a>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardCard
          title="Parent class"
          value={record.parentClass?.name ?? '-'}
          icon="users-round"
          description={record.parentClass?.gradeLevel ?? undefined}
        />
        <DashboardCard title="Learners placed" value={record.learnerCount} icon="graduation-cap" />
        <DashboardCard
          title="Main class teacher"
          value={record.responsible?.mainTeacher?.name ?? 'Unassigned'}
          icon="user-round"
        />
        <DashboardCard
          title="Assistants"
          value={record.responsible?.assistantTeachers.length ?? 0}
          icon="users"
          description={`${record.responsible?.assistantTeachers.filter((a) => a.canManage).length ?? 0} may manage`}
        />
      </div>

      <SettingsCard
        title="Stream details"
        description="Name, code and status. The code must stay unique within the class."
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field label="Stream name" required>
            <TextInput value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Stream code" required hint="Unique within the class">
            <TextInput value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          </Field>
          <Field label="Capacity" hint="Optional">
            <TextInput
              type="number"
              min={0}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
          </Field>
          <Field label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
            </Select>
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
          {record.status !== 'archived' ? (
            <ConfirmButton
              label="Archive stream"
              confirmLabel="Archive"
              description="Enrolments, attendance and results are retained."
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
    </div>
  );
}
