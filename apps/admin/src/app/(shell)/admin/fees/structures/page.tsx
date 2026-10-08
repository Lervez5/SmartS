'use client';

import { useAuth } from '@schoolos/auth';
import { GapScreen } from '@schoolos/ui';

/**
 * Fee Structures - admin portal.
 *
 * The navigation entry and this route exist so the CBC platform shape is
 * visible. The backend capability is not implemented:
 *
 *   No FeeStructure model exists. SchoolFinanceSettings.feeCategories is a flat list of names with no amounts, so there is nothing describing what a class of learner is charged per term or per year.
 *
 * The page states the gap rather than rendering an empty table, which would
 * read as "no data yet" when in fact no endpoint exists.
 */
export default function Page() {
  const { user, permissions } = useAuth();

  return (
    <GapScreen
      app="admin"
      path="/admin/fees/structures"
      permissions={permissions}
      role={(user?.role ?? 'DEAN') as never}
      title="Fee Structures"
    />
  );
}
