'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { useApi } from '@schoolos/hooks';
import { useAuth } from '@schoolos/auth';
import {
  ConfirmButton,
  DataTable,
  DashboardCard,
  EmptyState,
  ErrorState,
  LoadingState,
  SectionHeader,
  SettingsCard,
  StatusPill,
  initialsOf,
  type DataTableColumn,
  notify,
  Input,
  Select,
  Button,
} from '@schoolos/ui';

/**
 * Guardian profile and its linked learners.
 *
 * The relationship between a guardian and a learner is the link itself, so
 * linking and unlinking happen here. `ParentChildLink` has no relationship-type
 * field, so no mother/father/guardian label is offered or shown - the model
 * records which learners a guardian looks after and nothing finer.
 *
 * Name, email, phone and sign-in status belong to the Central Auth account; the
 * page says so rather than implying the profile owns them.
 */
interface LinkedLearner {
  linkId: string;
  learnerId: string;
  name: string;
  email: string;
  gradeLevel?: string | null;
}

interface Guardian {
  id: string;
  userId: string;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  phone?: string | null;
  avatar?: string | null;
  accountStatus: string;
  createdAt: string;
  children: LinkedLearner[];
}

interface LearnersResponse {
  students?: Array<{ id: string; name?: string | null; email: string; gradeLevel?: string | null }>;
}

function displayName(guardian: Guardian): string {
  return guardian.name ?? [guardian.firstName, guardian.lastName].filter(Boolean).join(' ') ?? '';
}

function formatDate(value?: string | null): string {
  if (!value) return '-';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? '-'
    : parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminGuardianProfilePage() {
  const params = useParams();
  const guardianId = params?.id as string | undefined;
  const { can } = useAuth();
  const canView = can('parents.view');
  const canManage = can('parents.manage');

  const { data, loading, error, refetch } = useApi<{ parent: Guardian | null }>(
    canView ? `/api/parents/${guardianId}` : '/api/parents?denied=1'
  );

  // Only fetched when linking is possible, so a read-only viewer does not
  // download the whole learner register.
  const learners = useApi<LearnersResponse>(canManage ? '/api/students?limit=200' : null);

  const guardian = data?.parent ?? null;

  const [linking, setLinking] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  // Edit mode state for guardian details
  const [editing, setEditing] = React.useState(false);
  const [formData, setFormData] = React.useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    status: 'active',
  });

  async function saveChanges() {
    if (!guardian) return;
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/users/${guardian.userId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setActionError(body?.error?.message ?? `The API refused the update (HTTP ${res.status}).`);
        return;
      }
      setEditing(false);
      refetch();
      notify.success('Guardian details updated');
    } catch {
      setActionError('Could not reach the API. Check that it is running.');
    } finally {
      setBusy(false);
    }
  }

  const linkedIds = new Set((guardian?.children ?? []).map((child) => child.learnerId));
  const linkable = (learners.data?.students ?? []).filter((student) => !linkedIds.has(student.id));

  async function link(learnerId: string) {
    if (!guardian) return;
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/parents/${guardian.id}/children`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId: learnerId }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setActionError(body?.error?.message ?? `The API refused the link (HTTP ${res.status}).`);
        return;
      }
      setLinking(null);
      refetch();
    } catch {
      setActionError('Could not reach the API. Check that it is running.');
    } finally {
      setBusy(false);
    }
  }

  async function unlink(linkId: string) {
    if (!guardian) return;
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/parents/${guardian.id}/children/${linkId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setActionError(body?.error?.message ?? `The API refused the removal (HTTP ${res.status}).`);
        return;
      }
      refetch();
    } catch {
      setActionError('Could not reach the API. Check that it is running.');
    } finally {
      setBusy(false);
    }
  }

  const childColumns: Array<DataTableColumn<LinkedLearner>> = [
    {
      id: 'name',
      header: 'Learner',
      cell: (row) => <span className="font-medium text-foreground">{row.name}</span>,
    },
    {
      id: 'grade',
      header: 'Class',
      cell: (row) => row.gradeLevel ?? <span className="text-muted-foreground">Unplaced</span>,
    },
    {
      id: 'email',
      header: 'Email',
      hideBelow: 'sm',
      cell: (row) => row.email,
    },
    ...(canManage
      ? [
          {
            id: 'actions',
            header: 'Actions',
            align: 'right' as const,
            cell: (row: LinkedLearner) => (
              <ConfirmButton
                label="Unlink"
                confirmLabel="Unlink learner"
                description={`${row.name} will no longer be linked to this guardian.`}
                onConfirm={() => unlink(row.linkId)}
                disabled={busy}
              />
            ),
          },
        ]
      : []),
  ];

  if (!canView) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Guardian" />
        <ErrorState
          title="You do not have access to guardian records"
          message="Viewing guardians requires parents.view. Your role does not hold it, and the API refuses the request independently of this screen."
        />
      </div>
    );
  }

  if (loading) return <LoadingState label="Loading the guardian record" />;

  if (error) {
    return (
      <ErrorState
        title="Could not load this guardian"
        message="GET /api/parents requires parents.view. Confirm the API is running and that your session still holds the permission."
      />
    );
  }

  if (!guardian) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Guardian" />
        <EmptyState
          title="Guardian not found"
          description="No guardian record matches this identifier."
          icon="users"
          action={
            <a
              href="/admin/parents"
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Back to Parents
            </a>
          }
        />
      </div>
    );
  }

  const name = displayName(guardian);

  const detailRows = [
    { field: 'Full name', value: name || '-' },
    { field: 'Email', value: guardian.email },
    { field: 'Phone', value: guardian.phone || '-' },
    { field: 'Account access', value: guardian.accountStatus },
    { field: 'Guardian since', value: formatDate(guardian.createdAt) },
    { field: 'Linked learners', value: String(guardian.children.length) },
    { field: 'Profile id', value: guardian.id, mono: true },
  ];

  // Compute guardian details content (edit form or view mode) before render
  const guardianDetailsContent = editing ? (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="firstName" className="text-sm font-medium text-foreground">
            First name
          </label>
          <Input
            id="firstName"
            value={formData.firstName}
            onChange={(e) => setFormData((prev) => ({ ...prev, firstName: e.target.value }))}
            placeholder="First name"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="lastName" className="text-sm font-medium text-foreground">
            Last name
          </label>
          <Input
            id="lastName"
            value={formData.lastName}
            onChange={(e) => setFormData((prev) => ({ ...prev, lastName: e.target.value }))}
            placeholder="Last name"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium text-foreground">
            Email
          </label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
            placeholder="Email"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="phone" className="text-sm font-medium text-foreground">
            Phone
          </label>
          <Input
            id="phone"
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
            placeholder="Phone number"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="status" className="text-sm font-medium text-foreground">
            Account status
          </label>
          <Select
            id="status"
            value={formData.status}
            onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
            className="h-9 min-w-[220px] flex-1 rounded-md border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="suspended">Suspended</option>
            <option value="archived">Archived</option>
          </Select>
        </div>
      </div>
      <div className="flex items-center gap-2 pt-2">
        <Button onClick={saveChanges} disabled={busy} className="w-full sm:w-auto">
          {busy ? 'Saving...' : 'Save changes'}
        </Button>
        <Button variant="outline" onClick={() => setEditing(false)} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  ) : (
    <div>
      <DataTable
        caption="Full guardian record"
        columns={[
          {
            id: 'field',
            header: 'Field',
            cell: (row: { field: string; value: string }) => row.field,
          },
          {
            id: 'value',
            header: 'Value',
            cell: (row: { field: string; value: string; mono?: boolean }) => (
              <span className={row.mono ? 'font-mono text-xs text-foreground' : undefined}>
                {row.value}
              </span>
            ),
          },
        ]}
        rows={detailRows}
        rowKey={(row) => row.field}
      />
      <div className="flex items-center gap-2 pt-4">
        {canManage && (
          <Button
            variant="outline"
            onClick={() => {
              setFormData({
                firstName: guardian?.firstName ?? '',
                lastName: guardian?.lastName ?? '',
                email: guardian?.email ?? '',
                phone: guardian?.phone ?? '',
                status: guardian?.accountStatus ?? 'active',
              });
              setEditing(true);
            }}
          >
            Edit details
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <SectionHeader
        title={name || 'Guardian'}
        description="Guardian record and the learners it is linked to. Identity and sign-in belong to the account, not to this profile."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/admin/users"
              className="rounded-md border border-input bg-background px-3.5 py-2 text-sm font-semibold transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Open account register
            </a>
            <a
              href="/admin/parents"
              className="rounded-md border border-input bg-background px-3.5 py-2 text-sm font-semibold transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Back to Parents
            </a>
          </div>
        }
      />

      <div className="flex items-center gap-4 rounded-lg border bg-card p-5">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-lg font-bold text-primary">
          {guardian.avatar ? (
            <span
              role="img"
              aria-label=""
              className="h-full w-full bg-cover bg-center"
              style={{ backgroundImage: `url(${guardian.avatar})` }}
            />
          ) : (
            initialsOf(name || guardian.email)
          )}
        </span>
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-foreground">{name || 'Unnamed'}</p>
          <p className="truncate text-sm text-muted-foreground">{guardian.email}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <StatusPill
              label={`access: ${guardian.accountStatus}`}
              tone={guardian.accountStatus === 'active' ? 'success' : 'warning'}
            />
            <StatusPill
              label={
                guardian.children.length === 1
                  ? '1 linked learner'
                  : `${guardian.children.length} linked learners`
              }
              tone={guardian.children.length > 0 ? 'brand' : 'warning'}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardCard
          title="Linked learners"
          value={guardian.children.length}
          icon="graduation-cap"
        />
        <DashboardCard title="Phone on file" value={guardian.phone ?? '-'} icon="phone" />
        <DashboardCard
          title="Can sign in"
          value={guardian.accountStatus === 'active' ? 'Yes' : 'No'}
          icon="shield-check"
          tone={guardian.accountStatus === 'active' ? 'success' : 'warning'}
        />
        <DashboardCard
          title="Guardian since"
          value={formatDate(guardian.createdAt)}
          icon="calendar"
        />
      </div>

      <section className="space-y-3" id="linked-learners">
        <h2 className="text-base font-semibold text-foreground">Linked learners</h2>

        <DataTable
          caption="Learners this guardian is linked to"
          columns={childColumns}
          rows={guardian.children}
          rowKey={(row) => row.linkId}
          empty={
            <EmptyState
              title="Not linked to any learner"
              description={
                canManage
                  ? 'Link a learner below so this guardian appears in the relevant learner and family views.'
                  : 'A school administrator links this guardian to their learners.'
              }
              icon="link"
            />
          }
        />

        {canManage ? (
          <SettingsCard
            title="Link a learner"
            description="Linking makes this guardian visible to the learner’s family context across the platform. The link records the relationship; it does not create an account or a learner."
          >
            {learners.loading ? (
              <LoadingState label="Loading learners" />
            ) : linkable.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Every learner in the directory is already linked to this guardian.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="learner" className="sr-only">
                  Select a learner
                </label>
                <select
                  id="learner"
                  value={linking ?? ''}
                  onChange={(event) => setLinking(event.target.value || null)}
                  className="h-9 min-w-[220px] flex-1 rounded-md border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Choose a learner…</option>
                  {linkable.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name ?? student.email}
                      {student.gradeLevel ? ` - ${student.gradeLevel}` : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => linking && link(linking)}
                  disabled={!linking || busy}
                  className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                >
                  {busy ? 'Linking…' : 'Link learner'}
                </button>
              </div>
            )}
          </SettingsCard>
        ) : null}
      </section>

      <SettingsCard
        title="Guardian details"
        description="Everything the guardian record resolves to. Name, email, phone and access are the account's fields."
      >
        {guardianDetailsContent}
      </SettingsCard>
    </div>
  );
}
