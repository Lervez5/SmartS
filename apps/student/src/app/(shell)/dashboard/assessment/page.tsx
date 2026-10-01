'use client';

import { useAuth } from '@schoolos/auth';
import { GapScreen } from '@schoolos/ui';

/**
 * My Assessment - student portal.
 *
 * The navigation entry and this route exist so the CBC platform shape is
 * visible. The backend capability is not implemented:
 *
 *   GET /api/assessment is not implemented. There is no Assessment model; scores live on Grade/ExamAttempt/Submission.
 *
 * The page states the gap rather than rendering an empty table, which would
 * read as "no data yet" when in fact no endpoint exists.
 */
export default function Page() {
  const { user, permissions } = useAuth();

  return (
    <GapScreen
      app="student"
      path="/dashboard/assessment"
      permissions={permissions}
      role={(user?.role ?? 'STUDENT') as never}
      title="My Assessment"
    />
  );
}
