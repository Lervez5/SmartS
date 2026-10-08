'use client';

import * as React from 'react';
import { useApi } from '@schoolos/hooks';
import { useAuth } from '@schoolos/auth';
import {
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  SectionHeader,
  SettingsCard,
  StatusPill,
  TextInput,
  roleLabel,
  type DataTableColumn,
} from '@schoolos/ui';

/**
 * Add Staff — attach a staff profile to an existing account.
 *
 * `POST /api/staff` takes a `userId` and creates the StaffProfile; it does not
 * create accounts. Accounts are provisioned separately, so this screen lists the
 * accounts that have no staff profile yet and enrols one.
 *
 * A staff record is never a second identity: it is a profile hanging off the
 * Central Auth user, which is what the candidate list makes explicit.
 */
interface UserRow {
  id: string;
  email: string;
  name?: string | null;
  role?: string | null;
  isActive?: boolean;
  invitationStatus?: string | null;
  hasStaffProfile?: boolean;
}

interface UsersResponse {
  users?: UserRow[];
}

function nameOf(user: UserRow): string {
  return user.name?.trim() || user.email;
}

export default function AdminAddStaffPage() {
  const { can } = useAuth();
  const allowed = can('staff.manage');

  const [selected, setSelected] = React.useState<string | null>(null);
  const [position, setPosition] = React.useState('');
  const [department, setDepartment] = React.useState('');
  const [employeeId, setEmployeeId] = React.useState('');
  const [hireDate, setHireDate] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<string | null>(null);

  const {
    data,
    loading,
    error: loadError,
  } = useApi<UsersResponse>(allowed ? '/api/users' : '/api/users?denied=1');

  const users = React.useMemo(() => data?.users ?? [], [data]);
  const candidates = React.useMemo(
    () => users.filter((user) => user.hasStaffProfile === false),
    [users]
  );

  const columns: Array<DataTableColumn<UserRow>> = [
    {
      id: 'name',
      header: 'Account',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{nameOf(row)}</p>
          <p className="truncate text-xs text-muted-foreground">{row.email}</p>
        </div>
      ),
      sortValue: (row) => nameOf(row),
    },
    {
      id: 'role',
      header: 'Current role',
      cell: (row) => (row.role ? <StatusPill label={roleLabel(row.role)} tone="neutral" /> : '—'),
      hideBelow: 'sm',
    },
    {
      id: 'access',
      header: 'Access',
      hideBelow: 'md',
      cell: (row) => (
        <StatusPill
          label={
            row.invitationStatus === 'pending' ? 'invited' : row.isActive ? 'active' : 'inactive'
          }
          tone={row.isActive ? 'success' : 'warning'}
        />
      ),
    },
    {
      id: 'pick',
      header: 'Select',
      align: 'right',
      cell: (row) => (
        <button
          type="button"
          onClick={() => {
            setSelected(row.id);
            setDone(null);
            setError(null);
          }}
          className={[
            'rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            selected === row.id
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-input bg-background hover:bg-accent',
          ].join(' ')}
        >
          {selected === row.id ? 'Selected' : 'Select'}
        </button>
      ),
    },
  ];

  async function submit() {
    if (!selected) {
      setError('Select an account first.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selected,
          ...(position.trim() ? { position: position.trim() } : {}),
          ...(department.trim() ? { department: department.trim() } : {}),
          ...(employeeId.trim() ? { employeeId: employeeId.trim() } : {}),
          ...(hireDate ? { hireDate } : {}),
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setError(body?.error?.message ?? `The API refused the request (HTTP ${res.status}).`);
        return;
      }

      const created = (await res.json()) as { user?: { name?: string | null; email?: string } };
      setDone(created.user?.name ?? created.user?.email ?? 'Staff member added');
      setSelected(null);
      setPosition('');
      setDepartment('');
      setEmployeeId('');
      setHireDate('');
    } catch {
      setError('Could not reach the API. Check that it is running.');
    } finally {
      setSaving(false);
    }
  }

  if (!allowed) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Add Staff" />
        <ErrorState
          title="You do not have access to manage staff"
          message="Adding staff requires staff.manage. Your role does not hold it, and the API refuses the request independently of this screen."
        />
      </div>
    );
  }

  const selectedName = selected
    ? nameOf(users.find((user) => user.id === selected) ?? ({ email: '' } as UserRow))
    : null;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Add Staff"
        description="Attach a staff record to an account that does not have one. The account itself is provisioned separately; this does not create a second identity."
        action={
          <a
            href="/admin/staff"
            className="rounded-md border border-input bg-background px-3.5 py-2 text-sm font-semibold transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Back to School Staff
          </a>
        }
      />

      {loading ? (
        <LoadingState label="Loading accounts" />
      ) : loadError ? (
        <ErrorState
          title="Could not load accounts"
          message="GET /api/users requires users.view. Confirm the API is running and that your session still holds the permission."
        />
      ) : (
        <SettingsCard
          title="Staff record"
          description="Employment details. Portal access is assigned separately through the member’s role."
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
            <Field label="Employee ID" hint="Optional; the staff identifier the schema carries">
              <TextInput
                value={employeeId}
                onChange={(event) => setEmployeeId(event.target.value)}
              />
            </Field>
            <Field label="Hire date">
              <TextInput
                type="date"
                value={hireDate}
                onChange={(event) => setHireDate(event.target.value)}
              />
            </Field>
          </div>

          {selectedName ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Adding a staff record for{' '}
              <span className="font-medium text-foreground">{selectedName}</span>
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

          {done ? (
            <div className="mt-4 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
              {done} now has a staff record and appears on the School Staff directory.
            </div>
          ) : null}

          <div className="mt-5 flex items-center gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={saving || !selected}
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
            >
              {saving ? 'Adding…' : 'Add staff record'}
            </button>
            {selected ? (
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-md border border-input bg-background px-3.5 py-2 text-sm font-medium transition-colors hover:bg-accent"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </SettingsCard>
      )}

      {loading || loadError ? null : (
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Accounts without a staff record
            </h2>
            <p className="text-sm text-muted-foreground">
              {candidates.length === 0
                ? 'Every account already has a staff record.'
                : `${candidates.length} of ${users.length} accounts can be added.`}
            </p>
          </div>
          <DataTable
            caption="Accounts that do not yet have a staff record"
            columns={columns}
            rows={candidates}
            rowKey={(row) => row.id}
            pageSize={10}
            empty={
              <EmptyState
                title="No accounts to add"
                description="Every account already has a staff record, or no accounts exist yet."
                icon="graduation-cap"
              />
            }
          />
        </section>
      )}
    </div>
  );
}
