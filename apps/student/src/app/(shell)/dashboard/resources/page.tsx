'use client';

import { useAuth } from '@schoolos/auth';
import { GapScreen } from '@schoolos/ui';

/**
 * Learning Resources - student portal.
 *
 * The navigation entry and this route exist so the CBC platform shape is
 * visible. The backend capability is not implemented:
 *
 *   GET /api/courses/:id/lessons/:lessonId and lesson listing for a student are not implemented.
 *
 * The page states the gap rather than rendering an empty table, which would
 * read as "no data yet" when in fact no endpoint exists.
 */
export default function Page() {
  const { user, permissions } = useAuth();

  return (
    <GapScreen
      app="student"
      path="/dashboard/resources"
      permissions={permissions}
      role={(user?.role ?? 'STUDENT') as never}
      title="Learning Resources"
    />
  );
}
