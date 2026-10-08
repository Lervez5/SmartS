'use client';

import { useAuth } from '@schoolos/auth';
import { GapScreen } from '@schoolos/ui';

/**
 * Payments - parent portal.
 *
 * The navigation entry and this route exist so the CBC platform shape is
 * visible. The backend capability is not implemented:
 *
 *   No /api/finance/payments or /api/finance/receipts route exists. A payment is a Receipt row.
 *
 * The page states the gap rather than rendering an empty table, which would
 * read as "no data yet" when in fact no endpoint exists.
 */
export default function Page() {
  const { user, permissions } = useAuth();

  return (
    <GapScreen
      app="parent"
      path="/dashboard/finance/payments"
      permissions={permissions}
      role={(user?.role ?? 'PARENT') as never}
      title="Payments"
    />
  );
}
