'use client';

import React from 'react';

export interface AuthFormProps {
  onSubmit: (data: Record<string, unknown>) => Promise<void> | void;
  isLoading?: boolean;
  error?: string | null;
  /** Success copy, shown in place of the error styling. */
  success?: string | null;
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

const CONTROL =
  'h-11 w-full rounded-lg border bg-background px-3.5 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:opacity-60 aria-[invalid=true]:border-destructive';

export function AuthForm({
  onSubmit,
  isLoading,
  error,
  success,
  children,
  submitLabel = 'Submit',
  submitLoadingLabel = 'Working…',
}: AuthFormProps) {
  useScrubCredentialQuery();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    await onSubmit(Object.fromEntries(new FormData(form)));
  }

  return (
    /**
     * `method="post"` is a security control, not a formality.
     *
     * A form without a method defaults to GET. If this page is submitted before
     * hydration finishes, the browser's native submission wins, `preventDefault`
     * never runs, and the email and password are serialised into the address bar
     * as `?email=…&password=…`. Declaring POST makes that impossible; the worst
     * case becomes a 405 from the page route instead of a leaked password. The
     * real submit path is the JSON request each form makes.
     */
    <form method="post" onSubmit={handleSubmit} className="space-y-4">
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      {success ? (
        <div
          role="status"
          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-3 text-sm text-emerald-700 dark:text-emerald-300"
        >
          {success}
        </div>
      ) : null}

      {children}

      <button
        type="submit"
        disabled={isLoading}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-60"
      >
        {isLoading ? (
          <>
            <span
              aria-hidden
              className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground"
            />
            {submitLoadingLabel}
          </>
        ) : (
          submitLabel
        )}
      </button>
    </form>
  );
}

export interface AuthInputProps {
  label: string;
  type?: string;
  name: string;
  required?: boolean;
  autoComplete?: string;
  placeholder?: string;
  hint?: string;
  /** Static content rendered at the right of the label, e.g. a forgotten-password link. */
  trailing?: React.ReactNode;
  defaultValue?: string;
  readOnly?: boolean;
  min?: number;
  max?: number;
  autoFocus?: boolean;
}

export function AuthInput({
  label,
  type = 'text',
  name,
  required,
  autoComplete,
  placeholder,
  hint,
  trailing,
  defaultValue,
  readOnly,
  min,
  max,
  autoFocus,
}: AuthInputProps) {
  const id = `auth-${name}`;
  const describedBy = hint ? `${id}-hint` : undefined;

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
        {trailing}
      </div>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        readOnly={readOnly}
        min={min}
        max={max}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        aria-describedby={describedBy}
        placeholder={placeholder ?? (type === 'password' ? 'Your password' : undefined)}
        className={CONTROL}
      />
      {hint ? (
        <p id={describedBy} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A secondary action placed under the form, e.g. "Back to sign in".
 */
export function AuthFooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </a>
  );
}

/**
 * A panel shown instead of the form once something has succeeded, so the user is
 * not left looking at a form that has already been sent.
 */
export function AuthNotice({
  title,
  children,
  action,
}: {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="space-y-4 text-center">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
          aria-hidden
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {children ? <div className="text-sm text-muted-foreground">{children}</div> : null}
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
