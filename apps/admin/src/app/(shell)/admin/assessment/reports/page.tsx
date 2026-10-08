'use client';

import { useAuth } from '@schoolos/auth';
import { GapScreen } from '@schoolos/ui';

/**
 * Reports - admin portal.
 *
 * The navigation entry and this route exist so the CBC platform shape is
 * visible. The backend capability is not implemented:
 *
 *   GET /api/reporting exists but has no summative-assessment report. General reporting lives under Reports & Analytics; this screen would cover per-assessment analysis, rank order and grade distribution.
 *
 * The page states the gap rather than rendering an empty table, which would
 * read as "no data yet" when in fact no endpoint exists.
 */
export default function Page() {
  const { user, permissions } = useAuth();

  return (
    <GapScreen
      app="admin"
      path="/admin/assessment/reports"
      permissions={permissions}
      role={(user?.role ?? 'DEAN') as never}
      title="Reports"
    />
  );
}
