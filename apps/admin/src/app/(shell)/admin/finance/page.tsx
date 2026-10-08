'use client';

import * as React from 'react';
import Link from 'next/link';
import { useApi } from '@schoolos/hooks';
import { useAuth } from '@schoolos/auth';
import {
  DashboardCard,
  DataTable,
  EmptyState,
  ErrorState,
  GapState,
  LoadingState,
  SectionHeader,
  StatusPill,
  type DataTableColumn,
} from '@schoolos/ui';

/**
 * Finance summary. This is the accountant's landing screen, so it is a
 * capability split rather than a role check: a role holding `finance.view`
 * gets the billing picture, a role without it is told why.
 */
interface FinanceSummaryResponse {
  invoices?: {
    total?: number;
    paid?: number;
    pending?: number;
    overdue?: number;
    totalAmountCents?: number;
    paidAmountCents?: number;
    pendingAmountCents?: number;
    overdueAmountCents?: number;
  };
  currency?: string;
}

interface InvoicesResponse {
  invoices?: Array<{
    id: string;
    number: string;
    amountCents: number;
    currency: string;
    status: string;
    issuedAt: string;
    dueDate?: string | null;
  }>;
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

export default function AdminFinancePage() {
  const { can } = useAuth();
  const allowed = can('finance.view');

  const summary = useApi<FinanceSummaryResponse>(
    allowed ? '/api/finance/summary' : '/api/finance/summary?denied=1'
  );
  const invoices = useApi<InvoicesResponse>(
    allowed ? '/api/finance/invoices?limit=100' : '/api/finance/invoices?denied=1'
  );

  if (!allowed) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Finance" />
        <ErrorState
          title="You do not have access to finance"
          message="The finance module requires finance.view. Your role does not hold it, and the API independently refuses the request."
        />
      </div>
    );
  }

  if (summary.loading) return <LoadingState label="Loading finance summary" />;

  if (summary.error) {
    return (
      <ErrorState
        title="Could not load finance"
        message="GET /api/finance/summary requires finance.view. Confirm the API is running and that your session still holds the permission."
      />
    );
  }

  const totals = summary.data?.invoices ?? {};
  const currency = summary.data?.currency ?? 'KES';
  const recent = (invoices.data?.invoices ?? []).slice(0, 10);

  const columns: Array<DataTableColumn<NonNullable<InvoicesResponse['invoices']>[number]>> = [
    {
      id: 'number',
      header: 'Invoice',
      cell: (row) => <span className="font-medium text-foreground">{row.number}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => (
        <StatusPill
          label={row.status}
          tone={row.status === 'paid' ? 'success' : row.status === 'void' ? 'danger' : 'warning'}
        />
      ),
    },
    {
      id: 'amount',
      header: 'Amount',
      align: 'right',
      cell: (row) => formatMoney(row.amountCents, row.currency),
    },
    {
      id: 'due',
      header: 'Due',
      align: 'right',
      hideBelow: 'sm',
      cell: (row) => formatDate(row.dueDate),
    },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Finance"
        description="Billing position for the current school, scoped to the school your account is a member of."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardCard
          title="Invoiced"
          value={formatMoney(totals.totalAmountCents, currency)}
          icon="receipt"
          tone="accent"
          description={`${totals.total ?? 0} invoices`}
          href="/admin/finance/invoices"
        />
        <DashboardCard
          title="Collected"
          value={formatMoney(totals.paidAmountCents, currency)}
          icon="credit-card"
          tone="success"
          description={`${totals.paid ?? 0} paid`}
        />
        <DashboardCard
          title="Outstanding"
          value={formatMoney(totals.pendingAmountCents, currency)}
          icon="wallet"
          tone={(totals.pending ?? 0) > 0 ? 'warning' : 'default'}
          description={`${totals.pending ?? 0} pending`}
        />
        <DashboardCard
          title="Overdue"
          value={formatMoney(totals.overdueAmountCents, currency)}
          icon="triangle-alert"
          tone={(totals.overdue ?? 0) > 0 ? 'danger' : 'default'}
          description={`${totals.overdue ?? 0} past due date`}
        />
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Recent invoices</h2>
          <Link
            href="/admin/finance/invoices"
            className="text-sm font-medium text-primary hover:underline"
          >
            All invoices
          </Link>
        </div>
        {invoices.loading ? (
          <LoadingState label="Loading invoices" />
        ) : recent.length === 0 ? (
          <EmptyState
            title="No invoices yet"
            description="Invoices appear here once raised."
            icon="receipt"
          />
        ) : (
          <DataTable
            caption="Most recent invoices"
            columns={columns}
            rows={recent}
            rowKey={(row) => row.id}
            empty={<EmptyState title="No invoices yet" icon="receipt" />}
          />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">
          Arrears, refunds and reconciliation
        </h2>
        <GapState
          concept="Arrears, refunds, credit notes and reconciliation"
          detail="SchoolFinanceSettings declares arrearsEnabled, refundsEnabled, creditNotesEnabled and reconciliationEnabled, but no route implements any of them. There is no /api/finance/reconciliation, /api/finance/payments or /api/finance/refunds endpoint, and no CreditNote or Arrears model. A payment is recorded as a Receipt row."
        />
      </section>
    </div>
  );
}
