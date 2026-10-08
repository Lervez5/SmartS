'use client';

import { useAuth } from '@schoolos/auth';
import { GapScreen } from '@schoolos/ui';

/**
 * SMS Centre - admin portal.
 *
 * The navigation entry and this route exist so the CBC platform shape is
 * visible. The backend capability is not implemented:
 *
 *   SMS is configuration only. SchoolNotificationSettings stores smsEnabled, smsProvider and smsSenderId, and the notifications module can name the sms channel, but no SMS provider is integrated and there is no route to send a message or read delivery reports.
 *
 * The page states the gap rather than rendering an empty table, which would
 * read as "no data yet" when in fact no endpoint exists.
 */
export default function Page() {
  const { user, permissions } = useAuth();

  return (
    <GapScreen
      app="admin"
      path="/admin/sms"
      permissions={permissions}
      role={(user?.role ?? 'DEAN') as never}
      title="SMS Centre"
    />
  );
}
