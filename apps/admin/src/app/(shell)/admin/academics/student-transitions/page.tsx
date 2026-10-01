'use client';

import { useAuth } from '@schoolos/auth';
import { GapScreen } from '@schoolos/ui';

/**
 * Student Transitions - admin portal.
 *
 * The navigation entry and this route exist so the CBC platform shape is
 * visible. The backend capability is not implemented:
 *
 *   No promotion or transfer workflow exists. StudentProfile.gradeLevel is a free-text string, SchoolAcademicSettings.promotionRule is an unapplied string, and there is no route that moves a learner between classes or closes a session.
 *
 * The page states the gap rather than rendering an empty table, which would
 * read as "no data yet" when in fact no endpoint exists.
 */
export default function Page() {
  const { user, permissions } = useAuth();

  return (
    <GapScreen
      app="admin"
      path="/admin/academics/student-transitions"
      permissions={permissions}
      role={(user?.role ?? 'DEAN') as never}
      title="Student Transitions"
    />
  );
}
