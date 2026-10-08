'use client';

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authClient, errorMessage } from '../client';
import { AuthForm, AuthInput } from './primitives';
import { AuthShell } from './AuthShell';

/**
 * Reads the reset token from the query string.
 *
 * Split out so `useSearchParams` sits behind a Suspense boundary: Next refuses
 * to prerender a page that calls it unwrapped, which failed the production
 * build for all four portals.
 */
function ResetPasswordFormInner() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');

  async function handleSubmit(data: Record<string, unknown>) {
    if (!token) {
      setError(
        'This reset link is incomplete. Request a new one from the forgotten password page.'
      );
      return;
    }

    const next = String(data.password ?? '');
    if (next.length < 8) {
      setError('Use at least 8 characters.');
      return;
    }
    if (next !== String(data.confirmPassword ?? '')) {
      setError('The two passwords do not match.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await authClient.resetPassword({ token, password: next });
      setConfirm('Your password has been changed. You can sign in now.');
      // Straight to sign-in: the user has just proved they can receive mail and
      // hold the account, so making them request a link again would be friction.
      setTimeout(() => router.push('/login'), 1200);
    } catch (err) {
      setError(errorMessage(err, 'Could not change your password. Request a new link.'));
    } finally {
      setIsLoading(false);
    }
  }

  if (!token) {
    return (
      <AuthShell
        title="Reset link missing"
        description="This page needs a reset link. Open the link from your email, or request a new one."
        footerLink={{ href: '/forgot-password', label: 'Request a new link' }}
      >
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3.5 py-3 text-sm text-amber-700 dark:text-amber-300">
          No reset token was supplied.
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Choose a new password"
      description="Pick something you have not used here before."
      footerLink={{ href: '/login', label: 'Back to sign in' }}
    >
      {confirm ? (
        <div
          role="status"
          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-3 text-sm text-emerald-700 dark:text-emerald-300"
        >
          {confirm}
        </div>
      ) : null}

      <AuthForm
        onSubmit={handleSubmit}
        isLoading={isLoading}
        error={error}
        submitLabel="Change password"
        submitLoadingLabel="Changing…"
      >
        <AuthInput
          label="New password"
          type="password"
          name="password"
          required
          autoComplete="new-password"
          placeholder="At least 8 characters"
          autoFocus
        />
        <AuthInput
          label="Confirm new password"
          type="password"
          name="confirmPassword"
          required
          autoComplete="new-password"
        />
      </AuthForm>
    </AuthShell>
  );
}

export function ResetPasswordForm() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordFormInner />
    </Suspense>
  );
}
