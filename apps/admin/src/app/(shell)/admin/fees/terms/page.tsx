'use client';

import * as React from 'react';
import { useApi } from '@schoolos/hooks';
import { useAuth } from '@schoolos/auth';
import {
  DataTable,
  DashboardCard,
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
} from '@schoolos/ui';

/**
 * Academic Terms, listed under Fee Configuration.
 *
 * Terms belong to an academic session and are managed on the session itself -
 * this screen lists them together, because fee configuration needs the whole
 * set at once: a charge is applied per term, so deciding what a learner owes
 * means knowing every term the session has.
 *
 * Terms are not duplicated here. Adding one posts to the owning session's term
 * route, which is the same call the session screen makes.
 */
interface Term {
  id: string;
  name: string;
  termNumber: number;
  startDate: string;
  endDate: string;
  status: 'planned' | 'active' | 'completed';
}interface SessionRow {
  id: string;
  name: string;
  label?: string | null;
  status: string;
  termCount?: number;
  terms: Term[];
}

interface SessionsResponse {
  sessions?: SessionRow[];
}

function formatDate(value?: string): string {
  if (!value) return '-';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? '-'
    : parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysBetween(start?: string, end?: string): number | null {
  if (!start || !end) return null;
  const from = new Date(start).getTime();
  const to = new Date(end).getTime();
  if (Number.isNaN(from) || Number.isNaN(to) || to <= from) return null;
  return Math.round((to - from) / 86400000);
}

const TERM_TONE = { planned: 'info', active: 'success', completed: 'neutral' } as const;

export default function AdminFeeTermsPage() {
  const { can } = useAuth();
  const allowed = can('academics.view');
  const canManage = can('academics.manage');

  const { data, loading, error, refetch } = useApi<SessionsResponse>(
    allowed ? '/api/academic-sessions?limit=100' : '/api/academic-sessions?denied=1'
  );

  const sessions = React.useMemo(() => data?.sessions ?? [], [data]);
  const terms = React.useMemo(
    () => sessions.flatMap((session) => session.terms.map((term) => ({ ...term, session }))),
    [sessions]
  );

  const [sessionId, setSessionId] = React.useState('');
  const [termName, setTermName] = React.useState('');
  const [termNumber, setTermNumber] = React.useState('');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);

  // Inline term editing — tracks which term row is open in edit mode and
  // holds the working copy of the values the admin is adjusting.
  const [editingTermId, setEditingTermId] = React.useState<string | null>(null);
  const [editForm, setEditForm] = React.useState<{ startDate: string; endDate: string; status: string }>({
    startDate: '',
    endDate: '',
    status: '',
  });
  const [editError, setEditError] = React.useState<string | null>(null);
  const [savingTerm, setSavingTerm] = React.useState(false);

  // Defaults to the session with the fewest terms, so the next term number
  // follows from what already exists.
  React.useEffect(() => {
    if (sessionId || sessions.length === 0) return;
    const fewest = [...sessions].sort((a, b) => (a.terms?.length ?? 0) - (b.terms?.length ?? 0))[0];
    if (fewest) {
      setSessionId(fewest.id);
      setTermNumber(String((fewest.terms?.length ?? 0) + 1));
    }
  }, [sessions, sessionId]);

  async function addTerm() {
    if (!sessionId) return;
    setSaving(true);
    setCreateError(null);
    try {
      const res = await fetch(`/api/academic-sessions/${sessionId}/terms`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: termName.trim() || `Term ${termNumber}`,
          termNumber: Number(termNumber),
          startDate,
          endDate,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setCreateError(body?.error?.message ?? `Could not add the term (HTTP ${res.status}).`);
        return;
      }

      notify.success(`Term ${termNumber} added`);
      setTermName('');
      setStartDate('');
      setEndDate('');
      setTermNumber(String(Number(termNumber) + 1));
      refetch();
    } catch {
      setCreateError('Could not reach the API. Check that it is running.');
    } finally {
      setSaving(false);
    }
  }

  function startEdit(term: (typeof terms)[number]) {
    setEditingTermId(term.id);
    setEditForm({
      startDate: term.startDate ? term.startDate.slice(0, 10) : '',
      endDate: term.endDate ? term.endDate.slice(0, 10) : '',
      status: term.status,
    });
    setEditError(null);
  }

  function cancelEdit() {
    setEditingTermId(null);
    setEditError(null);
  }

  async function updateTerm(term: (typeof terms)[number]) {
    const hasChanges =
      (editForm.startDate ? editForm.startDate.slice(0, 10) : '') !==
        (term.startDate ? term.startDate.slice(0, 10) : '') ||
      (editForm.endDate ? editForm.endDate.slice(0, 10) : '') !==
        (term.endDate ? term.endDate.slice(0, 10) : '') ||
      editForm.status !== term.status;

    if (!hasChanges) {
      setEditingTermId(null);
      return;
    }

    const startValue = editForm.startDate;
    const endValue = editForm.endDate;
    if (startValue && endValue && new Date(endValue) <= new Date(startValue)) {
      setEditError('End date must be after the start date.');
      return;
    }

    setSavingTerm(true);
    setEditError(null);
    try {
      const res = await fetch(
        `/api/academic-sessions/${term.session.id}/terms/${term.id}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            startDate: startValue || undefined,
            endDate: endValue || undefined,
            status: editForm.status as 'planned' | 'active' | 'completed' | undefined,
          }),
        }
      );

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setEditError(body?.error?.message ?? `Could not update the term (HTTP ${res.status}).`);
        return;
      }

      notify.success(`Term ${term.termNumber} updated`);
      setEditingTermId(null);
      refetch();
    } catch {
      setEditError('Could not reach the API. Check that it is running.');
    } finally {
      setSavingTerm(false);
    }
  }

  const columns: Array<DataTableColumn<(typeof terms)[number]>> = [
    {
      id: 'term',
      header: 'Term',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{row.name}</p>
          <p className="truncate text-xs text-muted-foreground">Term {row.termNumber}</p>
        </div>
      ),
      sortValue: (row) => row.termNumber,
    },
    {
      id: 'session',
      header: 'Academic Session',
      cell: (row) => (
        <span className="text-sm text-foreground">{row.session.label ?? row.session.name}</span>
      ),
      sortValue: (row) => row.session.name,
    },
    {
      id: 'period',
      header: 'Period',
      cell: (row) => {
        if (editingTermId === row.id) {
          const startValue = editForm.startDate ? editForm.startDate.slice(0, 10) : '';
          const endValue = editForm.endDate ? editForm.endDate.slice(0, 10) : '';
          const invalidRange =
            startValue && endValue && new Date(endValue) <= new Date(startValue);
          return (
            <div className="flex flex-col gap-2">
              <TextInput
                type="date"
                value={startValue}
                onChange={(event) => setEditForm((prev) => ({ ...prev, startDate: event.target.value }))}
                error={invalidRange ? 'End date must be after the start date' : undefined}
              />
              <TextInput
                type="date"
                value={endValue}
                onChange={(event) => setEditForm((prev) => ({ ...prev, endDate: event.target.value }))}
                error={invalidRange ? 'End date must be after the start date' : undefined}
              />
            </div>
          );
        }
        return (
          <div className="min-w-0">
            <p className="truncate text-sm text-foreground">
              {formatDate(row.startDate)} – {formatDate(row.endDate)}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {daysBetween(row.startDate, row.endDate) !== null
                ? `${daysBetween(row.startDate, row.endDate)} days`
                : '-'}
            </p>
          </div>
        );
      },
      hideBelow: 'sm',
      sortValue: (row) => row.startDate,
    },
    {
      id: 'status',
      header: 'Status',
      align: 'right',
      cell: (row) => {
        if (editingTermId === row.id) {
          return (
            <select
              value={editForm.status}
              onChange={(event) => setEditForm((prev) => ({ ...prev, status: event.target.value }))}
              className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="planned">Planned</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          );
        }
        return <StatusPill label={row.status} tone={TERM_TONE[row.status] ?? 'neutral'} />;
      },
      sortValue: (row) => row.status,
    },
  ];

  if (!allowed) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Academic Terms" />
        <ErrorState
          title="You do not have access to academic configuration"
          message="Viewing terms requires academics.view. Your role does not hold it, and the API refuses the request independently of this screen."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Academic Terms"
        description="The terms a session is divided into. Fee configuration needs the whole set, because a charge is applied per term."
      />

      {loading ? (
        <LoadingState label="Loading terms" />
      ) : error ? (
        <ErrorState
          title="Could not load terms"
          message="GET /api/academic-sessions requires academics.view. Confirm the API is running and that your session still holds the permission."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <DashboardCard
              title="Terms"
              value={terms.length}
              icon="calendar-range"
              tone="accent"
              description={`Across ${sessions.length} session${sessions.length === 1 ? '' : 's'}`}
            />
            <DashboardCard
              title="Active"
              value={terms.filter((t) => t.status === 'active').length}
              icon="check"
              tone="success"
            />
            <DashboardCard
              title="Sessions without terms"
              value={sessions.filter((s) => (s.terms?.length ?? 0) === 0).length}
              icon="triangle-alert"
              tone={sessions.some((s) => (s.terms?.length ?? 0) === 0) ? 'warning' : 'success'}
            />
          </div>

          {canManage ? (
            <SettingsCard
              title="Add a term"
              description="Terms belong to an academic session. This posts to that session, so the term appears on both screens."
            >
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                <Field label="Academic session" required>
                  <select
                    value={sessionId}
                    onChange={(event) => {
                      setSessionId(event.target.value);
                      const target = sessions.find((s) => s.id === event.target.value);
                      setTermNumber(String((target?.terms?.length ?? 0) + 1));
                    }}
                    className="h-10 w-full rounded-md border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Choose a session…</option>
                    {sessions.map((session) => (
                      <option key={session.id} value={session.id}>
                        {session.label ?? session.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Term number" required hint="Unique within the session">
                  <TextInput
                    type="number"
                    min={1}
                    max={12}
                    value={termNumber}
                    onChange={(event) => setTermNumber(event.target.value)}
                    placeholder="1"
                  />
                </Field>
                <Field label="Term name" hint="Optional">
                  <TextInput
                    value={termName}
                    onChange={(event) => setTermName(event.target.value)}
                    placeholder="Term 1"
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
                  error={
                    startDate && endDate && new Date(endDate) <= new Date(startDate)
                      ? 'End date must be after the start date'
                      : undefined
                  }
                >
                  <TextInput
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
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
                  onClick={addTerm}
                  disabled={saving || !sessionId || !termNumber || !startDate || !endDate}
                  className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                >
                  {saving ? 'Adding…' : 'Add term'}
                </button>
              </div>
            </SettingsCard>
          ) : null}

          <DataTable
            caption="Academic terms across sessions"
            columns={columns}
            rows={terms}
            rowKey={(row) => row.id}
            pageSize={15}
            empty={
              <EmptyState
                title="No terms defined"
                description="A session with no terms cannot carry a per-term charge. Add the first one above."
                icon="calendar-range"
              />
            }
            renderRowActions={canManage ? (row) => {
              if (editingTermId === row.id) {
                return (
                  <div className="flex items-center gap-1">
                    {editError ? (
                      <span
                        role="alert"
                        className="mr-2 text-xs text-destructive"
                        title={editError}
                      >
                        Error
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => updateTerm(row)}
                      disabled={savingTerm}
                      className="rounded-md border border-input bg-background px-2 py-1 text-xs font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                    >
                      {savingTerm ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      disabled={savingTerm}
                      className="rounded-md border border-input bg-background px-2 py-1 text-xs font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                );
              }
              return (
                <button
                  type="button"
                  onClick={() => startEdit(row)}
                  className="rounded-md border border-input bg-background px-2 py-1 text-xs font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  title="Edit term"
                >
                  <NavIcon name="pencil" className="h-3.5 w-3.5" />
                </button>
              );
            } : undefined}
          />

          <p className="text-xs text-muted-foreground">
            <NavIcon name="info" className="mr-1 inline h-3 w-3" />A term is not removed from here -
            complete it on the session record instead, so attendance and assessment already recorded
            against it are preserved.
          </p>
        </>
      )}
    </div>
  );
}
