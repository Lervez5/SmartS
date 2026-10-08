'use client';

import { ResetPasswordForm } from '@schoolos/auth';

/**
 * Reset password. Reads the token from the link, so it renders client-side and
 * sits behind a Suspense boundary inside the form.
 */
export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
