'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@schoolos/auth';
import { ErrorState, Field, SectionHeader, Select, SettingsCard, TextInput } from '@schoolos/ui';

/**
 * Create an academic session.
 *
 * `POST /api/academic-sessions` validates the name, the dates and the status,
 * and refuses an end date that is not after the start. Creating a session as
 * `active` completes whichever session was active, so exactly one is ever
 * resolved as current.
 */
export default function AdminCreateAcademicSessionPage() {
  const { can } = useAuth();
  const allowed = can('academics.manage');
  const router = useRouter();

  const [name, setName] = React.useState('');
  const [label, setLabel] = React.useState('');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [status, setStatus] = React.useState('planned');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const rangeInvalid =
    Boolean(startDate) && Boolean(endDate) && new Date(endDate) <= new Date(startDate);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/academic-sessions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          label: label.trim(),
          startDate,
          endDate,
          status,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string; details?: unknown };
        } | null;
        const fieldErrors = (body?.error?.details as { fieldErrors?: Record<string, string[]> })
          ?.fieldErrors;
        const firstFieldError = fieldErrors ? Object.values(fieldErrors).flat()[0] : undefined;
        setError(
          firstFieldError ??
            body?.error?.message ??
            `The API refused the session (HTTP ${res.status}).`
        );
        return;
      }

      router.push('/admin/academics/years');
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
        <SectionHeader title="Create Academic Session" />
        <ErrorState
          title="You do not have access to manage academic sessions"
          message="Creating a session requires academics.manage. Your role does not hold it, and the API refuses the request independently of this screen."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Create Academic Session"
        description="A session is the school year the platform resolves as current. Its terms are added once the session exists."
        action={
          <a
            href="/admin/academics/years"
            className="rounded-md border border-input bg-background px-3.5 py-2 text-sm font-semibold transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Back to sessions
          </a>
        }
      />

      <SettingsCard
        title="Session details"
        description="The identifier is the session key used across the platform; the label is what people read."
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field
            label="Session identifier"
            required
            hint="Unique, e.g. 2026"
            error={error && name.trim().length < 2 ? 'At least two characters' : undefined}
          >
            <TextInput
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="2026"
            />
          </Field>
          <Field label="Display label" hint="Shown to people; falls back to the identifier">
            <TextInput
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="2026 Academic Session"
            />
          </Field>
          <Field label="Start date" required>
            <TextInput
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              placeholder="mm/dd/yyyy"
            />
          </Field>
          <Field
            label="End date"
            required
            error={rangeInvalid ? 'End date must be after the start date' : undefined}
          >
            <TextInput
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              placeholder="mm/dd/yyyy"
            />
          </Field>
          <Field
            label="Status"
            hint="Creating a session as Active completes whichever session is currently active"
          >
            <Select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="planned">Planned</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </Select>
          </Field>
        </div>

        {error && name.trim().length >= 2 ? (
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
            disabled={saving || !name.trim() || !startDate || !endDate || rangeInvalid}
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            {saving ? 'Creating…' : 'Create session'}
          </button>
          <a
            href="/admin/academics/years"
            className="rounded-md border border-input bg-background px-3.5 py-2 text-sm font-medium transition-colors hover:bg-accent"
          >
            Cancel
          </a>
        </div>
      </SettingsCard>
    </div>
  );
}
