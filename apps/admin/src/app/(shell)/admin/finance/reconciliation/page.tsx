'use client';

import { useAuth } from '@schoolos/auth';
import { GapScreen } from '@schoolos/ui';

/**
 * Reconciliation - admin portal.
 *
 * The navigation entry and this route exist so the CBC platform shape is
 * visible. The backend capability is not implemented:
 *
 *   No /api/finance/reconciliation route. SchoolFinanceSettings.reconciliationEnabled is configuration only.
 *
 * The page states the gap rather than rendering an empty table, which would
 * read as "no data yet" when in fact no endpoint exists.
 */
export default function Page() {
  const { user, permissions } = useAuth();

  return (
    <GapScreen
      app="admin"
      path="/admin/finance/reconciliation"
      permissions={permissions}
      role={(user?.role ?? 'DEAN') as never}
      title="Reconciliation"
    />
  );
}
