'use client';

import { useAuth } from '@schoolos/auth';
import { GapScreen } from '@schoolos/ui';

/**
 * Teacher Allocation - admin portal.
 *
 * The navigation entry and this route exist so the CBC platform shape is
 * visible. The backend capability is not implemented:
 *
 *   Allocation is representable - Class.teacherId and Course.teacherId both point at User - but there is no route to read or reassign them. GET /api/subjects has no RBAC guard, so a scoped allocation view has to be built before this screen is safe.
 *
 * The page states the gap rather than rendering an empty table, which would
 * read as "no data yet" when in fact no endpoint exists.
 */
export default function Page() {
  const { user, permissions } = useAuth();

  return (
    <GapScreen
      app="admin"
      path="/admin/academics/teacher-allocation"
      permissions={permissions}
      role={(user?.role ?? 'DEAN') as never}
      title="Teacher Allocation"
    />
  );
}
