'use client';

import { ForgotPasswordForm } from '@schoolos/auth';

/**
 * Forgotten password. The card, the field and the confirmation all live in the
 * shared form, so every portal gets the same screen.
 */
export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
