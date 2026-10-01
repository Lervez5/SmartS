'use client';

/**
 * Brand mark.
 *
 * Renders the school's configured logo when one exists, and otherwise falls
 * back to initials derived from the school's real name. It never invents a
 * name or a logo: with no branding configured it shows the platform mark and a
 * neutral label, which is a truthful "not configured yet" rather than a
 * hardcoded placeholder school.
 *
 * Used by the top navbar, the sidebar and the sign-in shell so the identity is
 * defined once.
 */

import * as React from 'react';
import { cn } from '@schoolos/utils';

export interface BrandMarkProps {
  /** Configured logo, from SchoolBrandingSettings.logoUrl. */
  logoUrl?: string | null;
  /** Configured school name, from School.displayName or SchoolGeneralSettings. */
  schoolName?: string | null;
  /** Portal label shown beside the school name, e.g. "Admin Portal". */
  portalName?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Hide the text block, leaving only the mark. */
  markOnly?: boolean;
}

const SIZES = {
  sm: {
    box: 'h-8 w-8 rounded-lg text-xs',
    text: 'text-sm',
    sub: 'text-[11px]',
  },
  md: { box: 'h-9 w-9 rounded-lg text-sm', text: 'text-sm', sub: 'text-xs' },
  lg: {
    box: 'h-10 w-10 rounded-xl text-base',
    text: 'text-[15px]',
    sub: 'text-xs',
  },
} as const;

/** Up to two initials from the school's real name. */
export function initialsOf(name?: string | null): string {
  if (!name) return '';
  const words = name
    .split(/\s+/)
    .map((w) => w.replace(/[^A-Za-z]/g, ''))
    .filter(Boolean);
  if (words.length === 0) return '';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

export function BrandMark({
  logoUrl,
  schoolName,
  portalName,
  size = 'md',
  className,
  markOnly,
}: BrandMarkProps) {
  const dimensions = SIZES[size];
  const initials = initialsOf(schoolName);

  return (
    <span className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <span
        className={cn(
          'flex shrink-0 items-center justify-center overflow-hidden bg-primary font-bold text-primary-foreground',
          dimensions.box
        )}
      >
        {logoUrl ? (
          // A background image rather than <img>: the mark is decorative beside
          // the name, and this avoids the next/image loader for a single asset.
          <span
            role="img"
            aria-label={schoolName ?? 'School logo'}
            className="h-full w-full bg-cover bg-center"
            style={{ backgroundImage: `url(${logoUrl})` }}
          />
        ) : initials ? (
          <span aria-hidden>{initials}</span>
        ) : (
          // Platform mark: shown only while the school has configured neither a
          // logo nor a name.
          <span aria-hidden>S</span>
        )}
      </span>

      {markOnly ? null : (
        <span className="min-w-0 leading-tight">
          <span
            className={cn('block truncate font-bold text-foreground', dimensions.text)}
            title={schoolName ?? undefined}
          >
            {schoolName ?? 'School Management Platform'}
          </span>
          {portalName ? (
            <span className={cn('block truncate text-muted-foreground', dimensions.sub)}>
              {portalName}
            </span>
          ) : null}
        </span>
      )}
    </span>
  );
}
