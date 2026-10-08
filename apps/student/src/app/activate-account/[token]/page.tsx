'use client';

import { useParams } from 'next/navigation';
import { ActivateAccountForm } from '@schoolos/auth';

/**
 * Account activation. The token arrives as a path segment from the invitation
 * link, not a query string.
 */
export default function ActivateAccountPage() {
  const params = useParams();
  const token = typeof params?.token === 'string' ? params.token : '';
  return <ActivateAccountForm token={token} />;
}
