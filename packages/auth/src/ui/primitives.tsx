'use client';

import React from 'react';

export interface AuthFormProps {
  onSubmit: (data: Record<string, unknown>) => Promise<void> | void;
  isLoading?: boolean;
  error?: string | null;
  children: React.ReactNode;
  submitLabel?: string;
  submitLoadingLabel?: string;
}

/**
 * Field names that must never reach a URL.
 *
 * If a credential ever lands in the query string it is already compromised:
 * it persists in browser history, shows in the address bar, and is sent in the
 * `Referer` header to anything the page loads. `useScrubCredentialQuery` below
 * removes it on mount so the exposure stops there instead of being carried
 * around for the rest of the session.
 */
const CREDENTIAL_PARAMS = ['password', 'passwordConfirm', 'confirmPassword', 'token'];

export function useScrubCredentialQuery(active = true): void {
  React.useEffect(() => {
    if (!active) return;
    const url = new URL(window.location.href);
    let changed = false;
    for (const key of CREDENTIAL_PARAMS) {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key);
        changed = true;
      }
    }
    if (changed) {
      // replaceState, not pushState: this must not add a history entry.
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    }
  }, [active]);
}

export function AuthForm({
  onSubmit,
  isLoading,
  error,
  children,
  submitLabel = 'Submit',
  submitLoadingLabel = 'Loading…',
}: AuthFormProps) {
  useScrubCredentialQuery();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    await onSubmit(data);
  };

  return (
    /**
     * `method="post"` is a security control, not a formality.
     *
     * A form without a method defaults to GET. If this page is submitted before
     * hydration finishes, the browser's native submission wins, `preventDefault`
     * never runs, and the email and password are serialized into the address
     * bar as `?email=...&password=...`. Declaring POST makes that impossible;
     * the worst case becomes a 405 from the page route instead of a leaked
     * password. The real submit path is the JSON `POST /auth/login` below.
     */
    <form method="post" onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {children}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60"
      >
        {isLoading ? submitLoadingLabel : submitLabel}
      </button>
    </form>
  );
}

export function AuthInput({
  label,
  type = 'text',
  name,
  required,
  autoComplete,
}: {
  label: string;
  type?: string;
  name: string;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium">{label}</label>
      <input
        type={type}
        name={name}
        required={required}
        autoComplete={autoComplete}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}
