'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useApi } from '@schoolos/hooks';
import { useAuth } from '@schoolos/auth';
import {
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  PrimaryActionButton,
  SectionHeader,
  SettingsCard,
  TextInput,
  notify,
  type DataTableColumn,
} from '@schoolos/ui';

/**
 * Add Stream - create a stream inside one specific class.
 *
 * A stream subdivides a class. It does not replace the class, so attendance,
 * timetabling and assessment stay anchored to the parent class.
 */

interface ClassOption {
  id: string;
  name: string;
  gradeLevel: string | null;
  classCode: string | null;
  academicYearId: string | null;
  status: 'active' | 'inactive' | 'archived';
  teacher: { id: string; name: string | null; email: string } | null;
  assistants: Array<{ canManage: boolean; assistant: { id: string; name: string | null } }>;
  _count: { enrollments: number };
}

interface ClassDetailResponse {
  classes?: ClassOption[];
}

export default function AdminNewClassStreamPage() {
  const params = useParams();
  const classId = params?.id as string | undefined;
  const router = useRouter();
  const { can } = useAuth();
  const allowed = can('cohorts.manage');

  const classes = useApi<ClassDetailResponse>(allowed ? '/api/classes' : '/api/classes?denied=1');
  const parent = React.useMemo(
    () => classes.data?.classes?.find((c) => c.id === classId),
    [classes.data, classId]
  );
  const [name, setName] = React.useState('');
  const [code, setCode] = React.useState('');
  const [capacity, setCapacity] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit() {
    if (!classId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/streams', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId,
          ...(parent?.academicYearId ? { academicYearId: parent.academicYearId } : {}),
          name: name.trim(),
          code: code.trim(),
          ...(capacity.trim() ? { capacity: Number(capacity) } : {}),
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setError(body?.error?.message ?? `The API refused the stream (HTTP ${res.status}).`);
        return;
      }

      notify.success(`${name.trim()} created`);
      router.push(`/admin/classes/${classId}`);
      router.refresh();
    } catch {
      setError('Could not reach the API. Check that it is running.');
    } finally {
      setSaving(false);
    }
  }

  if (!allowed) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Add Stream" />
        <ErrorState
          title="You do not have access to manage streams"
          message="Creating a stream requires cohorts.manage. Your role does not hold it, and the API refuses the request independently of this screen."
        />
      </div>
    );
  }

  if (classes.loading) return <LoadingState label="Loading class" />;

  if (!parent) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Add Stream" />
        <EmptyState
          title="Class not found"
          description="The class you are trying to add a stream to could not be found."
          icon="split"
          action={
            <a
              href="/admin/classes"
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Back to Classes
            </a>
          }
        />
      </div>
    );
  }

  const classColumns: Array<DataTableColumn<ClassOption>> = [
    {
      id: 'class',
      header: 'Class',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{row.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {row.gradeLevel ?? 'Grade not set'}
          </p>
        </div>
      ),
    },
    {
      id: 'teacher',
      header: 'Main class teacher',
      cell: (row) => row.teacher?.name ?? <span className="text-muted-foreground">Unassigned</span>,
      hideBelow: 'sm',
    },
    {
      id: 'assistants',
      header: 'Assistants',
      align: 'right',
      cell: (row) => row.assistants?.length ?? 0,
    },
    {
      id: 'learners',
      header: 'Learners',
      align: 'right',
      cell: (row) => row._count.enrollments.toLocaleString(),
    },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Add Stream"
        description={`Create a stream inside ${parent.name}. A stream subdivides a class and does not replace it.`}
        action={
          <a
            href={`/admin/classes/${classId}`}
            className="rounded-md border border-input bg-background px-3.5 py-2 text-sm font-semibold transition-colors hover:bg-accent"
          >
            Back to class
          </a>
        }
      />

      <SettingsCard
        title="Stream details"
        description="Name, code and optional capacity. The code must be unique within the class."
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <p className="mb-1 text-sm font-medium text-foreground">Parent class</p>
            <p className="text-sm text-muted-foreground">
              {parent.name} {parent.gradeLevel ? `(${parent.gradeLevel})` : ''}
            </p>
          </div>
          <Field label="Stream name" required>
            <TextInput
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Blue"
            />
          </Field>
          <Field label="Stream code" required hint="Unique within the class, e.g. BLU">
            <TextInput
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="BLU"
            />
          </Field>
          <Field label="Capacity" hint="Optional">
            <TextInput
              type="number"
              min={0}
              value={capacity}
              onChange={(event) => setCapacity(event.target.value)}
              placeholder="30"
            />
          </Field>
        </div>

        {error ? (
          <div
            role="alert"
            className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </div>
        ) : null}

        <div className="mt-5 flex items-center gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={saving || !name.trim() || !code.trim()}
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            {saving ? 'Creating…' : 'Create stream'}
          </button>
          <PrimaryActionButton
            href={`/admin/classes/${classId}`}
            label="Cancel"
            variant="outline"
          />
        </div>
      </SettingsCard>
    </div>
  );
}
