'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
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
 * Add Stream - create a stream inside one of the school's classes.
 *
 * The parent class is required, because a stream is a subdivision of a class and
 * has no meaning without one. The API re-checks that the class belongs to the
 * caller's school and that the code is unused within it, so this screen cannot
 * attach a stream to another school's class or duplicate a code by form.
 */
interface ClassOption {
  id: string;
  name: string;
  gradeLevel?: string | null;
  teacher?: { id: string; name: string | null } | null;
  assistants?: Array<{ canManage: boolean; assistant: { id: string; name: string | null } }>;
}

export default function AdminNewStreamPage() {
  const { can } = useAuth();
  const allowed = can('academics.manage');
  const router = useRouter();

  const classes = useApi<ClassOption[]>(allowed ? '/api/classes' : null);

  const [classId, setClassId] = React.useState('');
  const [name, setName] = React.useState('');
  const [code, setCode] = React.useState('');
  const [capacity, setCapacity] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const options = classes.data ?? [];
  const parent = options.find((cls) => cls.id === classId);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/streams', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId,
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
      router.push('/admin/academics/streams');
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
          message="Creating a stream requires academics.manage. Your role does not hold it, and the API refuses the request independently of this screen."
        />
      </div>
    );
  }

  if (classes.loading) return <LoadingState label="Loading classes" />;

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
      id: 'pick',
      header: 'Select',
      align: 'right',
      cell: (row) => (
        <button
          type="button"
          onClick={() => setClassId(row.id)}
          className={[
            'rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors',
            classId === row.id
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-input bg-background hover:bg-accent',
          ].join(' ')}
        >
          {classId === row.id ? 'Selected' : 'Select'}
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Add Stream"
        description="A stream subdivides an existing class. Choose the class this stream belongs to."
        action={
          <a
            href="/admin/academics/streams"
            className="rounded-md border border-input bg-background px-3.5 py-2 text-sm font-semibold transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Back to Streams
          </a>
        }
      />

      {classes.error ? (
        <ErrorState
          title="Could not load classes"
          message="GET /api/classes requires cohorts.view. Confirm the API is running and that your session still holds the permission."
        />
      ) : options.length === 0 ? (
        <EmptyState
          title="No classes to add a stream to"
          description="A stream belongs to a class, so create the class first and then divide it into streams."
          icon="users-round"
          action={
            <a
              href="/admin/classes"
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Go to Classes
            </a>
          }
        />
      ) : (
        <SettingsCard
          title="Stream details"
          description="Name, code and optional capacity. The code must be unique within the class."
        >
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Field label="Class" required hint="The stream is created inside this class">
              <select
                value={classId}
                onChange={(event) => setClassId(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Choose a class…</option>
                {options.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {[cls.name, cls.gradeLevel].filter(Boolean).join(' - ')}
                  </option>
                ))}
              </select>
            </Field>
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

          {parent ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Responsibility stays with {parent.name}:{' '}
              <span className="font-medium text-foreground">
                {parent.teacher?.name ?? 'no main class teacher assigned'}
              </span>
              {parent.assistants?.length
                ? ` and ${parent.assistants.length} assistant${parent.assistants.length === 1 ? '' : 's'}`
                : ''}
              . A stream does not carry a teacher of its own.
            </p>
          ) : null}

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
              disabled={saving || !classId || !name.trim() || !code.trim()}
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
            >
              {saving ? 'Creating…' : 'Create stream'}
            </button>
            <PrimaryActionButton href="/admin/academics/streams" label="Cancel" variant="outline" />
          </div>
        </SettingsCard>
      )}

      {options.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">
            Classes available to divide into streams
          </h2>
          <DataTable
            caption="Classes in your school"
            columns={classColumns}
            rows={options}
            rowKey={(row) => row.id}
            pageSize={10}
          />
        </section>
      ) : null}
    </div>
  );
}
