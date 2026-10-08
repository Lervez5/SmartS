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
 * `GET /api/reporting/financial` — gated by `reports.finance`.
 *
 * A real endpoint: the service aggregates Invoice and Expense collections over
 * the window, so the figures here come from the database rather than being
 * derived in the browser. Amounts are minor units; the API does not convert.
 */
interface FinancialReport {
  range: { from: string; to: string };
  invoicedCents: number;
  invoicedCount: number;
  collectedCents: number;
  collectedCount: number;
  outstandingCents: number;
  outstandingCount: number;
  expensesCents: number;
  expensesCount: number;
}

function money(cents: number | undefined, currency = 'KES'): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format((cents ?? 0) / 100);
}

function date(value?: string): string {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? '—'
    : parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Windows the endpoint accepts: it reads `days`, `from` and `to`. */
const RANGES = [
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '180', label: 'Last 180 days' },
  { value: '365', label: 'Last 12 months' },
];

export default function AdminFinancialReportsPage() {
  const { can } = useAuth();
  const allowed = can('reports.finance');
  const [days, setDays] = React.useState('90');

  const { data, loading, error } = useApi<FinancialReport>(
    allowed ? `/api/reporting/financial?days=${days}` : '/api/reporting/financial?denied=1'
  );

  if (!allowed) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Financial Reports" />
        <ErrorState
          title="You do not have access to financial reports"
          message="This report requires reports.finance. Your role does not hold it, and the API refuses the request independently of this screen."
        />
      </div>
    );
  }

  if (loading) return <LoadingState label="Building the financial report" />;

  if (error) {
    return (
      <ErrorState
        title="Could not build the financial report"
        message="GET /api/reporting/financial requires reports.finance. Confirm the API is running and that your session still holds the permission."
      />
    );
  }

  const collectionRate =
    data && data.invoicedCents > 0
      ? Math.round((data.collectedCents / data.invoicedCents) * 100)
      : null;

  const rows = data
    ? [
        { metric: 'Invoiced', amountCents: data.invoicedCents, count: data.invoicedCount },
        { metric: 'Collected', amountCents: data.collectedCents, count: data.collectedCount },
        { metric: 'Outstanding', amountCents: data.outstandingCents, count: data.outstandingCount },
        { metric: 'Expenses', amountCents: data.expensesCents, count: data.expensesCount },
      ]
    : [];

  const columns: Array<DataTableColumn<(typeof rows)[number]>> = [
    { id: 'metric', header: 'Measure', cell: (row) => row.metric },
    {
      id: 'count',
      header: 'Records',
      align: 'right',
      cell: (row) => row.count.toLocaleString(),
      sortValue: (row) => row.count,
    },
    {
      id: 'amount',
      header: 'Amount',
      align: 'right',
      cell: (row) => money(row.amountCents),
      sortValue: (row) => row.amountCents,
    },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Financial Reports"
        description={`Invoicing, collection and expenditure between ${date(data?.range.from)} and ${date(data?.range.to)}.`}
      />

      <ContextFilterBar
        filters={[
          {
            id: 'days',
            label: 'Period',
            value: days,
            options: RANGES,
            onChange: setDays,
            allowAll: false,
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardCard
          title="Invoiced"
          value={money(data?.invoicedCents)}
          icon="receipt"
          tone="accent"
          description={`${data?.invoicedCount ?? 0} invoices`}
        />
        <DashboardCard
          title="Collected"
          value={money(data?.collectedCents)}
          icon="credit-card"
          tone="success"
          description={
            collectionRate !== null
              ? `${collectionRate}% of invoiced`
              : `${data?.collectedCount ?? 0} paid`
          }
        />
        <DashboardCard
          title="Outstanding"
          value={money(data?.outstandingCents)}
          icon="wallet"
          tone={(data?.outstandingCents ?? 0) > 0 ? 'warning' : 'default'}
          description={`${data?.outstandingCount ?? 0} unpaid`}
        />
        <DashboardCard
          title="Expenses"
          value={money(data?.expensesCents)}
          icon="banknote"
          description={`${data?.expensesCount ?? 0} recorded`}
        />
      </div>

      <DataTable
        caption="Financial position for the selected period"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.metric}
        empty={
          <EmptyState
            title="No financial activity in this period"
            description="Widen the period, or record invoices and expenses first."
            icon="receipt"
          />
        }
      />
    </div>
  );
}
