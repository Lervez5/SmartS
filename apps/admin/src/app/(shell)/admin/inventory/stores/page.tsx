'use client';

import { useAuth } from '@schoolos/auth';
import { GapScreen } from '@schoolos/ui';

/**
 * Stores / Inventory - admin portal.
 *
 * The navigation entry and this route exist so the CBC platform shape is
 * visible. The backend capability is not implemented:
 *
 *   Assets are a register of things the school owns; a store is stock it holds. There is no Store, StockItem or movement model, so nothing records what is on a shelf, what left it, or what was reordered.
 *
 * The page states the gap rather than rendering an empty table, which would
 * read as "no data yet" when in fact no endpoint exists.
 */
export default function Page() {
  const { user, permissions } = useAuth();

  return (
    <GapScreen
      app="admin"
      path="/admin/inventory/stores"
      permissions={permissions}
      role={(user?.role ?? 'DEAN') as never}
      title="Stores / Inventory"
    />
  );
}
