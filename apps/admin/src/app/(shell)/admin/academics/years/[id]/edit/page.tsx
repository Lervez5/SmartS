'use client';

import * as React from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useApi } from '@schoolos/hooks';
import { useAuth } from '@schoolos/auth';
import {
  ConfirmButton,
  ErrorState,
  Field,
  LoadingState,
  SectionHeader,
  Select,
  SettingsCard,
  StatusPill,
  TextInput,
} from '@schoolos/ui';

/**
 * Edit an academic session, and activate or deactivate it.
 *
 * `PATCH /api/academic-sessions/:id` validates the resulting date range rather
 * than the submitted one, so a partial edit cannot leave the session ending
 * before it starts. Activating completes whichever session was active.
 *
 * The row action links here with `?setStatus=`, which preselects the status so
 * "Activate" or "Deactivate" is one deliberate step rather than a hidden
 * consequence of an edit.
 */
interface SessionRecord {
  id: string;
  name: string;
  label?: string | null;
  startDate: string;
  endDate: string;
  status: 'planned' | 'active' | 'completed' | 'archived';
  isActive: boolean;
  termCount: number;
}

function toInputDate(value?: string | null): string {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

export default function AdminEditAcademicSessionPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const sessionId = params?.id as string | undefined;
  const router = useRouter();
  const { can } = useAuth();
  const allowed = can('academics.manage');

  const { data, loading, error } = useApi<{ session: SessionRecord | null }>(
    allowed ? `/api/academic-sessions/${sessionId}` : '/api/academic-sessions?denied=1'
  );

  const session = data?.session ?? null;
  const presetStatus = searchParams?.get('setStatus') ?? '';

  const [name, setName] = React.useState('');
  const [label, setLabel] = React.useState('');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [status, setStatus] = React.useState('planned');
  const [hydrated, setHydrated] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    if (!session) return;
    setName(session.name);
    setLabel(session.label ?? '');
    setStartDate(toInputDate(session.startDate));
    setEndDate(toInputDate(session.endDate));
    setStatus(presetStatus || session.status);
    setHydrated(true);
  }, [session, presetStatus]);

  const rangeInvalid =
    Boolean(startDate) && Boolean(endDate) && new Date(endDate) <= new Date(startDate);

  const current = session;
  const dirty =
    hydrated &&
    current !== null &&
    (name !== current.name ||
      label !== (current.label ?? '') ||
      startDate !== toInputDate(current.startDate) ||
      endDate !== toInputDate(current.endDate) ||
      status !== current.status);

  // Changing the status changes what every module resolves as current, so it is
  // the one field that gets a confirmation rather than a silent save.
  const statusChanged = dirty && status !== (current?.status ?? null);

  async function save() {
    if (!session) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/academic-sessions/${session.id}`, {
        method: 'PATCH',
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
          error?: { message?: string };
        } | null;
        setSaveError(body?.error?.message ?? `The API refused the change (HTTP ${res.status}).`);
        return;
      }

      setSaved(true);
      setHydrated(false);
      router.refresh();
    } catch {
      setSaveError('Could not reach the API. Check that it is running.');
    } finally {
      setSaving(false);
    }
  }

  if (!allowed) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Edit Academic Session" />
        <ErrorState
          title="You do not have access to manage academic sessions"
          message="Editing a session requires academics.manage. Your role does not hold it, and the API refuses the request independently of this screen."
        />
      </div>
    );
  }

  if (loading) return <LoadingState label="Loading the academic session" />;

  if (error) {
    return (
      <ErrorState
        title="Could not load this academic session"
        message="GET /api/academic-sessions requires academics.view. Confirm the API is running and that your session still holds the permission."
      />
    );
  }

  if (!session) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Edit Academic Session" />
        <ErrorState
          title="Academic session not found"
          message="No session matches this identifier."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title={`Edit ${session.label || session.name}`}
        description="Changing the status changes which session the navbar and every downstream module resolve as current."
        action={
          <a
            href={`/admin/academics/years/${session.id}`}
            className="rounded-md border border-input bg-background px-3.5 py-2 text-sm font-semibold transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Back to session
          </a>
        }
      />

      <SettingsCard
        title="Session details"
        description={`${session.termCount} term${session.termCount === 1 ? '' : 's'} attached to this session. Terms are managed on the session screen.`}
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field label="Session identifier" required>
            <TextInput value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="Display label">
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
            />
          </Field>
          <Field
            label="Status"
            hint={
              status === 'active'
                ? 'Activating completes whichever session is currently active'
                : undefined
            }
          >
            <Select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="planned">Planned</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </Select>
          </Field>
        </div>

        {statusChanged ? (
          <div
            role="alert"
            className="mt-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300"
          >
            {status === 'active'
              ? 'Saving this as Active will complete whichever session is currently active, and every module will resolve this one as current.'
              : 'Saving this status removes it as the current session. No module will resolve a current period from it.'}
          </div>
        ) : null}

        {saveError ? (
          <div
            role="alert"
            className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            {saveError}
          </div>
        ) : null}

        {saved ? (
          <div className="mt-4">
            <StatusPill label="Saved" tone="success" />
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {statusChanged ? (
            <ConfirmButton
              label={status === 'active' ? 'Save and activate' : 'Save status change'}
              confirmLabel={status === 'active' ? 'Activate session' : 'Apply status'}
              description={
                status === 'active'
                  ? 'The current session will be completed.'
                  : 'This will stop being the current session.'
              }
              onConfirm={save}
              variant={status === 'active' ? 'default' : 'destructive'}
              size="md"
              icon="check"
              disabled={saving}
            />
          ) : (
            <button
              type="button"
              onClick={save}
              disabled={!dirty || saving}
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          )}
        </div>
      </SettingsCard>
    </div>
  );
}
