'use client';

import * as React from 'react';
import { cn } from '@schoolos/utils';
import { NavIcon } from './NavIcon';

/* ------------------------------------------------------------------ *
 * DashboardCard - a labelled summary tile for dashboard grids.
 * ------------------------------------------------------------------ */

export type DashboardCardTone = 'default' | 'accent' | 'warning' | 'danger' | 'success';

export interface DashboardCardProps {
  title: string;
  value?: React.ReactNode;
  description?: React.ReactNode;
  icon?: string;
  /** `primary` pulls the accent colour, for the one card that matters most. */
  tone?: DashboardCardTone;
  /** Secondary line, e.g. "3 pending · 1 overdue". */
  meta?: React.ReactNode;
  /** Rendered under the content, typically a link into the module. */
  footer?: React.ReactNode;
  href?: string;
  className?: string;
}

const TONE_ACCENT: Record<DashboardCardTone, string> = {
  default: 'text-muted-foreground bg-muted',
  accent: 'text-primary bg-primary/10',
  warning: 'text-amber-600 bg-amber-500/10',
  danger: 'text-destructive bg-destructive/10',
  success: 'text-emerald-600 bg-emerald-500/10',
};

export function DashboardCard({
  title,
  value,
  description,
  icon,
  tone = 'default',
  meta,
  footer,
  href,
  className,
}: DashboardCardProps) {
  const body = (
    <React.Fragment>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {icon ? (
          <span
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
              TONE_ACCENT[tone]
            )}
          >
            <NavIcon name={icon} className="h-4 w-4" />
          </span>
        ) : null}
      </div>
      {value !== undefined && value !== null ? (
        <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{value}</p>
      ) : null}
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      {meta ? <div className="mt-3 text-xs text-muted-foreground">{meta}</div> : null}
      {footer ? <div className="mt-4 border-t pt-3 text-sm">{footer}</div> : null}
    </React.Fragment>
  );

  const shell = cn(
    'block rounded-lg border bg-card p-5 text-card-foreground transition-colors',
    href &&
      'hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    className
  );

  if (href) {
    return (
      <a href={href} className={shell}>
        {body}
      </a>
    );
  }
  return <div className={shell}>{body}</div>;
}

/* ------------------------------------------------------------------ *
 * SectionHeader - page-level title with an optional contextual action.
 * ------------------------------------------------------------------ */

export interface SectionHeaderProps {
  title: string;
  description?: React.ReactNode;
  /** The module's contextual primary action, already permission-filtered. */
  action?: React.ReactNode;
  className?: string;
}

export function SectionHeader({ title, description, action, className }: SectionHeaderProps) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-foreground">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * StatusPill - consistent status indicator for tables and cards.
 * ------------------------------------------------------------------ */

export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'brand';

export interface StatusPillProps {
  label: string;
  tone?: StatusTone;
  className?: string;
}

const STATUS_TONE: Record<StatusTone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  info: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  success: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  danger: 'bg-destructive/10 text-destructive',
  brand: 'bg-primary/10 text-primary',
};
export function StatusPill({ label, tone = 'neutral', className }: StatusPillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        STATUS_TONE[tone],
        className
      )}
    >
      {label}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * State panels - loading, empty, error, gap.
 *
 * Every screen in the platform resolves to exactly one of these so the user
 * never stares at a blank region, and so an unimplemented CBC concept reads as
 * an explicit gap rather than as broken software.
 * ------------------------------------------------------------------ */

export function LoadingState({
  label = 'Loading',
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex min-h-[160px] items-center justify-center rounded-lg border border-dashed',
        className
      )}
    >
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span
          aria-hidden
          className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground"
        />
        {label}
      </div>
    </div>
  );
}

export interface EmptyStateProps {
  title: string;
  description?: React.ReactNode;
  icon?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon = 'info',
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center',
        className
      )}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <NavIcon name={icon} className="h-5 w-5" />
      </span>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description ? <p className="max-w-md text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-10 text-center',
        className
      )}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <NavIcon name="triangle-alert" className="h-5 w-5" />
      </span>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {message ? <p className="max-w-md text-sm text-muted-foreground">{message}</p> : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}

/**
 * The state a screen shows when its navigation entry exists but the backend
 * capability does not. This is the honest alternative to rendering an empty
 * table that looks like "no data yet".
 */
export interface GapStateProps {
  concept: string;
  detail: string;
  className?: string;
}

export function GapState({ concept, detail, className }: GapStateProps) {
  return (
    <div className={cn('rounded-lg border border-dashed bg-muted/30 px-6 py-10', className)}>
      <div className="mx-auto max-w-2xl text-center">
        <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <NavIcon name="circle-alert" className="h-5 w-5" />
        </span>
        <p className="text-sm font-semibold text-foreground">{concept} is not available yet</p>
        <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
        <p className="mt-4 text-xs text-muted-foreground/80">
          The navigation entry and route are in place so the platform shape is visible. The backend
          capability has to be implemented before this screen can show real data.
        </p>
      </div>
    </div>
  );
}
