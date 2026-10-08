'use client';

import { useAuth } from '@schoolos/auth';
import { GapScreen } from '@schoolos/ui';

/**
 * Tests - admin portal.
 *
 * The navigation entry and this route exist so the CBC platform shape is
 * visible. The backend capability is not implemented:
 *
 *   No test-paper domain exists. There is no Test/Paper model, no question bank, and no route to author or schedule a summative paper. /api/examinations records attempts against an already-defined assessment; it does not define the paper.
 *
 * The page states the gap rather than rendering an empty table, which would
 * read as "no data yet" when in fact no endpoint exists.
 */
export default function Page() {
  const { user, permissions } = useAuth();

  return (
    <GapScreen
      app="admin"
      path="/admin/assessment/tests"
      permissions={permissions}
      role={(user?.role ?? 'DEAN') as never}
      title="Tests"
    />
  );
}
