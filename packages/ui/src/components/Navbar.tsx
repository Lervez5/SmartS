'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@schoolos/utils';
import { BrandMark } from './BrandMark';

export interface NavbarProps {
  showSearch?: boolean;
  navbarActions?: ReactNode;
  /** Configured school name for the brand mark. */
  schoolName?: string | null;
  /** Configured logo URL for the brand mark. */
  logoUrl?: string | null;
  /** Portal label shown beside the school name. */
  portalLabel?: string;
  /** Link target for the brand mark (defaults to "/"). */
  brandHref?: string;
}

export function Navbar({
  showSearch = false,
  navbarActions,
  schoolName,
  logoUrl,
  portalLabel,
  brandHref = '/',
}: NavbarProps) {
  return (
    <header
      className={cn(
        'absolute top-0 left-0 right-0 z-50',
        'flex h-[72px] items-center justify-between',
        'px-6 sm:px-8',
        'border-b border-white/10 dark:border-white/5',
        'bg-white/80 dark:bg-slate-950/80',
        'backdrop-blur-xl backdrop-saturate-150',
        'shadow-[0_1px_0_0_rgba(0,0,0,0.04)]'
      )}
    >
      {/* Brand mark */}
      <Link href={brandHref} className="flex items-center gap-3 group">
        <BrandMark logoUrl={logoUrl} schoolName={schoolName} portalName={portalLabel} size="md" />
      </Link>

      {/* Centre - search (optional) */}
      <div className="flex items-center gap-4 flex-1 justify-center px-8">
        {showSearch && (
          <div className="relative hidden md:block w-64">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
                <path
                  fillRule="evenodd"
                  d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <input
              type="search"
              placeholder="Search…"
              className={cn(
                'w-full h-10 rounded-xl pl-10 pr-4',
                'border border-slate-200 dark:border-slate-800',
                'bg-slate-50 dark:bg-slate-900',
                'text-sm text-foreground placeholder:text-muted-foreground/60',
                'transition-all focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50',
                'focus:bg-white dark:focus:bg-slate-800'
              )}
            />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 shrink-0">{navbarActions}</div>
    </header>
  );
}
