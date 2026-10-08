'use client';

import { useAuth } from '@schoolos/auth';
import { GapScreen } from '@schoolos/ui';

/**
 * Fee Categories - admin portal.
 *
 * The navigation entry and this route exist so the CBC platform shape is
 * visible. The backend capability is not implemented:
 *
 *   The category list exists as SchoolFinanceSettings.feeCategories, a JSON array edited under School Configuration → Finance. It has no domain behind it: no per-category amount, ordering or default, so a category cannot be charged or reported on.
 *
 * The page states the gap rather than rendering an empty table, which would
 * read as "no data yet" when in fact no endpoint exists.
 */
export default function Page() {
  const { user, permissions } = useAuth();

  return (
    <GapScreen
      app="admin"
      path="/admin/fees/categories"
      permissions={permissions}
      role={(user?.role ?? 'DEAN') as never}
      title="Fee Categories"
    />
  );
}
