'use client';

import { useAuth } from '@schoolos/auth';
import { GapScreen } from '@schoolos/ui';

/**
 * Imports - admin portal.
 *
 * The navigation entry and this route exist so the CBC platform shape is
 * visible. The backend capability is not implemented:
 *
 *   There is no bulk endpoint at all. The users module exposes no import or bulk route, and POST /api/students enrols one account at a time, so importing a cohort needs a bulk route, a parser and a job runner before it can exist. The users.import permission is granted but gates nothing yet.
 *
 * The page states the gap rather than rendering an empty table, which would
 * read as "no data yet" when in fact no endpoint exists.
 */
export default function Page() {
  const { user, permissions } = useAuth();

  return (
    <GapScreen
      app="admin"
      path="/admin/imports"
      permissions={permissions}
      role={(user?.role ?? 'DEAN') as never}
      title="Imports"
    />
  );
}
