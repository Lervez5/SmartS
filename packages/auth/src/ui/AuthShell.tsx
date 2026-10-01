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
            enough either — it pins the form to the bottom edge, which leaves a
            dead band under the logo. Centre it instead.
          */}
          <AuthIdentity portalLabel={portalLabel} schoolName={schoolName} logoUrl={logoUrl} />

          <div className="flex flex-1 items-center py-10 sm:py-14">
            <div className="mx-auto w-full max-w-sm">
              <h1 className="text-2xl font-bold tracking-tight sm:text-[28px] sm:leading-tight">
                {title}
              </h1>
              {description ? (
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
              ) : null}

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

/** School mark. Uses the configured logo and name; never a hardcoded school. */
export function AuthIdentity({
  portalLabel,
  schoolName,
  logoUrl,
}: {
  portalLabel?: string;
  schoolName?: string | null;
  logoUrl?: string | null;
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
    <div className="flex items-center gap-3">
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
 * configured value passed in by the caller or a fixed label — no invented
 * statistics.
 */
export interface AuthVisualProps {
  /** Small badge, e.g. the configured academic session. */
  badge?: string;
  eyebrow: string;
  headline: string;
  body: string;
  /** Coverage areas named on the panel. */
  areas: string[];
  className?: string;
}

export function AuthVisual({ badge, eyebrow, headline, body, areas, className }: AuthVisualProps) {
  return (
    <div className={cn('relative flex h-full flex-col overflow-hidden', className)}>
      {/* Base wash */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(circle_at_25%_15%,rgba(22,163,74,0.16),transparent_55%),radial-gradient(circle_at_80%_85%,rgba(37,99,235,0.14),transparent_55%)]"
      />
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.18] dark:opacity-[0.22]"
        style={{
          backgroundImage: 'radial-gradient(circle at center, currentColor 1px, transparent 1px)',
          backgroundSize: '26px 26px',
        }}
      />

      {/* Badge */}
      {badge ? (
        <div className="relative z-10 flex justify-end p-8">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/70 px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200">
            <CalendarIcon className="h-3.5 w-3.5" />
            {badge}
          </span>
        </div>
      ) : null}

      {/* Illustration: a stylised campus and classroom */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-8 pb-6">
        <CampusIllustration />
      </div>

      {/* Copy panel */}
      <div className="relative z-10 border-t border-white/10 bg-slate-900/70 px-8 py-7 backdrop-blur dark:bg-slate-950/70">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-400">
          {eyebrow}
        </p>
        <h2 className="mt-2 text-xl font-bold leading-snug text-white sm:text-2xl">{headline}</h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-300">{body}</p>

        <ul className="mt-5 flex flex-wrap gap-2">
          {areas.map((area) => (
            <li
              key={area}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-200"
            >
              {area}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * Campus illustration: school building, tree, and three learners in a
 * collaborative grouping. Drawn in currentColor so it inherits the panel's
 * palette in both themes and needs no image asset.
 */
function CampusIllustration() {
  return (
    <svg
      viewBox="0 0 480 320"
      role="img"
      aria-label="Illustration of a school campus with learners in a collaborative group"
      className="h-auto w-full max-w-lg text-white"
    >
      <defs>
        <linearGradient id="sm-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.10" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="sm-block" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.45" />
        </linearGradient>
      </defs>

      {/* Ground */}
      <ellipse cx="240" cy="272" rx="200" ry="34" fill="url(#sm-ground)" />

      {/* Main block */}
      <g opacity="0.92">
        <rect x="120" y="96" width="240" height="140" rx="10" fill="url(#sm-block)" />
        {/* Roof */}
        <path d="M110 100 L240 52 L370 100 Z" fill="#16a34a" opacity="0.7" />
        {/* Windows */}
        {[150, 196, 242, 288].map((x) => (
          <g key={x}>
            <rect x={x} y="118" width="32" height="26" rx="3" fill="#0b1220" opacity="0.45" />
            <rect x={x} y="156" width="32" height="26" rx="3" fill="#0b1220" opacity="0.45" />
          </g>
        ))}
        {/* Door */}
        <rect x="222" y="196" width="36" height="40" rx="4" fill="#0b1220" opacity="0.55" />
      </g>

      {/* Flag pole */}
      <g opacity="0.85">
        <line
          x1="96"
          y1="236"
          x2="96"
          y2="120"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path d="M96 124 L132 136 L96 148 Z" fill="#22c55e" />
      </g>

      {/* Tree */}
      <g opacity="0.8">
        <rect x="404" y="196" width="7" height="40" rx="3" fill="currentColor" opacity="0.5" />
        <circle cx="407" cy="184" r="26" fill="#16a34a" opacity="0.45" />
        <circle cx="386" cy="196" r="18" fill="#22c55e" opacity="0.35" />
        <circle cx="428" cy="196" r="18" fill="#0ea5e9" opacity="0.3" />
      </g>

      {/* Learners in a collaborative group */}
      <g>
        {/* learner 1 */}
        <g transform="translate(120,208)">
          <circle cx="14" cy="12" r="11" fill="#fbbf24" />
          <path d="M2 52c0-8 5-14 12-14s12 6 12 14v10H2Z" fill="#0ea5e9" opacity="0.85" />
        </g>
        {/* learner 2 */}
        <g transform="translate(168,214)">
          <circle cx="14" cy="12" r="11" fill="#f472b6" />
          <path d="M2 52c0-8 5-14 12-14s12 6 12 14v10H2Z" fill="#22c55e" opacity="0.85" />
        </g>
        {/* learner 3 */}
        <g transform="translate(216,210)">
          <circle cx="14" cy="12" r="11" fill="#a78bfa" />
          <path d="M2 52c0-8 5-14 12-14s12 6 12 14v10H2Z" fill="#f59e0b" opacity="0.85" />
        </g>
        {/* Teacher */}
        <g transform="translate(300,206)">
          <circle cx="16" cy="13" r="12" fill="#0b1220" opacity="0.6" />
          <path d="M2 56c0-9 6-15 14-15s14 6 14 15v10H2Z" fill="#0b1220" opacity="0.55" />
          <rect x="26" y="30" width="16" height="12" rx="2" fill="#ffffff" opacity="0.75" />
        </g>
        {/* Table */}
        <rect x="112" y="266" width="200" height="9" rx="4.5" fill="currentColor" opacity="0.28" />
      </g>

      {/* Connection arc: collaboration */}
      <path
        d="M170 236 Q240 206 310 236"
        fill="none"
        stroke="#22c55e"
        strokeWidth="2"
        strokeDasharray="4 6"
        strokeLinecap="round"
        opacity="0.7"
      />
    </svg>
  );
}
