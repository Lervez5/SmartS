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
 * `GET /api/finance/invoices` - gated by `finance.view`. Money is stored in
 * minor units (cents) and rendered as major units; the server stays the only
 * place that decides what is owed.
 */
interface Invoice {
  id: string;
  number: string;
  amountCents: number;
  currency: string;
  status: string;
  issuedAt: string;
  dueDate?: string | null;
  paidAt?: string | null;
  studentId?: string | null;
}

interface InvoicesResponse {
  invoices?: Invoice[];
}

function formatMoney(cents?: number | null, currency = 'KES'): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format((cents ?? 0) / 100);
}

function formatDate(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const STATUS_TONE = {
  paid: 'success',
  pending: 'warning',
  void: 'danger',
} as const;

function toneFor(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'paid') return 'success';
  if (status === 'void') return 'danger';
  if (status === 'pending') return 'warning';
  return 'neutral';
}

export default function AdminFinanceInvoicesPage() {
  const { can } = useAuth();
  const allowed = can('finance.view');

  const [query, setQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');

  const { data, loading, error } = useApi<InvoicesResponse>(
    allowed ? '/api/finance/invoices?limit=200' : '/api/finance/invoices?denied=1'
  );

  const invoices = data?.invoices ?? [];

  const filtered = invoices.filter((row) => {
    if (statusFilter && row.status !== statusFilter) return false;
    if (query && !row.number.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  const total = invoices.reduce((sum, row) => sum + (row.amountCents ?? 0), 0);
  const paid = invoices
    .filter((row) => row.status === 'paid')
    .reduce((sum, row) => sum + (row.amountCents ?? 0), 0);
  const outstanding =
    invoices
      .filter((row) => row.status !== 'void')
      .reduce((sum, row) => sum + (row.amountCents ?? 0), 0) - paid;
  const overdue = invoices.filter(
    (row) => row.status === 'pending' && row.dueDate && new Date(row.dueDate).getTime() < Date.now()
  ).length;

  const columns: Array<DataTableColumn<Invoice>> = [
    {
      id: 'number',
      header: 'Invoice',
      cell: (row) => <span className="font-medium text-foreground">{row.number}</span>,
      sortValue: (row) => row.number,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => <StatusPill label={row.status} tone={toneFor(row.status)} />,
    },
    {
      id: 'amount',
      header: 'Amount',
      align: 'right',
      cell: (row) => formatMoney(row.amountCents, row.currency),
      sortValue: (row) => row.amountCents,
    },
    {
      id: 'issued',
      header: 'Issued',
      align: 'right',
      hideBelow: 'sm',
      cell: (row) => formatDate(row.issuedAt),
      sortValue: (row) => row.issuedAt,
    },
    {
      id: 'due',
      header: 'Due',
      align: 'right',
      hideBelow: 'md',
      cell: (row) => {
        if (!row.dueDate) return '-';
        const overdueRow = row.status === 'pending' && new Date(row.dueDate).getTime() < Date.now();
        return (
          <span className={overdueRow ? 'font-medium text-destructive' : undefined}>
            {formatDate(row.dueDate)}
          </span>
        );
      },
      sortValue: (row) => row.dueDate ?? '',
    },
  ];

  if (!allowed) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Invoices" />
        <ErrorState
          title="You do not have access to finance"
          message="Viewing invoices requires finance.view. Your role does not hold it, and the API independently refuses the request."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Invoices"
        description="The billing register. Amounts are held in minor units by the API and rendered here in major units."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardCard
          title="Invoiced"
          value={formatMoney(total)}
          icon="receipt"
          tone="accent"
          description={`${invoices.length} invoices`}
        />
        <DashboardCard
          title="Collected"
          value={formatMoney(paid)}
          icon="credit-card"
          tone="success"
        />
        <DashboardCard
          title="Outstanding"
          value={formatMoney(outstanding)}
          icon="wallet"
          tone={outstanding > 0 ? 'warning' : 'default'}
        />
        <DashboardCard
          title="Overdue"
          value={overdue}
          icon="triangle-alert"
          tone={overdue > 0 ? 'danger' : 'default'}
          description="Pending and past due date"
        />
      </div>

      {loading ? (
        <LoadingState label="Loading invoices" />
      ) : error ? (
        <ErrorState
          title="Could not load invoices"
          message="GET /api/finance/invoices requires finance.view. Confirm the API is running and that your session still holds the permission."
        />
      ) : (
        <DataTable
          caption="Invoice register for the school"
          columns={columns}
          rows={filtered}
          rowKey={(row) => row.id}
          pageSize={15}
          toolbar={
            <ContextFilterBar
              search={{
                value: query,
                onChange: setQuery,
                placeholder: 'Search by invoice number…',
              }}
              filters={[
                {
                  id: 'status',
                  label: 'Status',
                  value: statusFilter,
                  options: [
                    { value: 'pending', label: 'Pending' },
                    { value: 'paid', label: 'Paid' },
                    { value: 'void', label: 'Void' },
                  ],
                  onChange: setStatusFilter,
                  allLabel: 'All statuses',
                },
              ]}
            />
          }
          empty={
            <EmptyState
              title={invoices.length === 0 ? 'No invoices yet' : 'No invoices match your filters'}
              description={
                invoices.length === 0
                  ? 'Invoices appear here once raised against a learner.'
                  : 'Adjust the search or status filter above.'
              }
              icon="receipt"
            />
          }
        />
      )}

      <p className="text-xs text-muted-foreground">
        Creating an invoice requires finance.manage; recording a payment requires finance.payments.
        Both actions are gated in the interface and enforced independently by the API on every call.
      </p>
    </div>
  );
}
