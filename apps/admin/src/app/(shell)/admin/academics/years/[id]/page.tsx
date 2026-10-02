'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useApi } from '@schoolos/hooks';
import { useAuth } from '@schoolos/auth';
import {
  ConfirmButton,
  DashboardCard,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  SectionHeader,
  Select,
  SettingsCard,
  StatusPill,
  TextInput,
  initialsOf,
  type DataTableColumn,
} from '@schoolos/ui';

/**
 * A single academic session and its terms.
 *
 * The session and its terms stay distinct records: the session is the year the
 * navbar selects, while a term is the academic period assessments and
 * attendance run within. Terms therefore get their own management here rather
 * than being flattened into the session.
 */
interface SessionRecord {
  id: string;
  name: string;
  label?: string | null;
  startDate: string;
  endDate: string;
  status: 'planned' | 'active' | 'completed' | 'archived';
  isActive: boolean;
  terms: Array<{
    id: string;
    name: string;
    termNumber: number;
    status: 'planned' | 'active' | 'completed';
    startDate: string;
    endDate: string;
  }>;
  data: {
    invoiceCount: number;
    receiptCount: number;
    learnerCount: number;
  };
}

interface TermPayload {
  id: string;
  name: string;
  termNumber: number;
  status: string;
  startDate: string;
  endDate: string;
}

const SESSION_TONE = {
  active: 'success',
  planned: 'info',
  completed: 'neutral',
  archived: 'neutral',
} as const;

const TERM_TONE = {
  active: 'success',
  planned: 'info',
  completed: 'neutral',
} as const;

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? '—'
    : parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function toInputDate(value?: string | null): string {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

export default function AdminAcademicSessionDetailPage() {
  const params = useParams();
  const sessionId = params?.id as string | undefined;
  const { can } = useAuth();
  const allowed = can('academics.view');
  const canManage = can('academics.manage');

  // Addressed by id, so a session can be inspected without activating it.
  const { data, loading, error, refetch } = useApi<{ session: SessionRecord | null }>(
    allowed ? `/api/academic-sessions/${sessionId}` : '/api/academic-sessions?denied=1'
  );

  const session = data?.session ?? null;

  const [name, setName] = React.useState('');
  const [termNumber, setTermNumber] = React.useState('1');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [termError, setTermError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<string | null>(null);

  const router = useRouter();

  const nextTermNumber = React.useMemo(() => {
    const numbers = (session?.terms ?? []).map((t) => t.termNumber);
    return numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
  }, [session]);

  React.useEffect(() => {
    setTermNumber(String(nextTermNumber));
  }, [nextTermNumber]);

  async function addTerm() {
    if (!session) return;
    setSaving(true);
    setTermError(null);
    setDone(null);
    try {
      const res = await fetch(`/api/academic-sessions/${session.id}/terms`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || `Term ${termNumber}`,
          termNumber: Number(termNumber),
          startDate,
          endDate,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setTermError(body?.error?.message ?? `The API refused the term (HTTP ${res.status}).`);
        return;
      }

      setDone(`Term ${termNumber} added to ${session.name}.`);
      setName('');
      setStartDate('');
      setEndDate('');
      void refetch();
      router.refresh();
    } catch {
      setTermError('Could not reach the API. Check that it is running.');
    } finally {
      setSaving(false);
    }
  }

  async function removeTerm(term: TermPayload) {
    if (!session) return;
    setTermError(null);
    const res = await fetch(`/api/academic-sessions/${session.id}/terms/${term.id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      setTermError(body?.error?.message ?? `The API refused the removal (HTTP ${res.status}).`);
      return;
    }
    void refetch();
    router.refresh();
  }

  const columns: Array<DataTableColumn<TermPayload>> = [
    {
      id: 'term',
      header: 'Term',
      cell: (row) => (
        <span className="flex items-center gap-2">
          <span className="font-medium text-foreground">{row.name}</span>
          <span className="text-xs text-muted-foreground">#{row.termNumber}</span>
        </span>
      ),
      sortValue: (row) => row.termNumber,
    },
    {
      id: 'start',
      header: 'Start',
      cell: (row) => formatDate(row.startDate),
    },
    {
      id: 'end',
      header: 'End',
      cell: (row) => formatDate(row.endDate),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => (
        <StatusPill
          label={row.status}
          tone={TERM_TONE[row.status as keyof typeof TERM_TONE] ?? 'neutral'}
        />
      ),
    },
    ...(canManage
      ? [
          {
            id: 'actions',
            header: 'Actions',
            align: 'right' as const,
            cell: (row: TermPayload) =>
              // Only a planned term is removable: once a term has been active it
              // has attendance, assessment and finance activity against it.
              row.status === 'planned' ? (
                <ConfirmButton
                  label="Remove"
                  confirmLabel="Remove term"
                  description={`${row.name} will be deleted.`}
                  onConfirm={() => removeTerm(row)}
                />
              ) : (
                <span className="text-xs text-muted-foreground">Complete instead</span>
              ),
          },
        ]
      : []),
  ];

  if (!allowed) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Academic Session" />
        <ErrorState
          title="You do not have access to academic configuration"
          message="Viewing academic sessions requires academics.view. Your role does not hold it, and the API refuses the request independently of this screen."
        />
      </div>
    );
  }

  if (loading) return <LoadingState label="Loading the academic session" />;

  if (error) {
    return (
      <ErrorState
        title="Could not load the academic session"
        message="GET /api/academic-sessions requires academics.view. Confirm the API is running and that your session still holds the permission."
      />
    );
  }

  if (!session) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Academic Session" />
        <EmptyState
          title="No active academic session"
          description="The platform resolves the current session from the active record, and none is active. Create or activate a session to establish one."
          icon="calendar-range"
          action={
            canManage ? (
              <a
                href="/admin/academics/years/new"
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Create Session
              </a>
            ) : null
          }
        />
        <a
          href="/admin/academics/years"
          className="text-sm font-medium text-primary hover:underline"
        >
          View all sessions
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title={session.label || session.name}
        description={`Academic session ${session.name}, running ${formatDate(session.startDate)} to ${formatDate(session.endDate)}.`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {canManage ? (
              <a
                href={`/admin/academics/years/${session.id}/edit`}
                className="rounded-md border border-input bg-background px-3.5 py-2 text-sm font-semibold transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Edit session
              </a>
            ) : null}
            <a
              href="/admin/academics/years"
              className="rounded-md border border-input bg-background px-3.5 py-2 text-sm font-semibold transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              All sessions
            </a>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardCard
          title="Session status"
          value={session.status}
          icon="calendar-range"
          tone={
            session.status === 'active'
              ? 'success'
              : session.status === 'planned'
                ? 'accent'
                : 'default'
          }
        />
        <DashboardCard
          title="Terms"
          value={session.terms.length}
          icon="layers"
          description={`${session.terms.length} defined`}
        />
        <DashboardCard
          title="Learners enrolled"
          value={session.data.learnerCount}
          icon="graduation-cap"
          description="Within this session"
        />
        <DashboardCard
          title="Invoices / payments"
          value={`${session.data.invoiceCount} / ${session.data.receiptCount}`}
          icon="receipt"
          description="Issued / received in range"
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">Terms</h2>
        <DataTable
          caption={`Academic terms within ${session.name}`}
          columns={columns}
          rows={session.terms}
          rowKey={(row) => row.id}
          empty={
            <EmptyState
              title="No terms defined"
              description="Terms are the academic periods assessments and attendance run within. Add the first one below."
              icon="calendar-days"
            />
          }
        />
      </section>

      {canManage ? (
        <SettingsCard
          title="Add a term"
          description="Terms belong to this session and keep their own dates, so they are not collapsed into the session record."
        >
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
            <Field label="Term name">
              <TextInput
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={`Term ${nextTermNumber}`}
              />
            </Field>
            <Field label="Term number">
              <TextInput
                type="number"
                min={1}
                max={12}
                value={termNumber}
                onChange={(event) => setTermNumber(event.target.value)}
              />
            </Field>
            <Field label="Start date">
              <TextInput
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </Field>
            <Field label="End date">
              <TextInput
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </Field>
          </div>

          {termError ? (
            <div
              role="alert"
              className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {termError}
            </div>
          ) : null}

          {done ? (
            <div className="mt-4 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
              {done}
            </div>
          ) : null}

          <button
            type="button"
            onClick={addTerm}
            disabled={saving || !startDate || !endDate}
            className="mt-5 inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            {saving ? 'Adding…' : 'Add term'}
          </button>
          {!startDate || !endDate ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Both dates are required; the API rejects an end date that is not after the start.
            </p>
          ) : null}
        </SettingsCard>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Activating a different session completes whichever session is currently active, so exactly
        one session is ever resolved as current by the navbar and the other modules.
      </p>
    </div>
  );
}
