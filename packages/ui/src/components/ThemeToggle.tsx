'use client';

/**
 * Light / dark toggle.
 *
 * Backed by `next-themes`, which is already a dependency of every portal and is
 * now mounted in each root layout. Reads `resolvedTheme` rather than `theme` so
 * the icon reflects what is actually on screen: with `defaultTheme="system"` and
 * no stored preference, `theme` is "system" and would show the wrong glyph.
 *
 * Renders a fixed-width placeholder until mounted, because the resolved theme
 * is unknowable on the server and a width change would shift the navbar.
 */

import * as React from 'react';
import { useTheme } from 'next-themes';
import { cn } from '@schoolos/utils';

function SunIcon({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
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
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      className={cn(
        'rounded-md p-2 text-muted-foreground transition-colors',
        'hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
    >
      {mounted ? (
        isDark ? (
          <MoonIcon className="h-5 w-5" />
        ) : (
          <SunIcon className="h-5 w-5" />
        )
      ) : (
        <span className="block h-5 w-5" />
      )}
    </button>
  );
}
