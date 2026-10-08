'use client';

import { useAuth } from '@schoolos/auth';
import { GapScreen } from '@schoolos/ui';

/**
 * Competencies & Results - parent portal.
 *
 * The navigation entry and this route exist so the CBC platform shape is
 * visible. The backend capability is not implemented:
 *
 *   No Competency model exists. CBC competency reporting is unimplemented.
 *
 * The page states the gap rather than rendering an empty table, which would
 * read as "no data yet" when in fact no endpoint exists.
 */
export default function Page() {
  const { user, permissions } = useAuth();

  return (
    <GapScreen
      app="parent"
      path="/dashboard/competencies"
      permissions={permissions}
      role={(user?.role ?? 'PARENT') as never}
      title="Competencies & Results"
    />
  );
}
