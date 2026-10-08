'use client';

import * as React from 'react';
import { useApi } from '@schoolos/hooks';
import { useAuth } from '@schoolos/auth';
import {
  ActionButtons,
  ConfirmButton,
  ContextFilterBar,
  DashboardCard,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  PrimaryActionButton,
  SectionHeader,
  Select,
  StatusPill,
  TextInput,
  initialsOf,
  notify,
  type DataTableColumn,
  type StatusTone,
} from '@schoolos/ui';

/**
 * Alumni Office — learners who have left the school.
 *
 * Reads `GET /api/alumni`, which lists `LearnerExit` records joined to the
 * learner's existing StudentProfile and user. The learner keeps one identity
 * throughout: an exit is a record against the profile, not a second entity, so
 * attendance, grades, documents, invoices and parent links stay attached.
 *
 * Exit Reason and Account Status are shown as separate columns on purpose. The
 * reason says why they left; the account state says whether the identity is
 * still open. Collapsing them would hide the difference between "left at the
 * end of Year 7" and "account closed".
 *
 * There is no residency filter because the schema has no such field. The
 * filters offered are the ones the data actually supports: exit reason and the
 * academic session the exit falls in.
 */
interface AlumniRecord {
  id: string;
  reason: 'completed' | 'transferred' | 'withdrawn';
  exitDate: string;
  lastGradeLevel?: string | null;
  lastStream?: string | null;
  destination?: string | null;
  notes?: string | null;
  restoredAt?: string | null;
  isRestored: boolean;
  studentProfileId: string;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  phone?: string | null;
  avatar?: string | null;
  admissionId?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  enrollmentDate?: string | null;
  accountStatus: string;
  academicYear?: { id: string; name: string; label?: string | null } | null;
}

interface AlumniResponse {
  alumni?: AlumniRecord[];
  total?: number;
}

interface OptionsResponse {
  reasons?: Array<{ value: string; count: number }>;
  academicYears?: Array<{ value: string; label: string }>;
}

interface ClassOption {
  id: string;
  name: string;
  gradeLevel?: string | null;
}

const REASON_LABEL: Record<string, string> = {
  completed: 'Completed',
  transferred: 'Transferred',
  withdrawn: 'Withdrawn',
};

const REASON_TONE: Record<string, StatusTone> = {
  completed: 'success',
  transferred: 'info',
  withdrawn: 'warning',
};

const ACCOUNT_TONE: Record<string, StatusTone> = {
  active: 'success',
  pending: 'info',
  suspended: 'danger',
  archived: 'neutral',
};

const SORTS = [
  { value: 'exit_desc', label: 'Most recent exit' },
  { value: 'exit_asc', label: 'Oldest exit' },
  { value: 'name_asc', label: 'Name (A–Z)' },
  { value: 'name_desc', label: 'Name (Z–A)' },
];

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? '—'
    : parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function displayName(record: AlumniRecord): string {
  return record.name ?? [record.firstName, record.lastName].filter(Boolean).join(' ') ?? '';
}

export default function AdminAlumniPage() {
  const { can } = useAuth();
  const allowed = can('alumni.view');
  const canManage = can('alumni.manage');

  const [query, setQuery] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [academicYearId, setAcademicYearId] = React.useState('');
  const [sort, setSort] = React.useState('exit_desc');
  const [restoring, setRestoring] = React.useState<AlumniRecord | null>(null);
  const [targetGrade, setTargetGrade] = React.useState('');
  const [targetClass, setTargetClass] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const params = new URLSearchParams({ sort });
  if (debounced) params.set('search', debounced);
  if (reason) params.set('reason', reason);
  if (academicYearId) params.set('academicYearId', academicYearId);
  params.set('limit', '200');

  const { data, loading, error, refetch } = useApi<AlumniResponse>(
    allowed ? `/api/alumni?${params.toString()}` : '/api/alumni?denied=1'
  );

  const options = useApi<OptionsResponse>(
    allowed ? '/api/alumni/options' : '/api/alumni/options?denied=1'
  );

  // Classes are only needed for a restore, so they load only when it is
  // possible.
  const classes = useApi<ClassOption[]>(canManage ? '/api/classes' : null);

  const records = React.useMemo(() => data?.alumni ?? [], [data]);
  const total = data?.total ?? records.length;

  const completed = records.filter((r) => r.reason === 'completed').length;
  const transferred = records.filter((r) => r.reason === 'transferred').length;
  const withdrawn = records.filter((r) => r.reason === 'withdrawn').length;

  const columns: Array<DataTableColumn<AlumniRecord>> = [
    {
      id: 'learner',
      header: 'Learner Profile',
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
                {[
                  row.dateOfBirth ? `b. ${formatDate(row.dateOfBirth)}` : null,
                  row.enrollmentDate ? `joined ${formatDate(row.enrollmentDate)}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || row.email}
              </p>
            </div>
          </div>
        );
      },
      sortValue: (row) => displayName(row),
    },
    {
      id: 'level',
      header: 'Last Level',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-foreground">{row.lastGradeLevel || 'Not recorded'}</p>
          {/* The schema has no Stream model, so an unstreamed learner is stated
              rather than left as an ambiguous blank. */}
          <p className="truncate text-xs text-muted-foreground">
            {row.lastStream ? `Stream ${row.lastStream}` : 'No stream recorded'}
          </p>
        </div>
      ),
      sortValue: (row) => row.lastGradeLevel ?? '',
    },
    {
      id: 'admission',
      header: 'Admission #',
      cell: (row) =>
        row.admissionId ? (
          <span className="font-mono text-xs text-foreground" title={row.admissionId}>
            {row.admissionId.slice(-8).toUpperCase()}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: 'reason',
      header: 'Exit Reason',
      cell: (row) => (
        <div className="min-w-0">
          <StatusPill
            label={REASON_LABEL[row.reason] ?? row.reason}
            tone={REASON_TONE[row.reason] ?? 'neutral'}
          />
          {row.reason === 'transferred' && row.destination ? (
            <p className="mt-1 truncate text-xs text-muted-foreground">to {row.destination}</p>
          ) : null}
        </div>
      ),
      sortValue: (row) => row.reason,
    },
    {
      id: 'account',
      header: 'Account Status',
      cell: (row) => (
        <StatusPill label={row.accountStatus} tone={ACCOUNT_TONE[row.accountStatus] ?? 'neutral'} />
      ),
      sortValue: (row) => row.accountStatus,
    },
  ];

  async function restore() {
    if (!restoring) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/alumni/${restoring.id}/restore`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(targetGrade.trim() ? { targetGradeLevel: targetGrade.trim() } : {}),
          ...(targetClass ? { classId: targetClass } : {}),
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        notify.error(body?.error?.message ?? `The restore was refused (HTTP ${res.status}).`);
        return;
      }

      notify.success(`${displayName(restoring)} returned to the active roll`);
      setRestoring(null);
      setTargetGrade('');
      setTargetClass('');
      refetch();
    } catch {
      notify.error('Could not reach the API. Check that it is running.');
    } finally {
      setBusy(false);
    }
  }

  if (!allowed) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Alumni Office" />
        <ErrorState
          title="You do not have access to alumni records"
          message="Viewing former learners requires alumni.view. Your role does not hold it, and the API refuses the request independently of this screen."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Alumni Office"
        description={`Records of former learners and graduates. ${total === 1 ? '1 record' : `${total} records`} currently on the alumni roll.`}
        action={
          canManage ? (
            <PrimaryActionButton
              href="/admin/students"
              label="Record an Exit"
              icon="user-round-check"
              title="Record a learner leaving the school from their learner record."
            />
          ) : null
        }
      />

      {loading ? (
        <LoadingState label="Loading alumni records" />
      ) : error ? (
        <ErrorState
          title="Could not load alumni records"
          message="GET /api/alumni requires alumni.view. Confirm the API is running and that your session still holds the permission."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <DashboardCard
              title="On the alumni roll"
              value={total}
              icon="archive"
              tone="accent"
              description={
                debounced || reason || academicYearId
                  ? 'Matching the current filters'
                  : 'Former learners, unresolved exits'
              }
            />
            <DashboardCard
              title="Completed"
              value={completed}
              icon="check"
              tone="success"
              description="Finished their level"
            />
            <DashboardCard
              title="Transferred"
              value={transferred}
              icon="arrow-right-left"
              description="Moved to another school"
            />
            <DashboardCard
              title="Withdrawn"
              value={withdrawn}
              icon="triangle-alert"
              tone={withdrawn > 0 ? 'warning' : 'default'}
              description="Left before completing"
            />
          </div>

          <DataTable
            caption="Learners who have left the school"
            columns={columns}
            rows={records}
            rowKey={(row) => row.id}
            pageSize={15}
            renderRowActions={(row) => (
              <ActionButtons
                items={[
                  {
                    id: 'view',
                    label: `View ${displayName(row) || row.email}`,
                    href: `/admin/students/${row.studentProfileId}`,
                    icon: 'eye',
                  },
                  // Reuses the existing ID card route, which is already keyed
                  // on the student profile — the same record the exit points at.
                  {
                    id: 'id-card',
                    label: `ID card for ${displayName(row) || row.email}`,
                    href: `/admin/students/${row.studentProfileId}/id-card`,
                    icon: 'credit-card',
                  },
                  {
                    id: 'reports',
                    label: `Transcript and reports for ${displayName(row) || row.email}`,
                    href: '/admin/reports',
                    icon: 'file-bar-chart',
                  },
                  // Restoring is the sensitive operation, so it sits behind a
                  // confirmation with the placement fields it needs.
                  ...(canManage && !row.isRestored
                    ? [
                        {
                          id: 'restore',
                          label: `Restore ${displayName(row) || row.email} to the active roll`,
                          href: `#restore-${row.id}`,
                          icon: 'undo-2',
                        },
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
                  placeholder: 'Search by name, email or admission no.…',
                }}
                filters={[
                  {
                    id: 'reason',
                    label: 'Exit Reason',
                    value: reason,
                    options: (options.data?.reasons ?? []).map((r) => ({
                      value: r.value,
                      label: `${REASON_LABEL[r.value] ?? r.value} (${r.count})`,
                    })),
                    onChange: setReason,
                    allLabel: 'All reasons',
                  },
                  {
                    id: 'session',
                    label: 'Academic Session',
                    value: academicYearId,
                    options: options.data?.academicYears ?? [],
                    onChange: setAcademicYearId,
                    allLabel: 'All sessions',
                  },
                  {
                    id: 'sort',
                    label: 'Sort by',
                    value: sort,
                    options: SORTS,
                    onChange: setSort,
                    allowAll: false,
                  },
                ]}
              />
            }
            empty={
              <EmptyState
                title={
                  records.length === 0 && !debounced && !reason && !academicYearId
                    ? 'No former learners yet'
                    : 'No alumni records match these filters'
                }
                description={
                  records.length === 0 && !debounced && !reason && !academicYearId
                    ? 'Record an exit when a learner leaves, and they will appear here with their academic history intact.'
                    : 'Adjust the search or filters above.'
                }
                icon="archive"
              />
            }
          />

          {canManage && restoring ? (
            <div className="rounded-lg border bg-card p-5">
              <h2 className="text-base font-semibold text-foreground">
                Restore {displayName(restoring) || restoring.email}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                This reactivates the account, returns the learner to the active roll and stamps the
                exit as reversed. The record is kept, not deleted, and the action is written to the
                audit log.
              </p>

              <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field label="Grade to return into" hint="Defaults to the level they left from">
                  <TextInput
                    value={targetGrade}
                    onChange={(event) => setTargetGrade(event.target.value)}
                    placeholder={restoring.lastGradeLevel ?? 'Year 7'}
                  />
                </Field>
                <Field
                  label="Class"
                  hint="Optional. Placement goes through Enrollment, the same path as enrolment."
                >
                  <Select
                    value={targetClass}
                    onChange={(event) => setTargetClass(event.target.value)}
                  >
                    <option value="">Do not place in a class</option>
                    {(classes.data ?? []).map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.name}
                        {row.gradeLevel ? ` — ${row.gradeLevel}` : ''}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <div className="mt-5 flex items-center gap-2">
                <ConfirmButton
                  label="Restore learner"
                  confirmLabel="Restore to active roll"
                  description={`${displayName(restoring) || restoring.email} will be reactivated.`}
                  onConfirm={restore}
                  variant="default"
                  size="md"
                  icon="undo-2"
                  disabled={busy}
                />
                <button
                  type="button"
                  onClick={() => {
                    setRestoring(null);
                    setTargetGrade('');
                    setTargetClass('');
                  }}
                  className="rounded-md border border-input bg-background px-3.5 py-2 text-sm font-medium transition-colors hover:bg-accent"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          <p className="text-xs text-muted-foreground">
            An exit is recorded against the learner&rsquo;s own profile, so their attendance,
            grades, exam attempts, documents, invoices and parent links stay attached to the same
            record. Exit reason and account status are shown separately: the reason says why they
            left, the account state says whether the identity is still open. The schema has no
            stream model, so an unstreamed learner is stated rather than left blank.
          </p>
        </>
      )}
    </div>
  );
}
