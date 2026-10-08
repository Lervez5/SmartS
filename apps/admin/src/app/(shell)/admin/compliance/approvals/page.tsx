'use client';

import { useAuth } from '@schoolos/auth';
import { GapScreen } from '@schoolos/ui';

/**
 * Approvals - admin portal.
 *
 * The navigation entry and this route exist so the CBC platform shape is
 * visible. The backend capability is not implemented:
 *
 *   No approval model exists. Expense has a status but no approver, no decision and no note, so nothing records who authorised a payment or on what grounds.
 *
 * The page states the gap rather than rendering an empty table, which would
 * read as "no data yet" when in fact no endpoint exists.
 */
export default function Page() {
  const { user, permissions } = useAuth();

  return (
    <GapScreen
      app="admin"
      path="/admin/compliance/approvals"
      permissions={permissions}
      role={(user?.role ?? 'DEAN') as never}
      title="Approvals"
    />
  );
}
