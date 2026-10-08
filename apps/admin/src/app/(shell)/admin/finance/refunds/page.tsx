'use client';

import { useAuth } from '@schoolos/auth';
import { GapScreen } from '@schoolos/ui';

/**
 * Refunds - admin portal.
 *
 * The navigation entry and this route exist so the CBC platform shape is
 * visible. The backend capability is not implemented:
 *
 *   No Refund model exists. SchoolFinanceSettings.refundsEnabled is configuration only, and a refund would have to reference both the original Receipt and the Invoice it reverses.
 *
 * The page states the gap rather than rendering an empty table, which would
 * read as "no data yet" when in fact no endpoint exists.
 */
export default function Page() {
  const { user, permissions } = useAuth();

  return (
    <GapScreen
      app="admin"
      path="/admin/finance/refunds"
      permissions={permissions}
      role={(user?.role ?? 'DEAN') as never}
      title="Refunds"
    />
  );
}
