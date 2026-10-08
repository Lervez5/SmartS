'use client';

import { useAuth } from '@schoolos/auth';
import { GapScreen } from '@schoolos/ui';

/**
 * Late Fee Policy - admin portal.
 *
 * The navigation entry and this route exist so the CBC platform shape is
 * visible. The backend capability is not implemented:
 *
 *   SchoolFinanceSettings.latePaymentPenalty holds a single percentage and arrearsGraceDays a single day count. There is no policy record, so tiered penalties, a grace ladder or per-category rules cannot be expressed.
 *
 * The page states the gap rather than rendering an empty table, which would
 * read as "no data yet" when in fact no endpoint exists.
 */
export default function Page() {
  const { user, permissions } = useAuth();

  return (
    <GapScreen
      app="admin"
      path="/admin/fees/late-policy"
      permissions={permissions}
      role={(user?.role ?? 'DEAN') as never}
      title="Late Fee Policy"
    />
  );
}
