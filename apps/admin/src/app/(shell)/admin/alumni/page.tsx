'use client';

import { useAuth } from '@schoolos/auth';
import { GapScreen } from '@schoolos/ui';

/**
 * Alumni Office - admin portal.
 *
 * The navigation entry and this route exist so the CBC platform shape is
 * visible. The backend capability is not implemented:
 *
 *   No alumni domain exists at all: no Alumni/Alumnus model, no graduation-on-leaver state on StudentProfile, and no /api/alumni module. This needs a model, a leaver workflow on the student record, and a read route before the screen can show anything.
 *
 * The page states the gap rather than rendering an empty table, which would
 * read as "no data yet" when in fact no endpoint exists.
 */
export default function Page() {
  const { user, permissions } = useAuth();

  return (
    <GapScreen
      app="admin"
      path="/admin/alumni"
      permissions={permissions}
      role={(user?.role ?? 'DEAN') as never}
      title="Alumni Office"
    />
  );
}
