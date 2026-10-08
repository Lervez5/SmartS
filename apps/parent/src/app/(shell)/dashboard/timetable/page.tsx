'use client';

import { useAuth } from '@schoolos/auth';
import { GapScreen } from '@schoolos/ui';

/**
 * Timetable - parent portal.
 *
 * The navigation entry and this route exist so the CBC platform shape is
 * visible. The backend capability is not implemented:
 *
 *   ClassSchedule rows exist but no timetable route aggregates them for a parent.
 *
 * The page states the gap rather than rendering an empty table, which would
 * read as "no data yet" when in fact no endpoint exists.
 */
export default function Page() {
  const { user, permissions } = useAuth();

  return (
    <GapScreen
      app="parent"
      path="/dashboard/timetable"
      permissions={permissions}
      role={(user?.role ?? 'PARENT') as never}
      title="Timetable"
    />
  );
}
