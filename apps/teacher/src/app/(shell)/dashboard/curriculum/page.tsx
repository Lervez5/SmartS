'use client';

import { useAuth } from '@schoolos/auth';
import { GapScreen } from '@schoolos/ui';

/**
 * Curriculum Explorer - teacher portal.
 *
 * The navigation entry and this route exist so the CBC platform shape is
 * visible. The backend capability is not implemented:
 *
 *   No Strand, SubStrand or LearningOutcome model exists. The curriculum hierarchy has no backend.
 *
 * The page states the gap rather than rendering an empty table, which would
 * read as "no data yet" when in fact no endpoint exists.
 */
export default function Page() {
  const { user, permissions } = useAuth();

  return (
    <GapScreen
      app="teacher"
      path="/dashboard/curriculum"
      permissions={permissions}
      role={(user?.role ?? 'TEACHER') as never}
      title="Curriculum Explorer"
    />
  );
}
