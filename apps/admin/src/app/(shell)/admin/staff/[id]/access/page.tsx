'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { useApi } from '@schoolos/hooks';
import { useAuth, ROLES } from '@schoolos/auth';
import {
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  SectionHeader,
  StatusPill,
  roleLabel,
  type DataTableColumn,
  notify,
} from '@schoolos/ui';

/**
 * Portal access - which application and role a staff member signs into.
 *
 * Central Auth owns the identity; this changes the role on it through
 * `PUT /api/roles/:id/users/:userId`, which replaces the member's role
 * memberships with the chosen one.
 *
 * The endpoint refuses to assign a role the actor does not themselves hold, so
 * an administrator cannot escalate anyone - including themselves - above their
 * own level. That check lives in the service, not here: this screen only
 * reflects the roles the API will allow, and says so rather than presenting an
 * option that would be rejected on submit.
 */
interface StaffMember {
  id: string;
  userId: string;
  name?: string | null;
  email: string;
  roles: Array<{ id: string; name: string }>;
}

interface StaffResponse {
  staff?: StaffMember[];
}

interface RoleRow {
  id: string;
  name: string;
  description?: string | null;
  members?: number;
  /** Full permission keys, as returned by GET /api/roles. */
  permissions?: string[];
}

/** Which application each role can enter, from the central role model. */
const APP_FOR_ROLE: Record<string, string> = {
  SUPER_ADMIN: 'Admin Portal',
  ACCOUNTANT: 'Admin Portal',
  DEAN: 'Admin Portal',
  TEACHER: 'Teacher Portal',
  PARENT: 'Parent Portal',
  STUDENT: 'Student Portal',
};

export default function AdminStaffAccessPage() {
  const params = useParams();
  const staffId = params?.id as string | undefined;
  const { can, permissions } = useAuth();
  const allowed = can('roles.manage');

  const staff = useApi<StaffResponse>(allowed ? '/api/staff?limit=200' : '/api/staff?denied=1');
  const roles = useApi<{ roles?: RoleRow[] }>(allowed ? '/api/roles' : '/api/roles?denied=1');

  const member = React.useMemo(
    () => (staff.data?.staff ?? []).find((row) => row.id === staffId),
    [staff.data, staffId]
  );

  const [selected, setSelected] = React.useState<string>('');
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  /**
   * Roles this actor may actually grant.
   *
   * Mirrors the server rule exactly: a role is offered only when every
   * permission it grants is one the caller already holds. Filtering here
   * rather than offering everything and letting the API refuse keeps the
   * dropdown honest, and it is possible because `GET /api/roles` returns each
   * role's permission keys rather than just a count.
   */
  const assignable = React.useMemo(() => {
    const all = roles.data?.roles ?? [];
    const mine = new Set<string>(permissions);
    return all.filter((role) => (role.permissions ?? []).every((key) => mine.has(key)));
  }, [roles.data, permissions]);

  const current = member?.roles[0]?.name ?? null;
  const dirty = Boolean(selected) && selected !== current;

  async function assign() {
    if (!member || !selected) return;
    const target = roles.data?.roles?.find((r) => r.name === selected);
    if (!target) return;

    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/roles/${target.id}/users/${member.userId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: selected }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        notify.error(body?.error?.message ?? `The API refused the change (HTTP ${res.status}).`);
        return;
      }

      setSaved(true);
      setSelected('');
    } catch {
      notify.error('Could not reach the API. Check that it is running.');
    } finally {
      setSaving(false);
    }
  }

  const columns: Array<DataTableColumn<RoleRow>> = [
    {
      id: 'role',
      header: 'Role',
      cell: (row) => (
        <span className="flex items-center gap-2">
          <span className="font-medium text-foreground">{roleLabel(row.name)}</span>
          {row.name === current ? <StatusPill label="Current" tone="brand" /> : null}
        </span>
      ),
      sortValue: (row) => row.name,
    },
    {
      id: 'app',
      header: 'Can enter',
      cell: (row) => (
        <span className="text-sm text-muted-foreground">{APP_FOR_ROLE[row.name] ?? '-'}</span>
      ),
      sortValue: (row) => APP_FOR_ROLE[row.name] ?? '',
    },
    {
      id: 'permissions',
      header: 'Permissions',
      align: 'right',
      cell: (row) => (row.permissions ?? []).length.toLocaleString(),
    },
  ];

  if (!allowed) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Portal Access" />
        <ErrorState
          title="You do not have access to manage roles"
          message="Changing portal access requires roles.manage, which is held only by a super admin. Your role does not hold it, and the API refuses the request independently of this screen."
        />
      </div>
    );
  }

  if (staff.loading || roles.loading) return <LoadingState label="Loading access details" />;

  if (staff.error || roles.error) {
    return (
      <ErrorState
        title="Could not load access details"
        message="The staff directory and the role catalogue could not be read. Confirm the API is running and that your session still holds the permission."
      />
    );
  }

  if (!member) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Portal Access" />
        <EmptyState
          title="Staff member not found"
          description="No staff record on the directory matches this identifier."
          icon="graduation-cap"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Portal Access"
        description={`${member.name ?? member.email} - which application and role this account signs into.`}
        action={
          <a
            href={`/admin/staff/${member.id}`}
            className="rounded-md border border-input bg-background px-3.5 py-2 text-sm font-semibold transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Back to staff record
          </a>
        }
      />

      <div className="rounded-lg border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Current access</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {member.roles.length === 0 ? (
                <StatusPill label="No role assigned" tone="warning" />
              ) : (
                member.roles.map((r) => (
                  <StatusPill
                    key={r.id}
                    label={`${roleLabel(r.name)} · ${APP_FOR_ROLE[r.name] ?? '-'}`}
                    tone="brand"
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">Change role</h2>
        <p className="text-sm text-muted-foreground">
          Assigning a role replaces every current role membership with the one chosen. Only roles
          you hold yourself can be assigned, so this cannot be used to grant a level of access above
          your own.
        </p>

        {assignable.length === 0 ? (
          <EmptyState
            title="No role is assignable"
            description="The API only permits assigning a role you already hold, and none were returned."
            icon="shield-check"
          />
        ) : (
          <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-4">
            <div className="min-w-[220px]">
              <label
                htmlFor="assign-role"
                className="mb-1 block text-xs font-medium text-muted-foreground"
              >
                Role
              </label>
              <select
                id="assign-role"
                value={selected}
                onChange={(event) => {
                  setSelected(event.target.value);
                  setSaved(false);
                }}
                className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Choose a role…</option>
                {assignable.map((role) => (
                  <option key={role.id} value={role.name}>
                    {roleLabel(role.name)} - {APP_FOR_ROLE[role.name] ?? '-'}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={assign}
              disabled={!dirty || saving}
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
            >
              {saving ? 'Assigning…' : 'Assign role'}
            </button>
          </div>
        )}

        {saved ? (
          <p className="text-sm text-emerald-700 dark:text-emerald-300">
            Role assigned. The change takes effect on the member’s next request.
          </p>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">Role catalogue</h2>
        <DataTable
          caption="Roles provisioned in this school"
          columns={columns}
          rows={roles.data?.roles ?? []}
          rowKey={(row) => row.id}
          empty={
            <EmptyState
              title="No roles provisioned"
              description={`Run the seed to create the ${ROLES.length} roles.`}
              icon="shield-check"
            />
          }
        />
      </section>

      <p className="text-xs text-muted-foreground">
        You hold {permissions.length} permissions. Role assignment is recorded in the audit log, and
        deactivating an account is not possible from this screen because no endpoint exists for it -
        employment status is edited on the staff record.
      </p>
    </div>
  );
}
