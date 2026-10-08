'use client';

import { useAuth } from '@schoolos/auth';
import { GapScreen } from '@schoolos/ui';

/**
 * Petty Cash - admin portal.
 *
 * The navigation entry and this route exist so the CBC platform shape is
 * visible. The backend capability is not implemented:
 *
 *   Petty cash has no float to reconcile. There is no PettyCash or PettyCashTransaction model, so nothing holds an opening balance, a custodian or a float that must be replenished, and Expense records a spent amount without the float it came from.
 *
 * The page states the gap rather than rendering an empty table, which would
 * read as "no data yet" when in fact no endpoint exists.
 */
export default function Page() {
  const { user, permissions } = useAuth();

  return (
    <GapScreen
      app="admin"
      path="/admin/procurement/petty-cash"
      permissions={permissions}
      role={(user?.role ?? 'DEAN') as never}
      title="Petty Cash"
    />
  );
}
