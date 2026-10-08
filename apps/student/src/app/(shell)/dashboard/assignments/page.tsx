'use client';

import { useAuth } from '@schoolos/auth';
import { GapScreen } from '@schoolos/ui';

/**
 * Assignments - student portal.
 *
 * The navigation entry and this route exist so the CBC platform shape is
 * visible. The backend capability is not implemented:
 *
 *   No assignment listing route exists. The Assignment model is populated by the dashboard service only.
 *
 * The page states the gap rather than rendering an empty table, which would
 * read as "no data yet" when in fact no endpoint exists.
 */
export default function Page() {
  const { user, permissions } = useAuth();

  return (
    <GapScreen
      app="student"
      path="/dashboard/assignments"
      permissions={permissions}
      role={(user?.role ?? 'STUDENT') as never}
      title="Assignments"
    />
  );
}
