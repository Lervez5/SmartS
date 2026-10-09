'use client';

import * as React from 'react';
import { useApi } from '@schoolos/hooks';
import { useAuth } from '@schoolos/auth';
import {
  ActionButtons,
  Button,
  ContextFilterBar,
  DashboardCard,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  FloatingFormModal,
  LoadingState,
  SectionHeader,
  Select,
  StatusPill,
  TextInput,
  initialsOf,
  notify,
  type DataTableColumn,
  type StatusTone,
} from '@schoolos/ui';

interface AcademicSession {
  id: string;
  name: string;
  label: string | null;
  startDate: string;
  endDate: string;
  status: string;
}

interface SessionOption {
  value: string;
  label: string;
}

interface ClassOption {
  id: string;
  name: string;
  code: string;
  label: string;
  gradeLevel: string | null;
  academicYearId: string | null;
  status: string;
}

interface StreamOption {
  id: string;
  name: string;
  code: string;
  parentClassId: string;
  parentClassName: string | null;
  parentGradeLevel: string | null;
  academicYearId: string | null;
  status: string;
}

interface PlacementRecord {
  id: string;
  studentId: string | null;
  userId: string | null;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  avatar: string | null;
  admissionId: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  enrollmentDate: string | null;
  gradeLevel: string | null;
  accountStatus: string;
  sourceAcademicYear: { id: string; name: string; label: string | null } | null;
  sourceClass: {
    id: string;
    name: string;
    classCode: string | null;
    gradeLevel: string | null;
  } | null;
  sourceStream: { id: string; name: string; code: string } | null;
  startDate: string;
}

interface PlacementsResponse {
  placements: PlacementRecord[];
  total: number;
}

const ACCOUNT_TONE: Record<string, StatusTone> = {
  active: 'success',
  pending: 'info',
  suspended: 'danger',
  archived: 'neutral',
};

const STATUS_TONE: Record<string, StatusTone> = {
  active: 'success',
  pending: 'info',
  suspended: 'danger',
  archived: 'neutral',
  inactive: 'warning',
};

function formatDate(value?: string | null): string {
  if (!value) return '-';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? '-'
    : parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function displayName(
  record: { name?: string | null; firstName?: string | null; lastName?: string | null } | null
): string {
  if (!record) return '';
  return record.name ?? [record.firstName, record.lastName].filter(Boolean).join(' ') ?? '';
}

function sessionLabel(s: { name: string; label: string | null }): string {
  return s.label ? `${s.name} - ${s.label}` : s.name;
}

export default function StudentTransitionsPage() {
  const { can } = useAuth();
  const canView = can('students.view');
  const canManage = can('academics.manage');

  const [sourceAcademicYearId, setSourceAcademicYearId] = React.useState('');
  const [sourceClassId, setSourceClassId] = React.useState('');
  const [sourceStreamId, setSourceStreamId] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [debounced, setDebounced] = React.useState('');

  const [targetAcademicYearId, setTargetAcademicYearId] = React.useState('');
  const [targetClassId, setTargetClassId] = React.useState('');
  const [targetStreamId, setTargetStreamId] = React.useState('');
  const [transitionReason, setTransitionReason] = React.useState('');
  const [transitionNotes, setTransitionNotes] = React.useState('');

  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [showTransitionModal, setShowTransitionModal] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const sessions = useApi<{ sessions: AcademicSession[] }>('/api/student-transitions/sessions');
  const sourceClasses = useApi<{ classes: ClassOption[] }>(
    sourceAcademicYearId
      ? `/api/student-transitions/classes?academicYearId=${sourceAcademicYearId}`
      : null
  );
  const sourceStreams = useApi<{ streams: StreamOption[] }>(
    sourceClassId ? `/api/student-transitions/streams?classId=${sourceClassId}` : null
  );
  const targetClasses = useApi<{ classes: ClassOption[] }>(
    targetAcademicYearId
      ? `/api/student-transitions/classes?academicYearId=${targetAcademicYearId}`
      : null
  );
  const targetStreams = useApi<{ streams: StreamOption[] }>(
    targetClassId ? `/api/student-transitions/streams?classId=${targetClassId}` : null
  );

  const placementsParams = new URLSearchParams();
  if (sourceAcademicYearId) placementsParams.set('sourceAcademicYearId', sourceAcademicYearId);
  if (sourceClassId) placementsParams.set('sourceClassId', sourceClassId);
  if (sourceStreamId) placementsParams.set('sourceStreamId', sourceStreamId);
  if (debounced) placementsParams.set('search', debounced);
  placementsParams.set('limit', '500');

  const placements = useApi<PlacementsResponse>(
    canView && sourceAcademicYearId
      ? `/api/student-transitions/placements?${placementsParams.toString()}`
      : null
  );

  const allSessions = React.useMemo(() => sessions.data?.sessions ?? [], [sessions.data]);
  const sourceClassOptions = React.useMemo(
    () => sourceClasses.data?.classes ?? [],
    [sourceClasses.data]
  );
  const sourceStreamOptions = React.useMemo(
    () => sourceStreams.data?.streams ?? [],
    [sourceStreams.data]
  );
  const targetClassOptions = React.useMemo(
    () => targetClasses.data?.classes ?? [],
    [targetClasses.data]
  );
  const targetStreamOptions = React.useMemo(
    () => targetStreams.data?.streams ?? [],
    [targetStreams.data]
  );

  const learnerCount = placements.data?.total ?? 0;

  React.useEffect(() => {
    if (sourceClassId && !sourceStreamId) {
      const stream = sourceStreamOptions.find((s) => s.parentClassId === sourceClassId);
      setSourceStreamId('');
    }
  }, [sourceClassId, sourceStreamOptions, sourceStreamId]);

  React.useEffect(() => {
    if (targetClassId && !targetStreamId) {
      setTargetStreamId('');
    }
  }, [targetClassId, targetStreamId]);

  const sessionOptions: SessionOption[] = allSessions.map((s) => ({
    value: s.id,
    label: sessionLabel(s),
  }));

  const selectedClass = targetClassOptions.find((c) => c.id === targetClassId);
  const selectedStream = targetStreamOptions.find((s) => s.id === targetStreamId);

  const allSelected =
    selectedIds.size > 0 && placements.data?.placements.every((p) => selectedIds.has(p.id));
  const someSelected = selectedIds.size > 0 && !allSelected;

  const transitionItems = placements.data?.placements.filter((p) => selectedIds.has(p.id)) ?? [];

  async function executeTransition() {
    if (transitionItems.length === 0) {
      notify.error('Select at least one learner to transition.');
      return;
    }
    if (!targetAcademicYearId || !targetClassId) {
      notify.error('Select a target Academic Session and Grade/Class.');
      return;
    }

    const studentIds = transitionItems
      .map((p) => p.userId ?? p.studentId)
      .filter(Boolean) as string[];

    setBusy(true);
    try {
      const res = await fetch('/api/student-transitions/placements/bulk', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentIds,
          targetAcademicYearId,
          targetClassId,
          ...(targetStreamId ? { targetStreamId } : {}),
          ...(transitionReason.trim() ? { reason: transitionReason.trim() } : {}),
          ...(transitionNotes.trim() ? { notes: transitionNotes.trim() } : {}),
        }),
      });

      const body = (await res.json().catch(() => null)) as {
        summary?: { total: number; succeeded: number; failed: number };
        results?: Array<{ studentId: string; success: boolean; error?: string }>;
        error?: { message?: string };
      } | null;

      if (!res.ok) {
        notify.error(body?.error?.message ?? `Transition failed (HTTP ${res.status}).`);
        return;
      }

      const failed = body?.results?.filter((r) => !r.success) ?? [];
      const succeeded = body?.summary?.succeeded ?? 0;

      if (failed.length > 0) {
        notify.error(
          `${succeeded} learner(s) transitioned. ${failed.length} failed: ${failed.map((f) => f.error ?? 'unknown').join('; ')}.`
        );
      } else {
        notify.success(
          `${succeeded} ${succeeded === 1 ? 'learner was' : 'learners were'} transitioned successfully.`
        );
      }

      setShowTransitionModal(false);
      setSelectedIds(new Set());
      setTransitionReason('');
      setTransitionNotes('');
      setTargetClassId('');
      setTargetStreamId('');
      placements.refetch();
    } catch {
      notify.error('Could not reach the API. Check that it is running.');
    } finally {
      setBusy(false);
    }
  }

  if (!canView) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Student Transitions" />
        <ErrorState
          title="You do not have access to student transitions"
          message="Viewing academic placements requires students.view. Your role does not hold it, and the API refuses the request independently of this screen."
        />
      </div>
    );
  }

  const columns: Array<DataTableColumn<PlacementRecord>> = [
    {
      id: 'select',
      header: '',
      cell: (row) => {
        const checked = selectedIds.has(row.id);
        return (
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => {
              const next = new Set(selectedIds);
              if (e.target.checked) {
                next.add(row.id);
              } else {
                next.delete(row.id);
              }
              setSelectedIds(next);
            }}
            className="h-4 w-4"
          />
        );
      },
      sortValue: () => 0,
    },
    {
      id: 'learner',
      header: 'Learner',
      cell: (row) => {
        const name = displayName(row);
        return (
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-bold text-muted-foreground">
              {row.avatar ? (
                <span
                  role="img"
                  aria-label=""
                  className="h-full w-full bg-cover bg-center"
                  style={{ backgroundImage: `url(${row.avatar})` }}
                />
              ) : (
                initialsOf(name || row.email)
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{name || 'Unnamed'}</p>
              <p className="truncate text-xs text-muted-foreground">
                <span className="font-mono">{row.admissionId}</span>
                {row.gradeLevel ? ` · ${row.gradeLevel}` : ''}
              </p>
            </div>
          </div>
        );
      },
      sortValue: (row) => displayName(row),
    },
    {
      id: 'source-placement',
      header: 'Current Placement',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-foreground">
            {row.sourceClass?.name ?? 'Not placed'}
            {row.sourceStream ? ` · Stream ${row.sourceStream.code}` : ''}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {row.sourceAcademicYear
              ? `${sessionLabel(row.sourceAcademicYear)} · ${formatDate(row.startDate)}`
              : '-'}
          </p>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => (
        <StatusPill label={row.accountStatus} tone={ACCOUNT_TONE[row.accountStatus] ?? 'neutral'} />
      ),
      sortValue: (row) => row.accountStatus,
    },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Student Transitions"
        description="Progress learners from one Academic Session, Grade/Class, and Stream into another. The previous placement is preserved as historical data."
      />

      <div className="space-y-4">
        <h3 className="text-sm font-medium text-foreground">Source Placement</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label
              className="block text-xs font-medium text-muted-foreground"
              htmlFor="source-session"
            >
              Academic Session
            </label>
            <Select
              value={sourceAcademicYearId}
              onChange={(e) => {
                setSourceAcademicYearId(e.target.value);
                setSourceClassId('');
                setSourceStreamId('');
              }}
              id="source-session"
            >
              <option value="">Select source session…</option>
              {sessionOptions.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label
              className="block text-xs font-medium text-muted-foreground"
              htmlFor="source-class"
            >
              Grade / Class
            </label>
            <Select
              value={sourceClassId}
              onChange={(e) => {
                setSourceClassId(e.target.value);
                setSourceStreamId('');
              }}
              id="source-class"
              disabled={!sourceAcademicYearId}
            >
              <option value="">All classes in session</option>
              {sourceClassOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label
              className="block text-xs font-medium text-muted-foreground"
              htmlFor="source-stream"
            >
              Stream
            </label>
            <Select
              value={sourceStreamId}
              onChange={(e) => setSourceStreamId(e.target.value)}
              id="source-stream"
              disabled={!sourceClassId}
            >
              <option value="">All streams</option>
              {sourceStreamOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      <DashboardCard
        title="Matching Learners"
        value={learnerCount}
        icon="users-round"
        tone="accent"
        description={
          sourceAcademicYearId
            ? `${sourceClasses.data?.classes.find((c) => c.id === sourceClassId)?.label ?? sessionLabel(allSessions.find((s) => s.id === sourceAcademicYearId) ?? { name: '', label: null })} · ${debounced ? `Search: "${debounced}"` : 'All learners in source'}`
            : 'Select a source Academic Session to see learners ready for progression'
        }
      />

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-foreground">Target Placement</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label
              className="block text-xs font-medium text-muted-foreground"
              htmlFor="target-session"
            >
              Target Academic Session
            </label>
            <Select
              value={targetAcademicYearId}
              onChange={(e) => {
                setTargetAcademicYearId(e.target.value);
                setTargetClassId('');
                setTargetStreamId('');
              }}
              id="target-session"
            >
              <option value="">Select target session…</option>
              {sessionOptions
                .filter((s) => s.value !== sourceAcademicYearId)
                .map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
            </Select>
          </div>
          <div>
            <label
              className="block text-xs font-medium text-muted-foreground"
              htmlFor="target-class"
            >
              Target Grade / Class
            </label>
            <Select
              value={targetClassId}
              onChange={(e) => {
                setTargetClassId(e.target.value);
                setTargetStreamId('');
              }}
              id="target-class"
              disabled={!targetAcademicYearId}
            >
              <option value="">Select target class…</option>
              {targetClassOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label
              className="block text-xs font-medium text-muted-foreground"
              htmlFor="target-stream"
            >
              Target Stream
            </label>
            <Select
              value={targetStreamId}
              onChange={(e) => setTargetStreamId(e.target.value)}
              id="target-stream"
              disabled={!targetClassId}
            >
              <option value="">None (no stream)</option>
              {targetStreamOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="flex items-end gap-3">
          <Field
            label="Transition Reason"
            hint="Optional - e.g. Promotion, Re-enrolment, Stream change"
          >
            <TextInput
              value={transitionReason}
              onChange={(e) => setTransitionReason(e.target.value)}
              placeholder="e.g. Annual promotion"
              className="w-64"
            />
          </Field>
          <Field label="Notes" hint="Optional - visible in the audit log">
            <TextInput
              value={transitionNotes}
              onChange={(e) => setTransitionNotes(e.target.value)}
              placeholder="Optional context…"
              className="w-64"
            />
          </Field>
        </div>
        <Button
          variant={canManage ? 'default' : 'default'}
          size="md"
          disabled={!canManage || selectedIds.size === 0 || !targetAcademicYearId || !targetClassId}
          onClick={() => setShowTransitionModal(true)}
        >
          {selectedIds.size > 0
            ? `Transition ${selectedIds.size} Learner${selectedIds.size > 1 ? 's' : ''}`
            : 'Transition Learners'}
        </Button>
      </div>

      {sourceAcademicYearId ? (
        <DataTable
          caption="Learners in source placement"
          columns={columns}
          rows={placements.data?.placements ?? []}
          rowKey={(row) => row.id}
          pageSize={25}
          toolbar={
            <ContextFilterBar
              search={{
                value: debounced,
                onChange: setSearch,
                placeholder: 'Search by name, admission number…',
              }}
              filters={[
                {
                  id: 'source-class',
                  label: 'Class',
                  value: sourceClassId,
                  options: sourceClassOptions.map((c) => ({ value: c.id, label: c.label })),
                  onChange: setSourceClassId,
                  allLabel: 'All classes',
                },
                {
                  id: 'source-stream',
                  label: 'Stream',
                  value: sourceStreamId,
                  options: sourceStreamOptions.map((s) => ({
                    value: s.id,
                    label: `${s.name} (${s.code})`,
                  })),
                  onChange: setSourceStreamId,
                  allLabel: 'All streams',
                },
              ]}
              actions={
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {selectedIds.size > 0 ? (
                    <>
                      <span>{selectedIds.size} selected</span>
                      <button
                        type="button"
                        onClick={() => setSelectedIds(new Set())}
                        className="underline"
                      >
                        Clear
                      </button>
                    </>
                  ) : null}
                </div>
              }
            />
          }
          empty={
            <EmptyState
              title={
                placements.data?.placements.length === 0 &&
                !debounced &&
                !sourceClassId &&
                !sourceStreamId
                  ? 'No learners found in this session'
                  : 'No learners match these filters'
              }
              description={
                placements.data?.placements.length === 0 &&
                !debounced &&
                !sourceClassId &&
                !sourceStreamId
                  ? 'Select a different Academic Session or check the class/stream filters.'
                  : 'Adjust the search or filters above.'
              }
              icon="users-round"
            />
          }
        />
      ) : (
        <div className="py-12 text-center">
          <EmptyState
            title="Select a source Academic Session"
            description="Choose the session learners are currently in to begin progressing them."
            icon="calendar"
          />
        </div>
      )}

      <FloatingFormModal
        isOpen={showTransitionModal}
        onClose={() => {
          setShowTransitionModal(false);
        }}
        title="Confirm Academic Transition"
        description="This creates a new enrollment for the target placement while preserving the learner's previous placement as historical data."
        icon="arrow-right-left"
        submitLabel="Confirm Transitions"
        isSubmitting={busy}
        onSubmit={executeTransition}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">From</p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {sessionLabel(
                  allSessions.find((s) => s.id === sourceAcademicYearId) ?? {
                    name: '-',
                    label: null,
                  }
                )}
              </p>
              {selectedClass && selectedClass?.gradeLevel ? (
                <p className="text-xs text-muted-foreground">
                  {sourceClassOptions.find((c) => c.id === sourceClassId)?.label ?? '-'}
                </p>
              ) : null}
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">To</p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {sessionLabel(
                  allSessions.find((s) => s.id === targetAcademicYearId) ?? {
                    name: '-',
                    label: null,
                  }
                )}
              </p>
              {selectedClass ? (
                <p className="text-xs text-muted-foreground">{selectedClass.label}</p>
              ) : null}
              {selectedStream ? (
                <p className="text-xs text-muted-foreground">
                  Stream: {selectedStream.name} ({selectedStream.code})
                </p>
              ) : null}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-foreground">
              {transitionItems.length} learner(s) selected
            </p>
            <div className="mt-2 max-h-40 overflow-y-auto">
              {transitionItems.map((p) => (
                <div key={p.id} className="flex items-center gap-2 py-1 text-sm">
                  <span className="w-5 text-center text-muted-foreground">•</span>
                  <span>{displayName(p)}</span>
                  <span className="text-xs text-muted-foreground">{p.admissionId}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
            <p className="font-medium">Historical academic records preserved</p>
            <p className="mt-1">
              Attendance, assessments, marks, results, and reports for the source session remain
              tied to the original placement. Future records will resolve from the target placement.
              The learner's permanent identity, admission number, parent links, documents, and
              Central Auth identity are never duplicated.
            </p>
          </div>
        </div>
      </FloatingFormModal>
    </div>
  );
}
