'use client';

import { useAuth } from '@schoolos/auth';
import { GapScreen } from '@schoolos/ui';

/**
 * Procurement - admin portal.
 *
 * The navigation entry and this route exist so the CBC platform shape is
 * visible. The backend capability is not implemented:
 *
 *   Nothing about purchasing is modelled. There is no Supplier, so nothing records who a school buys from; no PurchaseOrder or LPO, so there is no commitment to track; and no Voucher, so an approved payment has no document. The Expense model records money already spent, not the commitment to spend it.
 *
 * The page states the gap rather than rendering an empty table, which would
 * read as "no data yet" when in fact no endpoint exists.
 */
export default function Page() {
  const { user, permissions } = useAuth();

  return (
    <GapScreen
      app="admin"
      path="/admin/procurement"
      permissions={permissions}
      role={(user?.role ?? 'DEAN') as never}
      title="Procurement"
    />
  );
}
