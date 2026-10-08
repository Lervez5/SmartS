'use client';

import React, { useState } from 'react';
import { authClient, errorMessage } from '../client';
import { AuthForm, AuthInput, AuthNotice } from './primitives';
import { AuthShell } from './AuthShell';

/**
 * Forgotten password.
 *
 * The API answers the same way whether or not the address is on file, so the
 * confirmation here matches that: it never says an account does not exist,
 * because that would let anyone test addresses against the school.
 *
 * In development the API returns the reset link directly, because there is no
 * mailbox to deliver it to. Surfacing that here is what makes the flow
 * checkable end to end instead of something to take on trust.
 */
export function ForgotPasswordForm({ schoolName }: { schoolName?: string } = {}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);

  async function handleSubmit(data: Record<string, unknown>) {
    setIsLoading(true);
    setError(null);
    setDevLink(null);
    try {
      const result = await authClient.forgotPassword(String(data.email ?? '').trim());
      setSent(true);
      const link = result?.devResetUrl;
      if (link) setDevLink(link);
    } catch (err) {
      setError(errorMessage(err, 'Could not start the password reset. Try again.'));
    } finally {
      setIsLoading(false);
    }
  }

  if (sent) {
    return (
      <AuthShell
        title="Check your email"
        schoolName={schoolName}
        footerLink={{ href: '/login', label: 'Back to sign in' }}
      >
        <AuthNotice
          title="Check your email"
          action={
            devLink ? (
              <a
                href={devLink}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Open the reset link
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-3.5 w-3.5"
                  aria-hidden
                >
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </a>
            ) : (
              <span className="text-xs text-muted-foreground">
                The link expires, and can be requested again if it does not arrive.
              </span>
            )
          }
        >
          If that address belongs to an account, a reset link is on its way. It is valid for a short
          time only.
          {devLink ? (
            <p className="mt-3 text-xs">
              <span className="rounded bg-muted px-1.5 py-0.5 font-medium">Development</span> no
              mail is delivered here, so the link is shown below.
            </p>
          ) : null}
        </AuthNotice>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Forgot your password?"
      description="Enter your email and we will send you a link to choose a new one."
      schoolName={schoolName}
      footerLink={{ href: '/login', label: 'Back to sign in' }}
    >
      <AuthForm
        onSubmit={handleSubmit}
        isLoading={isLoading}
        error={error}
        submitLabel="Send reset link"
        submitLoadingLabel="Sending…"
      >
        <AuthInput
          label="Email address"
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="you@school.edu"
          hint="The address on your school account."
          autoFocus
        />
      </AuthForm>
    </AuthShell>
  );
}
