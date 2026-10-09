'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useApi } from '@schoolos/hooks';
import { useAuth } from '@schoolos/auth';
import {
  ActionButtons,
  ContextFilterBar,
  DashboardCard,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  NavIcon,
  SectionHeader,
  SettingsCard,
  StatusPill,
  TextInput,
  notify,
  type DataTableColumn,
  type StatusTone,
} from '@schoolos/ui';

/**
 * Academic Sessions - the school year and its academic periods.
 *
 * Reads `GET /api/academic-sessions`, which is the authoritative session system
 * the admin navbar also selects from, so a session managed here is the same
 * session every other module resolves.
 *
 * The Data Summary counts are computed server-side from live collections:
 * invoices by issue date, receipts by when they were received, and learners by
 * enrolment date, each falling inside the session's own date range. Nothing
 * here is a stored total or a placeholder.
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
  terms: Array<{
    id: string;
    name: string;
    termNumber: number;
    status: 'planned' | 'active' | 'completed';
  }>;
  data: {
    invoiceCount: number;
    receiptCount: number;
    learnerCount: number;
  };
}

interface SessionsResponse {
  sessions?: SessionRecord[];
}

const SESSION_TONE: Record<string, StatusTone> = {
  active: 'success',
  planned: 'info',
  completed: 'neutral',
  archived: 'neutral',
};

function formatDate(value?: string | null): string {
  if (!value) return '-';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? '-'
    : parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminAcademicSessionsPage() {
  const { can } = useAuth();
  const allowed = can('academics.view');

  const [query, setQuery] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [status, setStatus] = React.useState('');

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const params = new URLSearchParams({ sort: 'start_desc' });
  if (debounced) params.set('search', debounced);
  if (status) params.set('status', status);
  params.set('limit', '200');

  const { data, loading, error, refetch } = useApi<SessionsResponse>(
    allowed ? `/api/academic-sessions?${params.toString()}` : '/api/academic-sessions?denied=1'
  );

  // Create Session is inline rather than a separate screen: a session is four
  // fields, so making one in place is quicker than routing away and back.
  // ?create=1 opens the form, so a deep link from an empty state lands on it.
  const searchParams = useSearchParams();
  const [creating, setCreating] = React.useState(searchParams.get('create') === '1');
  const [newName, setNewName] = React.useState('');
  const [newLabel, setNewLabel] = React.useState('');
  const [newStart, setNewStart] = React.useState('');
  const [newEnd, setNewEnd] = React.useState('');
  const [newStatus, setNewStatus] = React.useState('planned');
  const [saving, setSaving] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);

  async function createSession() {
    setSaving(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/academic-sessions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          label: newLabel.trim() || undefined,
          startDate: newStart,
          endDate: newEnd,
          status: newStatus,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setCreateError(
          body?.error?.message ?? `Could not create the session (HTTP ${res.status}).`
        );
        return;
      }

      const created = (await res.json()) as { session: { name: string } };
      notify.success(`${created.session.name} created`);
      setCreating(false);
      setNewName('');
      setNewLabel('');
      setNewStart('');
      setNewEnd('');
      setNewStatus('planned');
      refetch();
    } catch {
      setCreateError('Could not reach the API. Check that it is running.');
    } finally {
      setSaving(false);
    }
  }

  const sessions = React.useMemo(() => data?.sessions ?? [], [data]);

  const active = sessions.filter((s) => s.status === 'active').length;
  const planned = sessions.filter((s) => s.status === 'planned').length;
  const totalTerms = sessions.reduce((sum, s) => sum + s.termCount, 0);

  const columns: Array<DataTableColumn<SessionRecord>> = [
    {
      id: 'identity',
      header: 'Session Identity',
      cell: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{row.label || row.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              <span className="font-mono">{row.name}</span>
              {' · '}
              {row.termCount === 1 ? '1 term' : `${row.termCount} terms`}
            </p>
          </div>
          {row.isActive ? <StatusPill label="Current" tone="success" /> : null}
        </div>
      ),
      sortValue: (row) => row.name,
    },
    {
      id: 'start',
      header: 'Start Date',
      cell: (row) => formatDate(row.startDate),
      sortValue: (row) => row.startDate,
    },
    {
      id: 'end',
      header: 'End Date',
      cell: (row) => formatDate(row.endDate),
      sortValue: (row) => row.endDate,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => <StatusPill label={row.status} tone={SESSION_TONE[row.status] ?? 'neutral'} />,
      sortValue: (row) => row.status,
    },
    {
      id: 'data',
      header: 'Data Summary',
      cell: (row) => (
        <div className="flex flex-wrap items-center gap-1">
          <span
            className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-foreground"
            title="Invoices issued within this session"
          >
            {row.data.invoiceCount} inv
          </span>
          <span
            className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-foreground"
            title="Payments received within this session"
          >
            {row.data.receiptCount} pay
          </span>
          <span
            className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-foreground"
            title="Learners placed in this session, or on the school's books and not yet placed in any session"
          >
            {row.data.learnerCount} learners
          </span>
        </div>
      ),
    },
  ];

  if (!allowed) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Academic Sessions" />
        <ErrorState
          title="You do not have access to academic configuration"
          message="Managing academic sessions requires academics.view to read and academics.manage to write. Your role does not hold them, and the API refuses the request independently of this screen."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Academic Sessions"
        description="The school’s academic sessions and their terms. The active session is what the navbar and every downstream module resolve."
        action={
          can('academics.manage') ? (
            <button
              type="button"
              onClick={() => setCreating((v) => !v)}
              aria-expanded={creating}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <NavIcon name={creating ? 'x' : 'plus'} className="h-4 w-4" />
              {creating ? 'Cancel' : 'Create Session'}
            </button>
          ) : null
        }
      />

      {creating ? (
        <SettingsCard
          title="Create academic session"
          description="A session is the school year everything else is measured against: assessments, attendance, reporting and fees all fall inside one. Terms are added once the session exists."
        >
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Session identifier" required hint="Unique in this school, e.g. 2026">
              <TextInput
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="2026"
              />
            </Field>
            <Field label="Display label" hint="Optional; falls back to the identifier">
              <TextInput
                value={newLabel}
                onChange={(event) => setNewLabel(event.target.value)}
                placeholder="2026 Academic Session"
              />
            </Field>
            <Field label="Status" hint="Activating completes whichever session is active">
              <select
                value={newStatus}
                onChange={(event) => setNewStatus(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="planned">Planned</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </Field>
            <Field label="Start date" required>
              <TextInput
                type="date"
                value={newStart}
                onChange={(event) => setNewStart(event.target.value)}
              />
            </Field>
            <Field
              label="End date"
              required
              error={
                newStart && newEnd && new Date(newEnd) <= new Date(newStart)
                  ? 'End date must be after the start date'
                  : undefined
              }
            >
              <TextInput
                type="date"
                value={newEnd}
                onChange={(event) => setNewEnd(event.target.value)}
              />
            </Field>
          </div>

          {createError ? (
            <div
              role="alert"
              className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {createError}
            </div>
          ) : null}

          <div className="mt-5 flex items-center gap-2">
            <button
              type="button"
              onClick={createSession}
              disabled={
                saving ||
                !newName.trim() ||
                !newStart ||
                !newEnd ||
                (Boolean(newStart) && Boolean(newEnd) && new Date(newEnd) <= new Date(newStart))
              }
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
            >
              {saving ? 'Creating…' : 'Create session'}
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setCreateError(null);
              }}
              className="rounded-md border border-input bg-background px-3.5 py-2 text-sm font-medium transition-colors hover:bg-accent"
            >
              Cancel
            </button>
          </div>
        </SettingsCard>
      ) : null}

      {loading ? (
        <LoadingState label="Loading academic sessions" />
      ) : error ? (
        <ErrorState
          title="Could not load academic sessions"
          message="GET /api/academic-sessions requires academics.view. Confirm the API is running and that your session still holds the permission."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <DashboardCard
              title="Sessions"
              value={sessions.length}
              icon="calendar-range"
              tone="accent"
              description={
                debounced || status ? 'Matching the current filters' : 'All sessions on record'
              }
            />
            <DashboardCard
              title="Current session"
              value={active === 1 ? (sessions.find((s) => s.isActive)?.name ?? '-') : active}
              icon="check"
              tone={active === 1 ? 'success' : 'warning'}
              description={
                active === 1
                  ? 'Resolved by the navbar and other modules'
                  : active === 0
                    ? 'No session is active'
                    : 'More than one session is active'
              }
            />
            <DashboardCard
              title="Planned"
              value={planned}
              icon="calendar-days"
              description="Not yet started"
            />
            <DashboardCard
              title="Terms defined"
              value={totalTerms}
              icon="layers"
              description="Across all sessions"
            />
          </div>

          {active === 0 && sessions.length > 0 ? (
            <p
              role="alert"
              className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300"
            >
              No session is active, so the navbar has nothing to select and assessments, attendance
              and reporting have no current period to resolve against. Activate one to restore that
              context.
            </p>
          ) : null}

          <DataTable
            caption="Academic sessions with their live data summary"
            columns={columns}
            rows={sessions}
            rowKey={(row) => row.id}
            pageSize={15}
            onRowClick={(row) => {
              window.location.href = `/admin/academics/years/${row.id}`;
            }}
            renderRowActions={(row) => (
              <ActionButtons
                items={[
                  {
                    id: 'view',
                    label: `View ${row.name}`,
                    href: `/admin/academics/years/${row.id}`,
                    icon: 'eye',
                  },
                  ...(can('academics.manage')
                    ? [
                        {
                          id: 'edit',
                          label: `Edit ${row.name}`,
                          href: `/admin/academics/years/${row.id}/edit`,
                          icon: 'pencil',
                        },
                        // Activating is offered only on a non-active session, and
                        // deactivating only on the active one. The API also
                        // demotes the previous session when one is activated.
                        ...(row.isActive
                          ? [
                              {
                                id: 'deactivate',
                                label: `Deactivate ${row.name}`,
                                href: `/admin/academics/years/${row.id}/edit?setStatus=completed`,
                                icon: 'circle-alert',
                              },
                            ]
                          : [
                              {
                                id: 'activate',
                                label: `Activate ${row.name}`,
                                href: `/admin/academics/years/${row.id}/edit?setStatus=active`,
                                icon: 'check',
                              },
                            ]),
                      ]
                    : []),
                ]}
              />
            )}
            toolbar={
              <ContextFilterBar
                search={{
                  value: query,
                  onChange: setQuery,
                  placeholder: 'Search by session name or label…',
                }}
                filters={[
                  {
                    id: 'status',
                    label: 'Status',
                    value: status,
                    options: [
                      { value: 'active', label: 'Active' },
                      { value: 'planned', label: 'Planned' },
                      { value: 'completed', label: 'Completed' },
                      { value: 'archived', label: 'Archived' },
                    ],
                    onChange: setStatus,
                    allLabel: 'All statuses',
                  },
                ]}
              />
            }
            empty={
              <EmptyState
                title={
                  sessions.length === 0 && !debounced && !status
                    ? 'No academic sessions yet'
                    : 'No sessions match these filters'
                }
                description={
                  sessions.length === 0 && !debounced && !status
                    ? 'Create the first session so the rest of the platform has a current period to resolve against.'
                    : 'Adjust the search or status filter above.'
                }
                icon="calendar-range"
              />
            }
          />

          <p className="text-xs text-muted-foreground">
            Data summary counts records whose own dates fall inside each session: invoices by issue
            date, payments by the day they were received, learners by enrolment date. A record
            outside every session&rsquo;s range is not counted by any of them.
          </p>
        </>
      )}
    </div>
  );
}
