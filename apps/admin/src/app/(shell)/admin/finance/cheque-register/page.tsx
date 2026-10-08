'use client';

import { useAuth } from '@schoolos/auth';
import { GapScreen } from '@schoolos/ui';

/**
 * Cheque Register - admin portal.
 *
 * The navigation entry and this route exist so the CBC platform shape is
 * visible. The backend capability is not implemented:
 *
 *   Cheques are not represented anywhere. Receipt.method is documented as cash | mpesa | bank_transfer | card, with no cheque value, and there is no Cheque model to hold a number, a payee or a deposit date.
 *
 * The page states the gap rather than rendering an empty table, which would
 * read as "no data yet" when in fact no endpoint exists.
 */
export default function Page() {
  const { user, permissions } = useAuth();

  return (
    <GapScreen
      app="admin"
      path="/admin/finance/cheque-register"
      permissions={permissions}
      role={(user?.role ?? 'DEAN') as never}
      title="Cheque Register"
    />
  );
}
