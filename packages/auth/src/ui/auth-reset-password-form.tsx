'use client';

import React, { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { authClient, errorMessage } from '../client';
import { AuthForm, AuthInput } from './primitives';
import { AuthShell } from './AuthShell';

/**
 * Reads the reset token from the query string.
 *
 * Split out so `useSearchParams` sits behind a Suspense boundary: during a
 * static export Next.js refuses to prerender a page that calls it unwrapped,
 * which failed the production build for all four portals.
 */
function ResetPasswordFormInner() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  async function handleSubmit(data: Record<string, unknown>) {
    const token = searchParams.get('token');
    if (!token) {
      setError('Invalid or missing reset token');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await authClient.resetPassword({
        token,
        password: data.password as string,
      });
      router.push('/login?reset=success');
    } catch (err) {
      setError(errorMessage(err, 'Failed to reset password'));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthForm onSubmit={handleSubmit} isLoading={isLoading} error={error}>
      <AuthInput
        label="New Password"
        type="password"
        name="password"
        required
        autoComplete="new-password"
      />
    </AuthForm>
  );
}

export function ResetPasswordForm() {
  return (
    <AuthShell
      title="Reset your password"
      description="Choose a new password to finish resetting your account."
      fallback={<p className="text-sm text-muted-foreground">Loading…</p>}
    >
      <Suspense fallback={null}>
        <ResetPasswordFormInner />
      </Suspense>
    </AuthShell>
  );
}
