'use client';

/**
 * Central Auth sign-in form.
 *
 * Used unchanged by all four portals. Portal eligibility is not decided here:
 * the form authenticates through `/auth/login`, stores whatever identity Central
 * Auth returns, and navigates to that role's home. The backend has already
 * refused an ineligible credential, and the shell re-checks the app on every
 * request.
 */

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authClient, errorMessage } from '../client';
import { useAuthStore } from '../store';
import { normalizeRole, ROLE_HOME } from '../roles';
import type { UserRole } from '../roles';
import { AuthForm } from './primitives';
import type { Permission } from '../permissions';

export interface LoginFormProps {
  /** The application this form belongs to; used to verify portal eligibility. */
  appId: string;
  /** Displayed under the identity mark, e.g. the resolved school name. */
  schoolName?: string;
  /**
   * Renders a "Forgot password?" link beside the password label. Omit it and the
   * link is not rendered, so the page controls whether it appears.
   */
  forgotPasswordHref?: string;
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.4 0 10 7 10 7a17.6 17.6 0 0 1-2.55 3.5M6.6 6.6A17.8 17.8 0 0 0 2 11s3.6 7 10 7a9 9 0 0 0 4.5-1.1" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <path d="m2 2 20 20" />
    </svg>
  );
}

export function LoginForm({ appId, schoolName, forgotPasswordHref }: LoginFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  async function handleSubmit(data: Record<string, unknown>) {
    const email = String(data.email ?? '').trim();
    const password = String(data.password ?? '');

    // Client-side checks mirror the server's zod schema. They exist to give
    // immediate feedback, never to decide access.
    if (!email) {
      setError('Enter your email address');
      return;
    }
    if (!password) {
      setError('Enter your password');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await authClient.login({ email, password });
      const role = normalizeRole(res.user.role) as UserRole | null;
      if (!role) {
        setError('Unrecognized role in session');
        return;
      }

      useAuthStore.getState().setSession({
        id: res.user.id,
        email: res.user.email,
        role,
        name: res.user.name,
        firstName: res.user.firstName,
        lastName: res.user.lastName,
        avatar: res.user.avatar,
        permissions: (res.user.permissions ?? []) as Permission[],
        appId: res.user.appId,
      });

      // Land on the role's home, which is resolved from the session the backend
      // just issued - not from anything the client supplied.
      const home = ROLE_HOME[role];
      router.push(home || '/');
    } catch (err) {
      setError(errorMessage(err, 'Invalid email or password'));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthForm
      onSubmit={handleSubmit}
      isLoading={isLoading}
      error={error}
      submitLabel="Sign in"
      submitLoadingLabel="Signing in…"
    >
      <div className="space-y-1.5">
        <label htmlFor={`${appId}-email`} className="block text-sm font-medium text-foreground">
          Email
        </label>
        <input
          id={`${appId}-email`}
          name="email"
          type="email"
          required
          autoComplete="username"
          autoFocus
          placeholder="admin@school.edu"
          className="h-11 w-full rounded-lg border border-input bg-background px-3.5 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-60"
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <label
            htmlFor={`${appId}-password`}
            className="block text-sm font-medium text-foreground"
          >
            Password
          </label>
          {forgotPasswordHref ? (
            <a
              href={forgotPasswordHref}
              className="text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Forgot password?
            </a>
          ) : null}
        </div>
        <div className="relative">
          <input
            id={`${appId}-password`}
            name="password"
            type={showPassword ? 'text' : 'password'}
            required
            autoComplete="current-password"
            className="h-11 w-full rounded-lg border border-input bg-background px-3.5 pr-11 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {showPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {schoolName ? (
        <p className="text-xs text-muted-foreground">
          Signing in to <span className="font-medium text-foreground">{schoolName}</span>
        </p>
      ) : null}
    </AuthForm>
  );
}
