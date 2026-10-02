'use client';

import * as React from 'react';
import { useApi } from '@schoolos/hooks';
import { useAuth } from '@schoolos/auth';
import {
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  SectionHeader,
  StatusPill,
  roleLabel as formatRole,
  type DataTableColumn,
  notify,
} from '@schoolos/ui';

/**
 * Add Parent — attach a guardian profile to an existing account.
 *
 * `POST /api/parents` takes a `userId` and creates the ParentProfile; it does
 * not create accounts, exactly as enrolment and Add Staff attach profiles to
 * existing accounts. The candidate list is the real user register filtered by
 * the `hasParentProfile` flag the API returns.
 *
 * Learning from what failed on the staff screen: `roleLabel` is exported by
 * `@schoolos/ui`, so the import above resolves there rather than from auth.
 */
interface UserRow {
  id: string;
  email: string;
  name?: string | null;
  role?: string | null;
  isActive?: boolean;
  invitationStatus?: string | null;
  hasParentProfile?: boolean;
}

interface UsersResponse {
  users?: UserRow[];
}

function nameOf(user: UserRow): string {
  return user.name?.trim() || user.email;
}

export default function AdminAddParentPage() {
  const { can } = useAuth();
  const allowed = can('parents.manage');

  const [selected, setSelected] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const {
    data,
    loading,
    error: loadError,
  } = useApi<UsersResponse>(allowed ? '/api/users' : '/api/users?denied=1');

  const users = React.useMemo(() => data?.users ?? [], [data]);
  const candidates = React.useMemo(
    () => users.filter((user) => user.hasParentProfile === false),
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
      cell: (row) => (row.role ? <StatusPill label={formatRole(row.role)} tone="neutral" /> : '—'),
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
    try {
      const res = await fetch('/api/parents', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selected }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        notify.error(body?.error?.message ?? `The API refused the request (HTTP ${res.status}).`);
        return;
      }

      const created = (await res.json()) as { parent?: { name?: string | null; email?: string } };
      notify.success(created.parent?.name ?? created.parent?.email ?? 'Guardian added');
      setSelected(null);
    } catch {
      notify.error('Could not reach the API. Check that it is running.');
    } finally {
      setSaving(false);
    }
  }

  const selectedName = selected
    ? nameOf(users.find((user) => user.id === selected) ?? ({ email: '' } as UserRow))
    : null;

  if (!allowed) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Add Parent" />
        <ErrorState
          title="You do not have access to manage guardians"
          message="Adding a guardian requires parents.manage, which is held only by a super admin. Your role does not hold it, and the API refuses the request independently of this screen."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Add Parent"
        description="Attach a guardian profile to an account that does not have one. The account itself is provisioned separately; this does not create a second identity."
        action={
          <a
            href="/admin/parents"
            className="rounded-md border border-input bg-background px-3.5 py-2 text-sm font-semibold transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Back to Parents
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
        <div className="rounded-lg border bg-card p-5">
          <h2 className="text-base font-semibold text-foreground">Create the guardian profile</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Select the account below, then create the profile. Linking the guardian to their
            learners happens on the guardian record afterwards.
          </p>

          {selectedName ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Adding a guardian profile for{' '}
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

          <div className="mt-5 flex items-center gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={saving || !selected}
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
            >
              {saving ? 'Adding…' : 'Add guardian'}
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
        </div>
      )}

      {loading || loadError ? null : (
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Accounts without a guardian profile
            </h2>
            <p className="text-sm text-muted-foreground">
              {candidates.length === 0
                ? 'Every account already has a guardian profile.'
                : `${candidates.length} of ${users.length} accounts can be added.`}
            </p>
          </div>
          <DataTable
            caption="Accounts that do not yet have a guardian profile"
            columns={columns}
            rows={candidates}
            rowKey={(row) => row.id}
            pageSize={10}
            empty={
              <EmptyState
                title="No accounts to add"
                description="Every account already has a guardian profile, or no accounts exist yet."
                icon="users"
              />
            }
          />
        </section>
      )}
    </div>
  );
}
