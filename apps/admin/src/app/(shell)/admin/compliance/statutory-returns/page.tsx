'use client';

import { useAuth } from '@schoolos/auth';
import { GapScreen } from '@schoolos/ui';

/**
 * Statutory Returns - admin portal.
 *
 * The navigation entry and this route exist so the CBC platform shape is
 * visible. The backend capability is not implemented:
 *
 *   No submission record exists. There is nothing to hold a return period, its due date, the figure filed, or whether it was accepted, so a school cannot show what it has submitted or what is outstanding.
 *
 * The page states the gap rather than rendering an empty table, which would
 * read as "no data yet" when in fact no endpoint exists.
 */
export default function Page() {
  const { user, permissions } = useAuth();

  return (
    <GapScreen
      app="admin"
      path="/admin/compliance/statutory-returns"
      permissions={permissions}
      role={(user?.role ?? 'DEAN') as never}
      title="Statutory Returns"
    />
  );
}
