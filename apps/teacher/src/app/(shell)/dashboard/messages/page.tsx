'use client';

import { useAuth } from '@schoolos/auth';
import { GapScreen } from '@schoolos/ui';

/**
 * Messages - teacher portal.
 *
 * The navigation entry and this route exist so the CBC platform shape is
 * visible. The backend capability is not implemented:
 *
 *   GET /api/communication is a stub; the Message model has no route.
 *
 * The page states the gap rather than rendering an empty table, which would
 * read as "no data yet" when in fact no endpoint exists.
 */
export default function Page() {
  const { user, permissions } = useAuth();

  return (
    <GapScreen
      app="teacher"
      path="/dashboard/messages"
      permissions={permissions}
      role={(user?.role ?? 'TEACHER') as never}
      title="Messages"
    />
  );
}
