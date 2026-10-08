'use client';

import { useAuth } from '@schoolos/auth';
import { GapScreen } from '@schoolos/ui';

/**
 * Capitation - admin portal.
 *
 * The navigation entry and this route exist so the CBC platform shape is
 * visible. The backend capability is not implemented:
 *
 *   Capitation is a receipt of government funding per learner, and nothing models it. There is no Capitation record, rate or term, so funds received from the ministry cannot be reconciled against learners.
 *
 * The page states the gap rather than rendering an empty table, which would
 * read as "no data yet" when in fact no endpoint exists.
 */
export default function Page() {
  const { user, permissions } = useAuth();

  return (
    <GapScreen
      app="admin"
      path="/admin/operations/capitation"
      permissions={permissions}
      role={(user?.role ?? 'DEAN') as never}
      title="Capitation"
    />
  );
}
