'use client';

import { useAuth } from '@schoolos/auth';
import { GapScreen } from '@schoolos/ui';

/**
 * Budgets - admin portal.
 *
 * The navigation entry and this route exist so the CBC platform shape is
 * visible. The backend capability is not implemented:
 *
 *   No Budget or BudgetLine model exists. Spend is only ever an aggregate over expenses, so there is no envelope to set a limit against or report a variance to.
 *
 * The page states the gap rather than rendering an empty table, which would
 * read as "no data yet" when in fact no endpoint exists.
 */
export default function Page() {
  const { user, permissions } = useAuth();

  return (
    <GapScreen
      app="admin"
      path="/admin/operations/budgets"
      permissions={permissions}
      role={(user?.role ?? 'DEAN') as never}
      title="Budgets"
    />
  );
}
