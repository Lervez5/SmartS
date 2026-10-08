'use client';

import { useAuth } from '@schoolos/auth';
import { GapScreen } from '@schoolos/ui';

/**
 * Assessments - teacher portal.
 *
 * The navigation entry and this route exist so the CBC platform shape is
 * visible. The backend capability is not implemented:
 *
 *   GET /api/assessment is not implemented. Assessments surface as /api/examinations, which is a different concept.
 *
 * The page states the gap rather than rendering an empty table, which would
 * read as "no data yet" when in fact no endpoint exists.
 */
export default function Page() {
  const { user, permissions } = useAuth();

  return (
    <GapScreen
      app="teacher"
      path="/dashboard/assessment"
      permissions={permissions}
      role={(user?.role ?? 'TEACHER') as never}
      title="Assessments"
    />
  );
}
