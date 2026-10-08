'use client';

import * as React from 'react';
import { cn } from '@schoolos/utils';

export interface BrandLoaderProps {
  label?: string;
  portalName?: string;
  className?: string;
}

export function BrandLoader({
  label = 'Loading portal…',
  portalName = 'Smart School OS',
  className,
}: BrandLoaderProps) {
  return (
    <div
      className={cn(
        'relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-background p-6',
        className
      )}
    >
      {/* Decorative ambient background glows */}
      <div className="absolute -top-32 left-1/2 -z-10 h-96 w-96 -translate-x-1/2 rounded-full bg-emerald-500/15 blur-3xl" />
      <div className="absolute -bottom-32 left-1/2 -z-10 h-96 w-96 -translate-x-1/2 rounded-full bg-emerald-700/10 blur-3xl" />

      {/* Brand Loader Center Box */}
      <div className="flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-300">
        {/* Animated Brand Badge */}
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 text-white shadow-xl shadow-emerald-900/20 mb-6">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="animate-pulse"
          >
            <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
            <path d="M6 12v5c3 3 9 3 12 0v-5" />
          </svg>
          {/* Outer glowing ring */}
          <span className="absolute -inset-1.5 rounded-3xl border-2 border-emerald-500/30 animate-ping opacity-75 pointer-events-none" />
        </div>

        {/* Brand Name */}
        <h2 className="text-xl font-bold tracking-tight text-foreground">{portalName}</h2>
        <p className="mt-1 text-sm font-medium text-muted-foreground">{label}</p>

        {/* Sleek Animated Progress Bar */}
        <div className="mt-6 h-1.5 w-48 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-full bg-gradient-to-r from-emerald-600 via-emerald-400 to-emerald-600 rounded-full animate-pulse" />
        </div>
      </div>
    </div>
  );
}
