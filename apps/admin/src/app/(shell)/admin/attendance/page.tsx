'use client';

/**
 * Attendance - the register overview for the selected academic session.
 *
 * A register is not a stored record: it is the set of attendance marks a class
 * has for one date, read against the learners enrolled then. The API derives it,
 * so a day with no marks still appears as an unmarked register rather than
 * disappearing.
 *
 * The two actions are real: Reports uses the existing attendance reporting
 * endpoint with the class and date window carried across, and Open Register
 * opens the marking screen for a real class and date.
 *
 * The platform records one attendance state per learner per class per day. The
 * schema has no morning and afternoon sessions, so none are shown rather than
 * inventing a second session the database cannot distinguish.
 */

import * as React from 'react';
import Link from 'next/link';
import { useApi } from '@schoolos/hooks';
import { useAuth } from '@schoolos/auth';
import { useAcademicSession } from '@schoolos/ui';
import {
  ActionButtons,
  ContextFilterBar,
  DashboardCard,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  PrimaryActionButton,
  SectionHeader,
  StatusPill,
  type DataTableColumn,
  type StatusTone,
} from '@schoolos/ui';

type RegisterState = 'not_marked' | 'part_marked' | 'complete';

interface RegisterRow {
  classId: string;
  className: string;
  gradeLevel?: string | null;
  streams: Array<{ id: string; name: string; code: string }>;
  date: string;
  learners: number;
  markedCount: number;
  lastMarkedAt: string | null;
  state: RegisterState;
}

interface RegistersResponse {
  registers?: RegisterRow[];
  total?: number;
  scope?: { assignedOnly: boolean; classCount: number };
  window?: { from: string; to: string };
}

interface ClassOption {
  id: string;
  name: string;
  gradeLevel?: string | null;
  streams: Array<{ id: string; name: string; code: string }>;
}

const STATE_TONE: Record<RegisterState, StatusTone> = {
  not_marked: 'neutral',
  part_marked: 'warning',
  complete: 'success',
};

const STATE_LABEL: Record<RegisterState, string> = {
  not_marked: 'Not marked',
  part_marked: 'Part marked',
  complete: 'Complete',
};

function formatDay(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString(undefined, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
}

export default function AdminAttendanceOverviewPage() {
  const { can } = useAuth();
  const allowed = can('attendance.view');
  const academic = useAcademicSession();

  const today = new Date().toISOString().slice(0, 10);
  const [classId, setClassId] = React.useState('');
  const [startDate, setStartDate] = React.useState(today);
  const [endDate, setEndDate] = React.useState(today);

  const rangeInvalid = Boolean(startDate && endDate) && endDate < startDate;

  const params = new URLSearchParams();
  if (classId) params.set('classId', classId);
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);

  const { data, loading, error } = useApi<RegistersResponse>(
    allowed && !rangeInvalid
      ? `/api/attendance/registers?${params.toString()}`
      : '/api/attendance/registers?denied=1'
  );

  const options = useApi<{ classes?: ClassOption[] }>(
    allowed ? '/api/attendance/register-options' : null
  );

  const registers = React.useMemo(() => data?.registers ?? [], [data]);

  const complete = registers.filter((r) => r.state === 'complete').length;
  const partMarked = registers.filter((r) => r.state === 'part_marked').length;
  const notMarked = registers.filter((r) => r.state === 'not_marked').length;
  const learners = registers.reduce((sum, r) => sum + r.learners, 0);

  const filtered = classId || startDate !== today || endDate !== today;

  // Reports is the existing attendance reporting endpoint, carrying the class and
  // window this screen is showing rather than a parallel implementation.
  const reportsHref = `/api/attendance/reports?${
    classId ? `classId=${classId}&` : ''
  }startDate=${startDate}&endDate=${endDate}`;

  const columns: Array<DataTableColumn<RegisterRow>> = [
    {
      id: 'date',
      header: 'Date',
      cell: (row) => (
        <span className="whitespace-nowrap text-sm text-foreground">{formatDay(row.date)}</span>
      ),
      sortValue: (row) => row.date,
    },
    {
      id: 'class',
      header: 'Class',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{row.className}</p>
          <p className="truncate text-xs text-muted-foreground">
            {row.gradeLevel
              ? `${row.gradeLevel} · ${row.streams.length} stream${
                  row.streams.length === 1 ? '' : 's'
                }`
              : row.streams.length === 0
                ? 'No grade level · no streams'
                : `${row.streams.length} stream${row.streams.length === 1 ? '' : 's'}`}
          </p>
        </div>
      ),
      sortValue: (row) => row.className,
    },
    {
      id: 'state',
      header: 'Register',
      cell: (row) => <StatusPill label={STATE_LABEL[row.state]} tone={STATE_TONE[row.state]} />,
      sortValue: (row) => row.state,
    },
    {
      id: 'learners',
      header: 'Learners',
      align: 'right',
      cell: (row) => (
        <div className="min-w-0">
          <span className="text-sm text-foreground">{row.learners}</span>
          <span className="block text-xs text-muted-foreground">{row.markedCount} marked</span>
        </div>
      ),
      sortValue: (row) => row.learners,
    },
  ];

  if (!allowed) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Attendance" />
        <ErrorState
          title="You do not have access to attendance"
          message="Viewing registers requires attendance.view. Your role does not hold it, and the API refuses the request independently of this screen."
        />
      </div>
    );
  }

  const sessionLabel = academic.current?.label
    ? `${academic.current.label} · ${academic.current.label}`
    : academic.isUnset
      ? 'no academic session is active'
      : 'current academic session';

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Attendance"
        description={`Daily registers for the ${sessionLabel}. Registers are derived from recorded marks, so a day with no marks appears as not marked rather than missing.`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {can('attendance.view') ? (
              <a
                href={reportsHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-background px-3.5 text-sm font-semibold transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Reports
              </a>
            ) : null}
            {can('attendance.mark') && (options.data?.classes?.length ?? 0) > 0 ? (
              <PrimaryActionButton
                href={`/admin/attendance/registers/${classId || options.data?.classes?.[0]?.id}`}
                label="Open Register"
                icon="clipboard-check"
              />
            ) : null}
          </div>
        }
      />

      {loading ? (
        <LoadingState label="Loading registers" />
      ) : error ? (
        <ErrorState
          title="Could not load registers"
          message="GET /api/attendance/registers requires attendance.view. Confirm the API is running and that your session still holds the permission."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <DashboardCard
              title="Registers"
              value={data?.total ?? registers.length}
              icon="clipboard-check"
              tone="accent"
              description={
                filtered ? 'Matching the current filters' : 'Classes with learners in the window'
              }
            />
            <DashboardCard
              title="Complete"
              value={complete}
              icon="check"
              tone="success"
              description="Every learner marked"
            />
            <DashboardCard
              title="Part marked"
              value={partMarked}
              icon="pen-line"
              tone={partMarked > 0 ? 'warning' : 'default'}
            />
            <DashboardCard
              title="Not marked"
              value={notMarked}
              icon="circle-alert"
              tone={notMarked > 0 ? 'warning' : 'success'}
              description={`${learners} learners in scope`}
            />
          </div>

          <DataTable
            caption="Attendance registers"
            columns={columns}
            rows={registers}
            rowKey={(row) => `${row.classId}:${row.date}`}
            pageSize={20}
            toolbar={
              <ContextFilterBar
                filters={[
                  {
                    id: 'class',
                    label: 'Class',
                    value: classId,
                    options: (options.data?.classes ?? []).map((cls) => ({
                      value: cls.id,
                      label: [cls.name, cls.gradeLevel].filter(Boolean).join(' - '),
                    })),
                    onChange: setClassId,
                    allLabel: 'All classes',
                  },
                  {
                    id: 'from',
                    label: 'Start Date',
                    value: startDate,
                    onChange: setStartDate,
                    options: [],
                    allLabel: '',
                  },
                  {
                    id: 'to',
                    label: 'End Date',
                    value: endDate,
                    onChange: setEndDate,
                    options: [],
                    allLabel: '',
                  },
                ]}
              />
            }
            renderRowActions={(row) => (
              <ActionButtons
                items={[
                  {
                    id: 'open',
                    label: `Open the ${row.className} register for ${formatDay(row.date)}`,
                    href: `/admin/attendance/registers/${row.classId}?date=${row.date}`,
                    icon: 'clipboard-check',
                  },
                  ...(can('attendance.mark')
                    ? [
                        {
                          id: 'mark',
                          label: `Mark ${row.className} for ${formatDay(row.date)}`,
                          href: `/admin/attendance/registers/${row.classId}?date=${row.date}`,
                          icon: 'pen-line',
                        },
                      ]
                    : []),
                ]}
              />
            )}
            empty={
              <EmptyState
                title={
                  (options.data?.classes?.length ?? 0) === 0
                    ? 'No classes assigned to you'
                    : 'No registers in this window'
                }
                description={
                  (options.data?.classes?.length ?? 0) === 0
                    ? data?.scope?.assignedOnly
                      ? 'You are not assigned as class teacher or assistant class teacher on any class, so there is nothing to take attendance for.'
                      : 'No classes exist yet. Create a class to start taking registers.'
                    : 'Open a register to record attendance, or widen the date range.'
                }
                icon="clipboard-check"
              />
            }
          />

          <p className="text-xs text-muted-foreground">
            A register belongs to a class, and a stream narrows the learner population within it
            rather than becoming a class of its own. Marks are recorded per learner per class per
            day. Teachers see only the classes they are assigned to, as class teacher or assistant
            class teacher.
          </p>
        </>
      )}
    </div>
  );
}
