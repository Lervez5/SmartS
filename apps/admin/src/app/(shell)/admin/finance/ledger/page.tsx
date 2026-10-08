'use client';

import { useAuth } from '@schoolos/auth';
import { GapScreen } from '@schoolos/ui';

/**
 * General Ledger - admin portal.
 *
 * The navigation entry and this route exist so the CBC platform shape is
 * visible. The backend capability is not implemented:
 *
 *   There is no ledger to read. No Account, LedgerEntry or JournalEntry model exists, so income and expenditure are only ever aggregates over invoices, receipts and expenses rather than postings to accounts.
 *
 * The page states the gap rather than rendering an empty table, which would
 * read as "no data yet" when in fact no endpoint exists.
 */
export default function Page() {
  const { user, permissions } = useAuth();

  return (
    <GapScreen
      app="admin"
      path="/admin/finance/ledger"
      permissions={permissions}
      role={(user?.role ?? 'DEAN') as never}
      title="General Ledger"
    />
  );
}
