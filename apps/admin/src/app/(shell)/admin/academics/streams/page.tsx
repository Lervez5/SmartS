'use client';

import { useAuth } from '@schoolos/auth';
import { GapScreen } from '@schoolos/ui';

/**
 * Streams - admin portal.
 *
 * The navigation entry and this route exist so the CBC platform shape is
 * visible. The backend capability is not implemented:
 *
 *   No Stream model exists. A CBC school groups learners by stream within a grade, so this needs a Stream entity with a parent Grade before enrolment can record it.
 *
 * The page states the gap rather than rendering an empty table, which would
 * read as "no data yet" when in fact no endpoint exists.
 */
export default function Page() {
  const { user, permissions } = useAuth();

  return (
    <GapScreen
      app="admin"
      path="/admin/academics/streams"
      permissions={permissions}
      role={(user?.role ?? 'DEAN') as never}
      title="Streams"
    />
  );
}
