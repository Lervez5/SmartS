'use client';

/**
 * Toast notifications.
 *
 * `sonner` was already a dependency of every app and both shared packages, but
 * nothing ever mounted a `<Toaster />`, so calling `toast()` produced no visible
 * feedback at all. This module is the single place the app reports the outcome
 * of an action, and the component that renders it.
 *
 * Division of responsibility:
 *  - a toast reports that something happened, and then gets out of the way
 *  - an inline message stays when it describes state the page is currently in,
 *    such as a blocking warning or a field-level validation error, because a
 *    toast that fades away is the wrong home for information the user still
 *    needs while reading the page
 */

import * as React from 'react';
import { Toaster as SonnerToaster, toast as sonnerToast } from 'sonner';

export type ToastTone = 'success' | 'error' | 'info' | 'warning';

export interface ToastOptions {
  description?: string;
  /** Overrides the default dismissal delay in milliseconds. */
  duration?: number;
  action?: { label: string; onClick: () => void };
}

/**
 * Mounted once per application, at the root, so both the authenticated shell
 * and the unauthenticated sign-in screens can raise notifications.
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      closeButton
      richColors
      // Errors stay until dismissed: a failed save the user did not see is worse
      // than a toast lingering.
      duration={4000}
      toastOptions={{ style: { fontSize: '0.875rem' } }}
    />
  );
}

/** Report the outcome of an action. */
export const notify = {
  success(message: string, options?: ToastOptions) {
    sonnerToast.success(message, options);
  },
  error(message: string, options?: ToastOptions) {
    sonnerToast.error(message, {
      duration: 8000,
      ...options,
    });
  },
  info(message: string, options?: ToastOptions) {
    sonnerToast.info(message, options);
  },
  warning(message: string, options?: ToastOptions) {
    sonnerToast.warning(message, options);
  },
} as const;

/**
 * Runs an async action and reports its outcome.
 *
 * Every mutation in the app follows the same shape, so the success and failure
 * copy stays consistent instead of each screen inventing its own wording:
 *
 *   const result = await run(
 *     () => fetch(...).then((r) => r.json()),
 *     'Saved'
 *   );
 *   if (!result.ok) return;
 *
 * `successMessage` may be a function of the result, for counts that are only
 * known once the API has answered.
 */
export async function run<T>(
  action: () => Promise<T>,
  successMessage: string | ((result: T) => string),
  options?: ToastOptions
): Promise<{ ok: true; result: T } | { ok: false }> {
  try {
    const result = await action();
    const message = typeof successMessage === 'function' ? successMessage(result) : successMessage;
    if (message) notify.success(message, options);
    return { ok: true, result };
  } catch (error) {
    notify.error(error instanceof Error ? error.message : 'Something went wrong');
    return { ok: false };
  }
}

/**
 * Turns a `fetch` response into a thrown error carrying the API's own message,
 * so callers do not have to re-derive it per endpoint.
 */
export async function jsonOrThrow<T>(response: Response): Promise<T> {
  if (response.ok) return (await response.json()) as T;

  let message = `Request failed (HTTP ${response.status})`;
  try {
    const body = (await response.json()) as {
      error?: { message?: string };
    };
    if (body?.error?.message) message = body.error.message;
  } catch {
    // A non-JSON error body still leaves the status-based message.
  }
  throw new Error(message);
}

/**
 * Normalises the loose shapes an API can return for an error message.
 *
 * The services answer with `{ error: { message } }` for HTTP errors, but some
 * responses have been seen carrying a bare `{ message }`.
 */
export function messageOf(payload: unknown, fallback: string): string {
  if (typeof payload === 'string' && payload.trim()) return payload;
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const error = record.error;
    if (typeof error === 'string') return error;
    if (
      error &&
      typeof error === 'object' &&
      typeof (error as { message?: unknown }).message === 'string'
    ) {
      return (error as { message: string }).message;
    }
    if (typeof record.message === 'string') return record.message;
  }
  return fallback;
}
