'use client';

import { useAuth } from '@schoolos/auth';
import { GapScreen } from '@schoolos/ui';

/**
 * M-Pesa Settings - admin portal.
 *
 * The navigation entry and this route exist so the CBC platform shape is
 * visible. The backend capability is not implemented:
 *
 *   No M-Pesa configuration exists. paymentMethods in SchoolFinanceSettings merely lists "mpesa" as an accepted string, with no till, shortcode, callback or provider setting.
 *
 * The page states the gap rather than rendering an empty table, which would
 * read as "no data yet" when in fact no endpoint exists.
 */
export default function Page() {
  const { user, permissions } = useAuth();

  return (
    <GapScreen
      app="admin"
      path="/admin/fees/mpesa"
      permissions={permissions}
      role={(user?.role ?? 'DEAN') as never}
      title="M-Pesa Settings"
    />
  );
}
