'use client';

import * as React from 'react';
import { useApi } from '@schoolos/hooks';
import { useAuth } from '@schoolos/auth';
import {
  ContextFilterBar,
  DashboardCard,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  SectionHeader,
  type DataTableColumn,
} from '@schoolos/ui';

/**
 * Audit Log - who did what, and when.
 *
 * Reads `GET /api/audit-logs`, which is gated by `users.view`. Entries are
 * appended by the services themselves as they act, so this is the record rather
 * than a summary of it.
 */
interface AuditEntry {
  id: string;
  action: string;
  details?: string | null;
  createdAt: string;
  user?: { id: string; name?: string | null; email?: string | null } | null;
}

interface AuditResponse {
  logs?: AuditEntry[];
  users?: Array<{ id: string; name?: string | null; email?: string | null }>;
}

function formatDateTime(value?: string | null): string {
  if (!value) return '-';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? '-'
    : parsed.toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
}

function formatAction(action: string): string {
  return action
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/^./, (c) => c.toUpperCase());
}

export default function AdminAuditLogPage() {
  const { can } = useAuth();
  const allowed = can('users.view');

  const [query, setQuery] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [actor, setActor] = React.useState('');

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const params = new URLSearchParams();
  if (debounced) params.set('search', debounced);
  if (actor) params.set('userId', actor);
  params.set('limit', '200');

  const { data, loading, error } = useApi<AuditResponse>(
    allowed ? `/api/audit-logs?${params.toString()}` : '/api/audit-logs?denied=1'
  );

  const logs = React.useMemo(() => data?.logs ?? [], [data]);

  const last24 = logs.filter(
    (entry) => new Date(entry.createdAt).getTime() > Date.now() - 86400000
  ).length;

  const columns: Array<DataTableColumn<AuditEntry>> = [
    {
      id: 'action',
      header: 'Action',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{formatAction(row.action)}</p>
          {row.details ? (
            <p className="truncate text-xs text-muted-foreground">{row.details}</p>
          ) : null}
        </div>
      ),
      sortValue: (row) => row.action,
    },
    {
      id: 'actor',
      header: 'Performed by',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-foreground">
            {row.user?.name ?? row.user?.email ?? 'System'}
          </p>
          {row.user?.name && row.user?.email ? (
            <p className="truncate text-xs text-muted-foreground">{row.user.email}</p>
          ) : null}
        </div>
      ),
      hideBelow: 'sm',
      sortValue: (row) => row.user?.name ?? row.user?.email ?? '',
    },
    {
      id: 'when',
      header: 'When',
      align: 'right',
      cell: (row) => formatDateTime(row.createdAt),
      sortValue: (row) => row.createdAt,
    },
  ];

  if (!allowed) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Audit Log" />
        <ErrorState
          title="You do not have access to the audit log"
          message="Reading the audit log requires users.view. Your role does not hold it, and the API refuses the request independently of this screen."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Audit Log"
        description="Every action the services recorded: who performed it, and when."
      />

      {loading ? (
        <LoadingState label="Loading the audit log" />
      ) : error ? (
        <ErrorState
          title="Could not load the audit log"
          message="GET /api/audit-logs requires users.view. Confirm the API is running and that your session still holds the permission."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <DashboardCard
              title="Entries returned"
              value={logs.length}
              icon="scroll-text"
              tone="accent"
              description={
                debounced || actor ? 'Matching the current filters' : 'Most recent activity'
              }
            />
            <DashboardCard
              title="Last 24 hours"
              value={last24}
              icon="check"
              description="Recorded in the past day"
            />
            <DashboardCard
              title="Distinct actions"
              value={new Set(logs.map((entry) => entry.action)).size}
              icon="file-check"
              description="Different action types on record"
            />
          </div>

          <DataTable
            caption="Recorded audit entries"
            columns={columns}
            rows={logs}
            rowKey={(row) => row.id}
            pageSize={20}
            toolbar={
              <ContextFilterBar
                search={{
                  value: query,
                  onChange: setQuery,
                  placeholder: 'Search by action or detail…',
                }}
                filters={[
                  {
                    id: 'actor',
                    label: 'Performed by',
                    value: actor,
                    options: (data?.users ?? []).map((user) => ({
                      value: user.id,
                      label: user.name ?? user.email ?? 'Unknown',
                    })),
                    onChange: setActor,
                    allLabel: 'Anyone',
                  },
                ]}
              />
            }
            empty={
              <EmptyState
                title={
                  logs.length === 0 ? 'Nothing recorded yet' : 'No entries match these filters'
                }
                description={
                  logs.length === 0
                    ? 'Actions appear here as staff work in the system - enrolling a learner, assigning a role, recording a result.'
                    : 'Adjust the search or filter above.'
                }
                icon="scroll-text"
              />
            }
          />

          <p className="text-xs text-muted-foreground">
            Entries are written by the services as they act, not by this screen, so the log cannot
            be edited from the interface.
          </p>
        </>
      )}
    </div>
  );
}
