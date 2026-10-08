'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authClient, errorMessage } from '../client';
import { AuthForm, AuthInput } from './primitives';
import { AuthShell } from './AuthShell';

/**
 * Account activation.
 *
 * Reached from the invitation link, so the token arrives as a path segment
 * rather than a query string. Setting a password here activates the account; the
 * person is then sent to sign in rather than signed in directly, so the session
 * they use is one the server issued after activation.
 */
export function ActivateAccountForm({ token }: { token: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(data: Record<string, unknown>) {
    const password = String(data.password ?? '');

    if (password.length < 8) {
      setError('Use at least 8 characters.');
      return;
    }
    if (password !== String(data.confirmPassword ?? '')) {
      setError('The two passwords do not match.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await authClient.activateAccount({ token, password });
      setConfirm('Your account is active. Taking you to sign in…');
      setTimeout(() => router.push('/login?activated=true'), 1200);
    } catch (err) {
      setError(errorMessage(err, 'Could not activate the account. Ask for a new invitation.'));
    } finally {
      setIsLoading(false);
    }
  }

  if (!token) {
    return (
      <AuthShell
        title="Activation link missing"
        description="This page needs the link from your invitation email."
        footerLink={{ href: '/login', label: 'Back to sign in' }}
      >
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3.5 py-3 text-sm text-amber-700 dark:text-amber-300">
          No activation token was supplied.
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Activate your account"
      description="Choose a password to finish setting up your access."
      footerLink={{ href: '/login', label: 'Back to sign in' }}
    >
      {confirm ? (
        <div
          role="status"
          className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-3 text-sm text-emerald-700 dark:text-emerald-300"
        >
          {confirm}
        </div>
      ) : null}

      <AuthForm
        onSubmit={handleSubmit}
        isLoading={isLoading}
        error={error}
        submitLabel="Activate account"
        submitLoadingLabel="Activating…"
      >
        <AuthInput
          label="Choose a password"
          type="password"
          name="password"
          required
          autoComplete="new-password"
          placeholder="At least 8 characters"
          autoFocus
        />
        <AuthInput
          label="Confirm password"
          type="password"
          name="confirmPassword"
          required
          autoComplete="new-password"
        />
      </AuthForm>
    </AuthShell>
  );
}
