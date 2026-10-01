'use client';

import { useAuth } from '@schoolos/auth';
import { GapScreen } from '@schoolos/ui';

/**
 * Learning Areas - teacher portal.
 *
 * The navigation entry and this route exist so the CBC platform shape is
 * visible. The backend capability is not implemented:
 *
 *   GET /api/learning-areas is not implemented. Teachers currently see Subjects via GET /api/subjects, which has no RBAC guard.
 *
 * The page states the gap rather than rendering an empty table, which would
 * read as "no data yet" when in fact no endpoint exists.
 */
export default function Page() {
  const { user, permissions } = useAuth();

  return (
    <GapScreen
      app="teacher"
      path="/dashboard/learning-areas"
      permissions={permissions}
      role={(user?.role ?? 'TEACHER') as never}
      title="Learning Areas"
    />
  );
}
