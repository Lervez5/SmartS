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
  useAcademicSession,
  notify,
  type DataTableColumn,
} from '@schoolos/ui';

/**
 * Add Class - create a new academic class.
 *
 * A class is the academic unit. Streams subdivide it. This screen creates the
 * class record only; streams and teacher allocations are created through their
 * own workflows.
 */

interface ClassOption {
  id: string;
  name: string;
  gradeLevel: string | null;
  classCode: string | null;
  teacher: { id: string; name: string | null; email: string } | null;
  _count: { enrollments: number };
}

export default function AdminNewClassPage() {
  const { can } = useAuth();
  const allowed = can('cohorts.manage');
  const router = useRouter();
  const { sessionId, current: session, ready } = useAcademicSession();

  const [name, setName] = React.useState('');
  const [classCode, setClassCode] = React.useState('');
  const [gradeLevel, setGradeLevel] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/classes', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           name: name.trim(),
           classCode: classCode.trim() || undefined,
           gradeLevel: gradeLevel.trim() || undefined,
           description: description.trim() || undefined,
           ...(sessionId && ready ? { academicYearId: sessionId } : {}),
         }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setError(body?.error?.message ?? `The API refused the class (HTTP ${res.status}).`);
        return;
      }

      notify.success(`${name.trim()} created`);
      router.push('/admin/classes');
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
        <SectionHeader title="Create Class" />
        <ErrorState
          title="You do not have access to create classes"
          message="Creating a class requires cohorts.manage. Your role does not hold it, and the API refuses the request independently of this screen."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Create Class"
        description="Create a new academic class. Streams can be added after the class is created."
        action={
          <a
            href="/admin/classes"
            className="rounded-md border border-input bg-background px-3.5 py-2 text-sm font-semibold transition-colors hover:bg-accent"
          >
            Back to Classes
          </a>
        }
      />

      <SettingsCard
        title="Class details"
        description="The class name and optional metadata. Grade level and class code help identify the class in reports and timetables."
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
          <Field label="Description" hint="Optional">
            <TextInput
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional class description"
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
            disabled={saving || !name.trim()}
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            {saving ? 'Creating…' : 'Create class'}
          </button>
          <PrimaryActionButton href="/admin/classes" label="Cancel" variant="outline" />
        </div>
      </SettingsCard>
    </div>
  );
}
