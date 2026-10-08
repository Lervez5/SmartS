'use client';

/**
 * Shared authentication layout.
 *
 * Every sign-in surface in all four portals uses this so the auth pages cannot
 * drift from one another or from the post-login shell. It establishes the same
 * design language the AppShell continues: the same tokens, the same border and
 * radius treatment, the same type scale.
 *
 * The admin portal passes a `visual` panel to get the split-screen composition;
 * the other portals pass none and get the centered single column.
 */

import * as React from 'react';
import Link from 'next/link';
import { cn } from '@schoolos/utils';

/**
 * Inlined rather than imported from `@schoolos/ui`: that package depends on this
 * one for roles and permissions, so an import here would form a cycle. This is
 * the only icon the auth shell needs.
 */
function CalendarIcon({ className }: { className?: string }) {
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
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

export interface AuthShellProps {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  /** The right-hand visual panel. Omitted on the narrower portals. */
  visual?: React.ReactNode;
  /** Secondary link rendered under the form, e.g. "Forgot your password?". */
  footerLink?: { href: string; label: string };
  /** Portal label shown beside the school mark. */
  portalLabel?: string;
  /** Real school name and logo, resolved from the public branding endpoint. */
  schoolName?: string | null;
  logoUrl?: string | null;
  className?: string;
  /** Shown while a Suspense-gated child resolves. */
  fallback?: React.ReactNode;
  /** Secondary action inside the card, e.g. "Back to sign in". */
  footer?: React.ReactNode;
}

export function AuthShell({
  title,
  description,
  children,
  visual,
  footerLink,
  portalLabel,
  schoolName,
  logoUrl,
  className,
  fallback,
  footer,
}: AuthShellProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen lg:grid-cols-2">
        {/* Authentication panel */}
        <main className={cn('flex flex-col px-6 py-8 sm:px-10 lg:px-12 lg:py-10', className)}>
          {/*
            The form column is capped and the block is centred in the space
            below the identity mark.

            Capping the width matters: on a wide display a split screen gives
            each half the full viewport height and roughly half its width, so an
            uncapped column stretches inputs to ~900px. `mt-auto` alone is not
            enough either - it pins the form to the bottom edge, which leaves a
            dead band under the logo. Centre it instead.
          */}
          <AuthIdentity portalLabel={portalLabel} schoolName={schoolName} logoUrl={logoUrl} />

          <div className="flex flex-1 items-center py-10 sm:py-14">
            <div className={cn('mx-auto w-full', visual ? 'max-w-sm' : 'max-w-md')}>
              {!visual ? (
                /*
                  Without a visual panel the form is lifted into a card, so the
                  flow reads as one object rather than loose inputs on a page.
                */
                <div className="rounded-2xl border bg-card p-6 shadow-lg sm:p-8">
                  <CardHeading title={title} description={description} />
                  <div className="mt-6">{children}</div>
                  {fallback ? <div className="mt-4">{fallback}</div> : null}
                  {footerLink ? (
                    <div className="mt-6 flex justify-center">
                      <Link
                        href={footerLink.href}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {footerLink.label}
                      </Link>
                    </div>
                  ) : null}
                  {footer ? <div className="mt-6">{footer}</div> : null}
                </div>
              ) : (
                <>
                  <CardHeading title={title} description={description} />
                  <div className="mt-7">{children}</div>
                  {fallback ? <div className="mt-4">{fallback}</div> : null}
                  {footerLink ? (
                    <div className="mt-6 text-center text-sm">
                      <Link
                        href={footerLink.href}
                        className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {footerLink.label}
                      </Link>
                    </div>
                  ) : null}
                  {footer ? <div className="mt-6">{footer}</div> : null}
                </>
              )}
            </div>
          </div>
        </main>

        {/* Visual / brand panel */}
        {visual ? (
          <aside
            className="relative hidden overflow-hidden border-l bg-card lg:block"
            aria-hidden={false}
          >
            {visual}
          </aside>
        ) : null}
      </div>
    </div>
  );
}

/** Title and supporting line, shared by the card and the split layouts. */
function CardHeading({ title, description }: { title: string; description?: React.ReactNode }) {
  return (
    <div>
      <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
      {description ? (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

/** School mark. Uses the configured logo and name; never a hardcoded school. */
export function AuthIdentity({
  portalLabel,
  schoolName,
  logoUrl,
  className,
}: {
  portalLabel?: string;
  schoolName?: string | null;
  logoUrl?: string | null;
  className?: string;
}) {
  const box =
    'flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary text-sm font-bold text-primary-foreground';
  const initials = schoolName
    ? schoolName
        .split(/\s+/)
        .map((w) => w.replace(/[^A-Za-z]/g, ''))
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? '')
        .join('')
    : '';

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <span className={box}>
        {logoUrl ? (
          <span
            role="img"
            aria-label={schoolName ?? 'School logo'}
            className="h-full w-full bg-cover bg-center"
            style={{ backgroundImage: `url(${logoUrl})` }}
          />
        ) : initials ? (
          <span aria-hidden>{initials}</span>
        ) : (
          <span aria-hidden>S</span>
        )}
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-sm font-bold text-foreground">
          {schoolName ?? 'School Management Platform'}
        </span>
        {portalLabel ? (
          <span className="block truncate text-xs text-muted-foreground">{portalLabel}</span>
        ) : null}
      </span>
    </div>
  );
}

/**
 * The right-hand visual for the admin entry point.
 *
 * A layered abstract composition rather than a stock photograph: the school and
 * CBC learning story is told with the platform's own brand tokens, so it cannot
 * look like an unrelated marketing site. Every value shown is either a real
 * configured value passed in by the caller or a fixed label - no invented
 * statistics.
 */
export interface AuthVisualProps {
  /** The institution's photograph, from SchoolBrandingSettings. */
  coverImageUrl?: string | null;
  /** Alt text for that photograph. Falls back to the institution's name. */
  coverImageAltText?: string | null;
  /** Institution name, shown over the photograph. */
  institutionName?: string | null;
  /** One restrained line of context. */
  caption?: string;
  className?: string;
}

export function AuthVisual({
  coverImageUrl,
  coverImageAltText,
  institutionName,
  caption,
  className,
}: AuthVisualProps) {
  const name = institutionName?.trim();

  /*
   * A photograph that is configured but cannot be loaded has to degrade to the
   * branded field. Left alone the panel renders a broken-image icon inside the
   * scrim, which looks like a layout fault and says nothing about the cause. The
   * reset matters when the setting is corrected: without it the panel would stay
   * on the fallback for the rest of the session.
   */
  const [photoFailed, setPhotoFailed] = React.useState(false);
  React.useEffect(() => setPhotoFailed(false), [coverImageUrl]);

  return (
    <div className={cn('relative h-full w-full overflow-hidden bg-slate-900', className)}>
      {coverImageUrl && !photoFailed ? (
        <>
          {/*
            The photograph is the institution's own, so it is given the surface
            rather than sitting behind a colour wash. object-cover fills the
            panel without distorting what is in the picture.
          */}
          <img
            src={coverImageUrl}
            alt={coverImageAltText?.trim() || name || 'Photograph of the school'}
            className="absolute inset-0 h-full w-full object-cover"
            onError={() => setPhotoFailed(true)}
          />
          {/*
            A scrim, strongest where the text sits. Without it a bright
            photograph would leave the name unreadable, which is a legibility
            problem rather than a styling preference.
          */}
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/35 to-slate-950/20"
          />
        </>
      ) : (
        <>
          {/* No photograph configured: a quiet branded field, not a drawing. */}
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(120%_120%_at_20%_0%,hsl(142_60%_22%),hsl(222_47%_11%)_55%,hsl(222_47%_8%))]"
          />
        </>
      )}

      {name || caption ? (
        <div className="absolute inset-x-0 bottom-0 p-8 sm:p-10">
          {name ? (
            <p className="max-w-md text-2xl font-semibold leading-tight text-white sm:text-3xl">
              {name}
            </p>
          ) : null}
          {caption ? (
            <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-300">{caption}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
