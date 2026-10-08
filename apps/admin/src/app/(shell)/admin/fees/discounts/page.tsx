'use client';

import { useAuth } from '@schoolos/auth';
import { GapScreen } from '@schoolos/ui';

/**
 * Discount Rules - admin portal.
 *
 * The navigation entry and this route exist so the CBC platform shape is
 * visible. The backend capability is not implemented:
 *
 *   SchoolFinanceSettings.discountsEnabled is a boolean with no rule behind it. There is no Discount model, so nothing states who qualifies, for what proportion, or over which period.
 *
 * The page states the gap rather than rendering an empty table, which would
 * read as "no data yet" when in fact no endpoint exists.
 */
export default function Page() {
  const { user, permissions } = useAuth();

  return (
    <GapScreen
      app="admin"
      path="/admin/fees/discounts"
      permissions={permissions}
      role={(user?.role ?? 'DEAN') as never}
      title="Discount Rules"
    />
  );
}
