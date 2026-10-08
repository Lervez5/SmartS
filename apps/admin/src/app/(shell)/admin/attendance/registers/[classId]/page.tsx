'use client';

/**
 * Register — marking attendance for one class, optionally one stream.
 *
 * Built for a real class rather than a demo one. A class can hold fifty
 * learners or more and can be divided into many streams, so the roster is:
 *  - searchable, so a learner deep in the list is reachable without scrolling
 *  - paged, so the list stays usable at that size
 *  - bulk-markable: "everyone present" then adjust the exceptions is how a
 *    register is actually taken, and it is one request instead of fifty
 *
 * Marking all present fills every row in view, so a narrowed search cannot
 * silently mark only what happens to be showing.
 *
 * The platform records one attendance state per learner per class per day.
 * There is no morning/afternoon split in the schema, so none is offered here.
 */

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useApi } from '@schoolos/hooks';
import { useAuth } from '@schoolos/auth';
import {
  ConfirmButton,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  SectionHeader,
  Select,
  StatusPill,
  TextInput,
  notify,
  type DataTableColumn,
} from '@schoolos/ui';

type MarkStatus = 'present' | 'absent' | 'late' | 'excused' | 'sick' | 'on_leave';

const STATUSES: Array<{ value: MarkStatus; label: string }> = [
  { value: 'present', label: 'Present' },
  { value: 'absent', label: 'Absent' },
  { value: 'late', label: 'Late' },
  { value: 'excused', label: 'Excused' },
  { value: 'sick', label: 'Sick' },
  { value: 'on_leave', label: 'On leave' },
];

const STATUS_TONE: Record<string, 'success' | 'danger' | 'warning' | 'neutral' | 'info'> = {
  present: 'success',
  absent: 'danger',
  late: 'warning',
  excused: 'info',
  sick: 'warning',
  on_leave: 'neutral',
};

interface RosterLearner {
  id: string;
  name: string | null;
  email: string;
  avatar: string | null;
  attendance: { id: string; status: MarkStatus; note: string | null } | null;
}

interface RosterResponse {
  class: { id: string; name: string; subject: { id: string; name: string } | null };
  date: string;
  students: RosterLearner[];
}

interface StreamOption {
  id: string;
  name: string;
  code: string;
}

export default function AdminAttendanceRegisterPage() {
  const params = useParams();
  const router = useRouter();
  const classId = params?.classId as string | undefined;
  const streamId = params?.streamId as string | undefined;
  const { can } = useAuth();

  const canView = can('attendance.view');
  const canMark = can('attendance.mark');

  const [date, setDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [search, setSearch] = React.useState('');
  const [draft, setDraft] = React.useState<Record<string, MarkStatus>>({});
  const [saving, setSaving] = React.useState(false);
  const [hydratedFor, setHydratedFor] = React.useState<string | null>(null);

  const { data, loading, error, refetch } = useApi<RosterResponse>(
    canView && classId ? `/api/attendance/roster/${classId}?date=${date}` : null
  );

  // Streams belong to the class, so they are only fetched once one is known.
  const options = useApi<{
    classes: Array<{
      id: string;
      name: string;
      gradeLevel?: string | null;
      streams: StreamOption[];
    }>;
  }>(canView ? '/api/attendance/register-options' : null);

  const streams = options.data?.classes.find((c) => c.id === classId)?.streams ?? [];

  const learners = React.useMemo(() => data?.students ?? [], [data]);
  const key = `${classId}:${streamId ?? 'all'}:${date}`;

  // Only adopted for a new context, so a re-render never discards marks in
  // progress.
  React.useEffect(() => {
    if (!data) return;
    if (hydratedFor === key) return;
    const seeded: Record<string, MarkStatus> = {};
    for (const learner of learners) {
      if (learner.attendance) seeded[learner.id] = learner.attendance.status;
    }
    setDraft(seeded);
    setHydratedFor(key);
  }, [data, learners, hydratedFor, key]);

  const visible = React.useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return learners;
    return learners.filter(
      (learner) =>
        (learner.name ?? '').toLowerCase().includes(needle) ||
        learner.email.toLowerCase().includes(needle)
    );
  }, [learners, search]);

  const dirty = React.useMemo(() => {
    if (hydratedFor !== key) return false;
    return learners.some((learner) => {
      const current = draft[learner.id];
      const original = learner.attendance?.status;
      return current !== undefined && current !== original;
    });
  }, [learners, draft, hydratedFor, key]);

  const total = learners.length;
  const marked = learners.filter((l) => draft[l.id] ?? l.attendance?.status).length;
  const unmarked = total - marked;

  function setAll(status: MarkStatus) {
    const next: Record<string, MarkStatus> = { ...draft };
    // Every learner in the class, not just the filtered page: a narrowed search
    // must not silently mark only what is on screen.
    for (const learner of learners) next[learner.id] = status;
    setDraft(next);
  }

  async function save(submit: boolean) {
    if (!classId) return;
    setSaving(true);
    try {
      const res = await fetch('/api/attendance/mark', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId,
          date,
          submit,
          records: learners.map((learner) => ({
            studentId: learner.id,
            status: draft[learner.id] ?? learner.attendance?.status ?? 'present',
          })),
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        notify.error(body?.error?.message ?? `Could not save the register (HTTP ${res.status}).`);
        return;
      }

      const body = (await res.json()) as { saved: number };
      notify.success(
        `${body.saved} learner${body.saved === 1 ? '' : 's'} recorded for ${data?.class.name ?? 'the class'}`
      );
      setHydratedFor(null);
      refetch();
      router.refresh();
    } catch {
      notify.error('Could not reach the API. Check that it is running.');
    } finally {
      setSaving(false);
    }
  }

  const columns: Array<DataTableColumn<RosterLearner>> = [
    {
      id: 'learner',
      header: 'Learner',
      cell: (row) => (
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-[11px] font-bold text-primary">
            {row.avatar ? (
              <span
                role="img"
                aria-label=""
                className="h-full w-full bg-cover bg-center"
                style={{ backgroundImage: `url(${row.avatar})` }}
              />
            ) : (
              initials(row.name ?? row.email)
            )}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{row.name ?? 'Unnamed'}</p>
            <p className="truncate text-xs text-muted-foreground">{row.email}</p>
          </div>
        </div>
      ),
      sortValue: (row) => row.name ?? row.email,
    },
    {
      id: 'status',
      header: 'Attendance',
      align: 'right',
      cell: (row) => {
        const value = draft[row.id] ?? row.attendance?.status;
        return (
          <select
            value={value ?? ''}
            disabled={!canMark}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, [row.id]: event.target.value as MarkStatus }))
            }
            aria-label={`Attendance for ${row.name ?? row.email}`}
            className="h-9 rounded-md border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          >
            <option value="">Not marked</option>
            {STATUSES.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        );
      },
    },
    {
      id: 'saved',
      header: 'Saved',
      align: 'right',
      hideBelow: 'sm',
      cell: (row) => {
        if (!row.attendance) return <span className="text-muted-foreground">New</span>;
        return (
          <StatusPill
            label={row.attendance.status.replace(/_/g, ' ')}
            tone={STATUS_TONE[row.attendance.status] ?? 'neutral'}
          />
        );
      },
    },
  ];

  if (!canView) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Attendance Register" />
        <ErrorState
          title="You do not have access to attendance"
          message="Viewing registers requires attendance.view. Your role does not hold it, and the API refuses the request independently of this screen."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title={data?.class.name ? `${data.class.name} register` : 'Attendance Register'}
        description={`${formatDay(date)}${streamId ? ' · one stream' : ' · whole class'}`}
        action={
          canMark ? (
            <div className="flex flex-wrap items-center gap-2">
              {dirty ? (
                <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                  Unsaved marks
                </span>
              ) : null}
              <ConfirmButton
                label="Save register"
                confirmLabel="Save all"
                description={`${total} learner${total === 1 ? '' : 's'} will be recorded.`}
                onConfirm={() => save(false)}
                variant="default"
                size="md"
                icon="check"
                disabled={!dirty || saving}
              />
            </div>
          ) : null
        }
      />

      {loading ? (
        <LoadingState label="Loading the register" />
      ) : error ? (
        <ErrorState
          title="Could not load the register"
          message="The roster could not be read. Confirm the API is running and that you are assigned to this class."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 rounded-lg border bg-card p-5 md:grid-cols-4">
            <Field label="Date">
              <TextInput
                type="date"
                value={date}
                onChange={(event) => {
                  setDate(event.target.value);
                  setHydratedFor(null);
                }}
              />
            </Field>

            <Field label="Class">
              <Select
                value={classId ?? ''}
                onChange={(event) =>
                  router.push(`/admin/attendance/registers/${event.target.value}`)
                }
              >
                <option value="">Choose a class…</option>
                {(options.data?.classes ?? []).map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {[cls.name, cls.gradeLevel].filter(Boolean).join(' — ')}
                  </option>
                ))}
              </Select>
            </Field>

            {/* A class can hold many streams; the register can be narrowed to
                one without becoming a different class. */}
            <Field label="Stream" hint="Narrows the roster, not the register">
              <Select
                value={streamId ?? ''}
                onChange={(event) =>
                  router.push(
                    event.target.value
                      ? `/admin/attendance/registers/${classId}/streams/${event.target.value}`
                      : `/admin/attendance/registers/${classId}`
                  )
                }
                disabled={streams.length === 0}
              >
                <option value="">
                  {streams.length === 0 ? 'This class has no streams' : 'Whole class'}
                </option>
                {streams.map((stream) => (
                  <option key={stream.id} value={stream.id}>
                    {stream.name}
                    {stream.code ? ` (${stream.code})` : ''}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="flex items-end">
              <div className="w-full rounded-md border border-muted bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{total}</span> in class
                {total === 1 ? '' : ''}
                <span className="block text-xs">
                  {marked} marked{unmarked > 0 ? ` · ${unmarked} to go` : ' · complete'}
                </span>
              </div>
            </div>
          </div>

          {canMark ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-4 py-3">
              <span className="text-sm text-muted-foreground">Mark everyone</span>
              {STATUSES.slice(0, 3).map((status) => (
                <button
                  key={status.value}
                  type="button"
                  onClick={() => setAll(status.value)}
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {status.label}
                </button>
              ))}
              <span className="text-xs text-muted-foreground">then adjust anyone who differs</span>
            </div>
          ) : null}

          <DataTable
            caption={`Register for ${data?.class.name ?? ''}`}
            columns={columns}
            rows={visible}
            rowKey={(row) => row.id}
            pageSize={25}
            toolbar={
              <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
                <div className="min-w-[220px] flex-1">
                  <label
                    htmlFor="roster-search"
                    className="mb-1 block text-xs font-medium text-muted-foreground"
                  >
                    Search the roster
                  </label>
                  <TextInput
                    id="roster-search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={`Search ${total} learners…`}
                  />
                </div>
                <p className="pb-2 text-xs text-muted-foreground">
                  {visible.length === total
                    ? `${total} learners`
                    : `${visible.length} of ${total} shown`}
                </p>
              </div>
            }
            empty={
              <EmptyState
                title={search ? 'No learner matches that search' : 'Nobody enrolled in this class'}
                description={
                  search
                    ? 'Clear the search to see the whole register.'
                    : 'Enrol learners into the class before taking its register.'
                }
                icon={search ? 'search' : 'graduation-cap'}
              />
            }
          />

          <p className="text-xs text-muted-foreground">
            One attendance state is recorded per learner per class per day — the schema has no
            morning and afternoon sessions, so none are offered. Marks are saved for every learner
            in the class at once, so a register of any size is one request.
          </p>
        </>
      )}
    </div>
  );
}

function initials(value: string): string {
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function formatDay(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString(undefined, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
}
