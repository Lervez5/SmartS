'use client';

/**
 * Shared authentication layout.
 *
 * Every sign-in surface in all four portals uses this so the auth pages cannot
 * drift from one another or from the post-login shell. It establishes the same
 * design language the AppShell continues: the same tokens, the same border and
 * radius treatment, the same type scale.
 *
 * Layout: A floating card centered on a premium branded background, with
 * decorative green orbs and subtle grid overlay for depth. Admin portal passes
 * a `visual` panel which activates the split-screen layout; other portals use
 * the centered floating card by default.
 */

import * as React from 'react';
import Link from 'next/link';
import { cn } from '@schoolos/utils';

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
  /** The right-hand visual panel. Used only by the admin split-screen layout. */
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
  if (visual) {
    /* - Admin split-screen layout ---------------------─ */
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="grid min-h-screen lg:grid-cols-2">
          {/* Authentication panel */}
          <main
            className={cn(
              'relative flex flex-col px-6 py-8 sm:px-10 lg:px-14 lg:py-12',
              'auth-page-bg',
              className
            )}
          >
            {/* Decorative orb */}
            <div
              aria-hidden
              className="pointer-events-none absolute -top-32 -left-32 h-80 w-80 rounded-full bg-primary/8 blur-[80px]"
            />

            <AuthIdentity portalLabel={portalLabel} schoolName={schoolName} logoUrl={logoUrl} />

            <div className="flex flex-1 items-center py-10 sm:py-14">
              <div className="mx-auto w-full max-w-sm">
                <CardHeading title={title} description={description} />
                <div className="mt-8">{children}</div>
                {fallback ? <div className="mt-4">{fallback}</div> : null}
                {footerLink ? (
                  <div className="mt-6 text-center">
                    <Link
                      href={footerLink.href}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {footerLink.label}
                    </Link>
                  </div>
                ) : null}
                {footer ? <div className="mt-6">{footer}</div> : null}
              </div>
            </div>
          </main>

          {/* Visual / brand panel */}
          <aside
            className="relative hidden overflow-hidden border-l bg-card lg:block"
            aria-hidden={false}
          >
            {visual}
          </aside>
        </div>
      </div>
    );
  }

  /* - Centered floating card layout (student, teacher, parent portals) --- */
  return (
    <div
      className={cn(
        'relative min-h-screen auth-page-bg',
        'flex flex-col items-center justify-center px-4 py-12',
        className
      )}
    >
      {/* Decorative background orbs */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-[-8%] left-[-8%] h-[420px] w-[420px] rounded-full bg-primary/8 blur-[100px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-[-10%] right-[-8%] h-[360px] w-[360px] rounded-full bg-primary/6 blur-[90px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-[40%] right-[15%] h-[220px] w-[220px] rounded-full bg-blue-500/4 blur-[70px]"
      />

      {/* Floating card */}
      <div className="relative z-10 w-full max-w-md animate-scale-in">
        {/* School identity above the card */}
        {schoolName || logoUrl || portalLabel ? (
          <div className="mb-6 flex justify-center">
            <AuthIdentity portalLabel={portalLabel} schoolName={schoolName} logoUrl={logoUrl} />
          </div>
        ) : null}

        {/* The card itself */}
        <div className="auth-card">
          {/* Thin green accent bar at top of card */}
          <div className="absolute inset-x-0 top-0 h-1 rounded-t-[calc(var(--radius)+4px)] bg-gradient-to-r from-primary/60 via-primary to-primary/60" />

          <CardHeading title={title} description={description} />
          <div className="mt-7">{children}</div>
          {fallback ? <div className="mt-4">{fallback}</div> : null}
          {footerLink ? (
            <div className="mt-7 flex justify-center border-t border-border/60 pt-5">
              <Link
                href={footerLink.href}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {footerLink.label}
              </Link>
            </div>
          ) : null}
          {footer ? <div className="mt-6">{footer}</div> : null}
        </div>

        {/* Subtle tagline below card */}
        <p className="mt-5 text-center text-xs text-muted-foreground/70">Secure sign-in</p>
      </div>
    </div>
  );
}

/** Title and supporting line, shared by both layouts. */
function CardHeading({ title, description }: { title: string; description?: React.ReactNode }) {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-[1.6rem]">
        {title}
      </h1>
      {description ? (
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

/** School identity mark - logo / initials + name + portal label. */
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
  if (!schoolName && !logoUrl && !portalLabel) {
    return null;
  }

  const nameToDisplay = schoolName?.trim() || null;
  const initials = nameToDisplay
    ? nameToDisplay
        .split(/\s+/)
        .map((w) => w.replace(/[^A-Za-z]/g, ''))
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? '')
        .join('')
    : '';

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {/* Logo / initials box */}
      {logoUrl || initials ? (
        <span
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl',
            'bg-gradient-to-br from-primary to-emerald-700 text-sm font-bold text-white',
            'shadow-[0_4px_14px_rgba(26,122,72,0.35)]'
          )}
        >
          {logoUrl ? (
            <span
              role="img"
              aria-label={nameToDisplay ?? 'School logo'}
              className="h-full w-full bg-cover bg-center"
              style={{ backgroundImage: `url(${logoUrl})` }}
            />
          ) : initials ? (
            <span aria-hidden className="text-sm font-extrabold tracking-tight">
              {initials}
            </span>
          ) : null}
        </span>
      ) : null}

      {/* Name block */}
      {nameToDisplay || portalLabel ? (
        <span className="min-w-0 leading-tight">
          {nameToDisplay ? (
            <span className="block truncate text-[0.9375rem] font-bold text-foreground">
              {nameToDisplay}
            </span>
          ) : null}
          {portalLabel ? (
            <span className="block truncate text-xs font-medium text-primary/80">
              {portalLabel}
            </span>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}

/**
 * The right-hand visual for the admin entry point.
 */
export interface AuthVisualProps {
  coverImageUrl?: string | null;
  coverImageAltText?: string | null;
  institutionName?: string | null;
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

  const [photoFailed, setPhotoFailed] = React.useState(false);
  React.useEffect(() => setPhotoFailed(false), [coverImageUrl]);

  return (
    <div className={cn('relative h-full w-full overflow-hidden bg-slate-900', className)}>
      {coverImageUrl && !photoFailed ? (
        <>
          <img
            src={coverImageUrl}
            alt={coverImageAltText?.trim() || name || 'Photograph of the school'}
            className="absolute inset-0 h-full w-full object-cover"
            onError={() => setPhotoFailed(true)}
          />
          {/* Gradient scrim */}
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent"
          />
          {/* Green accent overlay at very top */}
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/70 via-emerald-400/60 to-primary/70"
          />
        </>
      ) : (
        <>
          {/* Branded gradient field when no photo is configured */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(140% 130% at 15% 0%, hsl(152 65% 22%) 0%, hsl(220 47% 11%) 50%, hsl(220 47% 8%) 100%)',
            }}
          />
          {/* Dot grid overlay */}
          <div
            aria-hidden
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                'radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }}
          />
          {/* Glowing orb */}
          <div
            aria-hidden
            className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary/25 blur-[80px]"
          />
          <div
            aria-hidden
            className="absolute bottom-24 -left-20 h-56 w-56 rounded-full bg-emerald-400/15 blur-[60px]"
          />
        </>
      )}

      {name || caption ? (
        <div className="absolute inset-x-0 bottom-0 p-8 sm:p-10">
          {/* Green accent stripe above text */}
          <div className="mb-4 h-0.5 w-12 rounded-full bg-primary/70" />
          {name ? (
            <p className="max-w-md text-2xl font-bold leading-tight text-white sm:text-3xl">
              {name}
            </p>
          ) : null}
          {caption ? (
            <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-300/90">{caption}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
