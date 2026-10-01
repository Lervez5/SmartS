'use client';

import { useAuth } from '@schoolos/auth';
import { GapScreen } from '@schoolos/ui';

/**
 * Announcements - student portal.
 *
 * The navigation entry and this route exist so the CBC platform shape is
 * visible. The backend capability is not implemented:
 *
 *   No Announcement model. Announcements exist only as a notification event key in src/modules/notifications/index.ts:27.
 *
 * The page states the gap rather than rendering an empty table, which would
 * read as "no data yet" when in fact no endpoint exists.
 */
export default function Page() {
  const { user, permissions } = useAuth();

  return (
    <GapScreen
      app="student"
      path="/dashboard/announcements"
      permissions={permissions}
      role={(user?.role ?? 'STUDENT') as never}
      title="Announcements"
    />
  );
}
