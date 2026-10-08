'use client';

import { useAuth } from '@schoolos/auth';
import { GapScreen } from '@schoolos/ui';

/**
 * Credit Notes - admin portal.
 *
 * The navigation entry and this route exist so the CBC platform shape is
 * visible. The backend capability is not implemented:
 *
 *   No CreditNote model exists. SchoolFinanceSettings.creditNotesEnabled is configuration only, and there is no route to raise, number or apply a credit note against an invoice.
 *
 * The page states the gap rather than rendering an empty table, which would
 * read as "no data yet" when in fact no endpoint exists.
 */
export default function Page() {
  const { user, permissions } = useAuth();

  return (
    <GapScreen
      app="admin"
      path="/admin/finance/credit-notes"
      permissions={permissions}
      role={(user?.role ?? 'DEAN') as never}
      title="Credit Notes"
    />
  );
}
