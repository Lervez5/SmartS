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
  StatusPill,
  type DataTableColumn,
} from '@schoolos/ui';

/**
 * Balances Registry — who owes what.
 *
 * `GET /api/finance/invoices` is gated by `finance.view` and returns the
 * invoices the caller's school can read. A balance per learner is derived here
 * from that response: invoiced minus paid, grouped by `studentId`, with void
 * invoices excluded. The arithmetic is presentation only — the API stays the
 * authority on which invoices a caller may see at all.
 *
 * This is the accountant's landing route, so it leads with the position rather
 * than a menu.
 */
interface Invoice {
  id: string;
  studentId?: string | null;
  number: string;
  amountCents: number;
  currency: string;
  status: string;
  issuedAt: string;
  dueDate?: string | null;
  paidAt?: string | null;
}

interface InvoicesResponse {
  invoices?: Invoice[];
}

interface BalanceRow {
  studentId: string;
  invoices: number;
  invoicedCents: number;
  paidCents: number;
  outstandingCents: number;
  oldestDue?: string | null;
}

function money(cents: number, currency = 'KES'): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function date(value?: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? '—'
    : parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function isOverdue(invoice: Invoice): boolean {
  if (invoice.status === 'paid' || !invoice.dueDate) return false;
  return new Date(invoice.dueDate).getTime() < Date.now();
}

export default function AdminBalancesRegistryPage() {
  const { can } = useAuth();
  const allowed = can('finance.view');
  const [query, setQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');

  const { data, loading, error } = useApi<InvoicesResponse>(
    // listInvoicesSchema caps limit at 200; a larger value is a 400, not a clamp.
    allowed ? '/api/finance/invoices?limit=200' : '/api/finance/invoices?denied=1'
  );

  const invoices = React.useMemo(() => data?.invoices ?? [], [data]);

  const balances = React.useMemo<BalanceRow[]>(() => {
    const byStudent = new Map<string, BalanceRow>();

    for (const invoice of invoices) {
      if (invoice.status === 'void') continue;
      if (statusFilter && invoice.status !== statusFilter) continue;

      const key = invoice.studentId ?? 'unassigned';
      const row =
        byStudent.get(key) ??
        ({
          studentId: key,
          invoices: 0,
          invoicedCents: 0,
          paidCents: 0,
          outstandingCents: 0,
          oldestDue: null,
        } satisfies BalanceRow);

      row.invoices += 1;
      row.invoicedCents += invoice.amountCents;

      if (invoice.status === 'paid') {
        row.paidCents += invoice.amountCents;
      } else {
        row.outstandingCents += invoice.amountCents;

        if (invoice.dueDate) {
          // Captured in a local so TypeScript narrows the optional property;
          // it does not narrow a mutable field across the comparison.
          const due = invoice.dueDate;
          const previous = row.oldestDue;
          if (
            previous === null ||
            previous === undefined ||
            new Date(due).getTime() < new Date(previous).getTime()
          ) {
            row.oldestDue = due;
          }
        }
      }

      byStudent.set(key, row);
    }

    return [...byStudent.values()]
      .filter((row) => (query ? row.studentId.toLowerCase().includes(query.toLowerCase()) : true))
      .sort((a, b) => b.outstandingCents - a.outstandingCents);
  }, [invoices, query, statusFilter]);

  const totalOutstanding = balances.reduce((sum, row) => sum + row.outstandingCents, 0);
  const totalInvoiced = balances.reduce((sum, row) => sum + row.invoicedCents, 0);
  const totalPaid = balances.reduce((sum, row) => sum + row.paidCents, 0);
  const overdue = invoices.filter(isOverdue).length;

  const columns: Array<DataTableColumn<BalanceRow>> = [
    {
      id: 'learner',
      header: 'Learner',
      cell: (row) =>
        row.studentId === 'unassigned' ? (
          <span className="text-muted-foreground">Unassigned</span>
        ) : (
          <span className="font-mono text-xs text-foreground">{row.studentId}</span>
        ),
      sortValue: (row) => row.studentId,
    },
    {
      id: 'invoices',
      header: 'Invoices',
      align: 'right',
      cell: (row) => row.invoices,
      sortValue: (row) => row.invoices,
    },
    {
      id: 'invoiced',
      header: 'Invoiced',
      align: 'right',
      cell: (row) => money(row.invoicedCents),
      sortValue: (row) => row.invoicedCents,
    },
    {
      id: 'paid',
      header: 'Paid',
      align: 'right',
      cell: (row) => money(row.paidCents),
      sortValue: (row) => row.paidCents,
    },
    {
      id: 'outstanding',
      header: 'Outstanding',
      align: 'right',
      cell: (row) => (
        <span className={row.outstandingCents > 0 ? 'font-semibold text-foreground' : undefined}>
          {money(row.outstandingCents)}
        </span>
      ),
      sortValue: (row) => row.outstandingCents,
    },
    {
      id: 'oldest',
      header: 'Oldest due',
      align: 'right',
      hideBelow: 'lg',
      cell: (row) => date(row.oldestDue),
      sortValue: (row) => row.oldestDue ?? '',
    },
  ];

  if (!allowed) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Balances Registry" />
        <ErrorState
          title="You do not have access to finance"
          message="The finance module requires finance.view. Your role does not hold it, and the API refuses the request independently of this screen."
        />
      </div>
    );
  }

  if (loading) return <LoadingState label="Building the balances registry" />;

  if (error) {
    return (
      <ErrorState
        title="Could not build the balances registry"
        message="GET /api/finance/invoices requires finance.view. Confirm the API is running and that your session still holds the permission."
      />
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Balances Registry"
        description="Outstanding position per learner, derived from the invoice register. Void invoices are excluded."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardCard
          title="Invoiced"
          value={money(totalInvoiced)}
          icon="receipt"
          tone="accent"
          description={`${invoices.length} invoices on register`}
        />
        <DashboardCard
          title="Collected"
          value={money(totalPaid)}
          icon="credit-card"
          tone="success"
          description={
            totalInvoiced > 0
              ? `${Math.round((totalPaid / totalInvoiced) * 100)}% of invoiced`
              : undefined
          }
        />
        <DashboardCard
          title="Outstanding"
          value={money(totalOutstanding)}
          icon="scale"
          tone={totalOutstanding > 0 ? 'warning' : 'success'}
          description={`${balances.filter((row) => row.outstandingCents > 0).length} learners in arrears`}
        />
        <DashboardCard
          title="Overdue invoices"
          value={overdue}
          icon="triangle-alert"
          tone={overdue > 0 ? 'danger' : 'success'}
          description="Past the due date and unpaid"
        />
      </div>

      <DataTable
        caption="Balance per learner derived from the invoice register"
        columns={columns}
        rows={balances}
        rowKey={(row) => row.studentId}
        pageSize={15}
        toolbar={
          <ContextFilterBar
            search={{ value: query, onChange: setQuery, placeholder: 'Search learner id…' }}
            filters={[
              {
                id: 'status',
                label: 'Invoice status',
                value: statusFilter,
                options: [
                  { value: 'pending', label: 'Pending' },
                  { value: 'paid', label: 'Paid' },
                ],
                onChange: setStatusFilter,
                allLabel: 'All invoices',
              },
            ]}
          />
        }
        empty={
          <EmptyState
            title={invoices.length === 0 ? 'No invoices yet' : 'No balances match your filters'}
            description={
              invoices.length === 0
                ? 'Raise an invoice against a learner to start the register.'
                : 'Adjust the search or status filter above.'
            }
            icon="scale"
          />
        }
      />

      <p className="text-xs text-muted-foreground">
        <StatusPill label="Derived view" tone="neutral" /> Balances are computed in the browser from
        the invoices the API returns. Credit notes and refunds, which would adjust these figures,
        have no backend yet.
      </p>
    </div>
  );
}
