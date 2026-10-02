'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
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
 * Edit a staff record.
 *
 * `PUT /api/staff/:id` accepts position, department and employment status -
 * exactly what the route's update schema declares, so the form cannot send a
 * field the API would reject. Name, email and phone belong to the Central Auth
 * account and are not editable here; portal access is changed through the role,
 * not through this form.
 */
interface StaffMember {
  id: string;
  name?: string | null;
  email: string;
  position?: string | null;
  department?: string | null;
  status: 'active' | 'on_leave' | 'terminated' | 'archived';
}

interface StaffResponse {
  staff?: StaffMember[];
}

function formatDate(value?: string | null): string {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

export default function AdminEditStaffPage() {
  const params = useParams();
  const staffId = params?.id as string | undefined;
  const router = useRouter();
  const { can } = useAuth();
  const allowed = can('staff.manage');

  const { data, loading, error } = useApi<StaffResponse>(
    allowed ? '/api/staff?limit=200' : '/api/staff?denied=1'
  );

  const member = React.useMemo(
    () => (data?.staff ?? []).find((row) => row.id === staffId),
    [data, staffId]
  );

  const [position, setPosition] = React.useState('');
  const [department, setDepartment] = React.useState('');
  const [status, setStatus] = React.useState('active');
  const [hydrated, setHydrated] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    if (!member || hydrated) return;
    setPosition(member.position ?? '');
    setDepartment(member.department ?? '');
    setStatus(member.status);
    setHydrated(true);
  }, [member, hydrated]);

  const dirty =
    hydrated &&
    member !== undefined &&
    (position !== (member.position ?? '') ||
      department !== (member.department ?? '') ||
      status !== member.status);

  // Marking someone terminated or archived ends their employment, so it is
  // gated behind a confirmation while the reversible states are not.
  const isTerminal = status === 'terminated' || status === 'archived';
  const wasTerminal = member?.status === 'terminated' || member?.status === 'archived';

  async function save() {
    if (!member) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/staff/${member.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          position: position.trim(),
          department: department.trim(),
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
        <SectionHeader title="Edit Staff" />
        <ErrorState
          title="You do not have access to manage staff"
          message="Editing staff requires staff.manage. Your role does not hold it, and the API refuses the request independently of this screen."
        />
      </div>
    );
  }

  if (loading) return <LoadingState label="Loading the staff record" />;

  if (error) {
    return (
      <ErrorState
        title="Could not load this staff record"
        message="GET /api/staff requires staff.view. Confirm the API is running and that your session still holds the permission."
      />
    );
  }

  if (!member) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Edit Staff" />
        <ErrorState
          title="Staff member not found"
          message="No staff record on the directory matches this identifier."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Edit Staff"
        description={`${member.name ?? member.email}. Name and contact details belong to the account; portal access is changed through the member’s role.`}
        action={
          <a
            href={`/admin/staff/${member.id}`}
            className="rounded-md border border-input bg-background px-3.5 py-2 text-sm font-semibold transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Back to staff record
          </a>
        }
      />

      <SettingsCard
        title="Employment details"
        description="Position, department and employment state. Clearing a text field stores an empty string, as the API’s update schema does."
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field label="Position">
            <TextInput
              value={position}
              onChange={(event) => setPosition(event.target.value)}
              placeholder="Head of Science"
            />
          </Field>
          <Field label="Department">
            <TextInput
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              placeholder="Science"
            />
          </Field>
          <Field
            label="Employment status"
            hint={
              isTerminal
                ? 'Terminating or archiving ends employment. The account and its access are untouched.'
                : undefined
            }
          >
            <Select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="active">Active</option>
              <option value="on_leave">On leave</option>
              <option value="terminated">Terminated</option>
              <option value="archived">Archived</option>
            </Select>
          </Field>
        </div>

        {isTerminal && !wasTerminal ? (
          <p
            role="alert"
            className="mt-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300"
          >
            This marks the staff record as {status}. It does not deactivate the account, so the
            member can still sign in - account access is managed separately.
          </p>
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

        <div className="mt-5 flex items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          {dirty ? (
            <ConfirmButton
              label="Discard changes"
              confirmLabel="Discard"
              description="Unsaved changes will be lost."
              onConfirm={() => {
                setPosition(member.position ?? '');
                setDepartment(member.department ?? '');
                setStatus(member.status);
                setSaveError(null);
                setSaved(false);
              }}
              variant="outline"
              size="md"
            />
          ) : null}
        </div>
      </SettingsCard>
    </div>
  );
}
