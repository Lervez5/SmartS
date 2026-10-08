'use client';

import { useAuth } from '@schoolos/auth';
import { GapScreen } from '@schoolos/ui';

/**
 * Bursaries - admin portal.
 *
 * The navigation entry and this route exist so the CBC platform shape is
 * visible. The backend capability is not implemented:
 *
 *   No Bursary model exists. SchoolFinanceSettings holds no bursary policy, so nothing states who is eligible, how much is awarded, or which budget it comes from.
 *
 * The page states the gap rather than rendering an empty table, which would
 * read as "no data yet" when in fact no endpoint exists.
 */
export default function Page() {
  const { user, permissions } = useAuth();

  return (
    <GapScreen
      app="admin"
      path="/admin/operations/bursaries"
      permissions={permissions}
      role={(user?.role ?? 'DEAN') as never}
      title="Bursaries"
    />
  );
}
