/**
 * Shared utilities used across the school platform.
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge class names, resolving Tailwind conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Generate a random hex token. */
export function randomToken(bytes: number = 32): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint8Array(bytes);
    crypto.getRandomValues(arr);
    return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  throw new Error('No secure random generator available');
}

/** Delay execution. */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Format a date for display. */
export function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Format a date with time for display. */
export function formatDateTime(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Capitalize the first letter of a string. */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/** Truncate a string to a maximum length. */
export function truncate(str: string, max: number): string {
  return str.length <= max ? str : `${str.slice(0, max)}...`;
}

/** Check if a value is a valid email. */
export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Convert cents to major currency units. */
export function centsToUnits(cents: number, decimals: number = 100): number {
  return cents / decimals;
}

/** Convert major currency units to cents. */
export function unitsToCents(units: number, decimals: number = 100): number {
  return Math.round(units * decimals);
}

/** Sleep / yield to the event loop. */
export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Simple logger placeholder (server should override with winston). */
export const logger = {
  info: (...args: unknown[]) => console.log('[INFO]', ...args),
  warn: (...args: unknown[]) => console.warn('[WARN]', ...args),
  error: (...args: unknown[]) => console.error('[ERROR]', ...args),
  debug: (...args: unknown[]) => console.debug('[DEBUG]', ...args),
};

/** Unauthorized handler hook for client-side 401s. */
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

export function getUnauthorizedHandler(): (() => void) | null {
  return onUnauthorized;
}

/** Format an error message from various error shapes. */
export function toErrorMessage(err: unknown, fallback = 'An error occurred'): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (
    err &&
    typeof err === 'object' &&
    'message' in err &&
    typeof (err as { message: unknown }).message === 'string'
  ) {
    return (err as { message: string }).message;
  }
  return fallback;
}
