'use client';

import { useAuth } from '@schoolos/auth';
import { GapScreen } from '@schoolos/ui';

/**
 * Grades - admin portal.
 *
 * The navigation entry and this route exist so the CBC platform shape is
 * visible. The backend capability is not implemented:
 *
 *   No Grade model exists. Grade is a fixed Prisma enum, while StudentProfile.gradeLevel and Class.gradeLevel are free-text strings, so grades cannot be listed, ordered or renamed.
 *
 * The page states the gap rather than rendering an empty table, which would
 * read as "no data yet" when in fact no endpoint exists.
 */
export default function Page() {
  const { user, permissions } = useAuth();

  return (
    <GapScreen
      app="admin"
      path="/admin/academics/grades"
      permissions={permissions}
      role={(user?.role ?? 'DEAN') as never}
      title="Grades"
    />
  );
}
