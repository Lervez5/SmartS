'use client';

import { useAuth } from '@schoolos/auth';
import { GapScreen } from '@schoolos/ui';

/**
 * Payment Plans - admin portal.
 *
 * The navigation entry and this route exist so the CBC platform shape is
 * visible. The backend capability is not implemented:
 *
 *   No instalment or schedule model exists. SchoolFinanceSettings.allowPartialPayments permits a part payment, but nothing records an agreed plan of instalments or tracks one.
 *
 * The page states the gap rather than rendering an empty table, which would
 * read as "no data yet" when in fact no endpoint exists.
 */
export default function Page() {
  const { user, permissions } = useAuth();

  return (
    <GapScreen
      app="admin"
      path="/admin/fees/plans"
      permissions={permissions}
      role={(user?.role ?? 'DEAN') as never}
      title="Payment Plans"
    />
  );
}
