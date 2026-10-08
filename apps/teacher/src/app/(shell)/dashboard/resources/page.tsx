'use client';

import { useAuth } from '@schoolos/auth';
import { GapScreen } from '@schoolos/ui';

/**
 * Learning Resources - teacher portal.
 *
 * The navigation entry and this route exist so the CBC platform shape is
 * visible. The backend capability is not implemented:
 *
 *   Lesson and unit listing is not exposed; only POST /api/courses/:id/lessons/:lessonId/complete exists.
 *
 * The page states the gap rather than rendering an empty table, which would
 * read as "no data yet" when in fact no endpoint exists.
 */
export default function Page() {
  const { user, permissions } = useAuth();

  return (
    <GapScreen
      app="teacher"
      path="/dashboard/resources"
      permissions={permissions}
      role={(user?.role ?? 'TEACHER') as never}
      title="Learning Resources"
    />
  );
}
